"""Aggregate the message-level relationship_index path into multi-timeframe OHLC.

Critical contract:
    Open  = first relationship_index in the period
    High  = max  relationship_index in the period
    Low   = min  relationship_index in the period
    Close = last relationship_index in the period
    upper_shadow = high - max(open, close)
    lower_shadow = min(open, close) - low
    body         = abs(close - open)

Shadows are derived MECHANICALLY from the small-timeframe path.
They are never produced from semantic labels directly.
"""
from __future__ import annotations

from typing import Optional

import numpy as np
import pandas as pd

from .utils import TIMEFRAME_TO_PANDAS, clamp
from .volume import compute_period_volume


def _direction(open_: float, close: float, threshold: float) -> str:
    if close > open_ + threshold:
        return "bullish"
    if close < open_ - threshold:
        return "bearish"
    return "neutral"


def aggregate_ohlc(
    df: pd.DataFrame,
    timeframe: str,
    config: dict,
    calendar_mode: str = "active-only",
    initial_index: Optional[float] = None,
) -> pd.DataFrame:
    """Aggregate message-level index into OHLC bars at `timeframe`.

    Args:
        df: must contain columns timestamp, relationship_index, msg_len,
            is_topic_start, is_fast_reply, event_tags.
        timeframe: one of '5min','15min','30min','1h','4h','1d','1w'.
        calendar_mode: 'active-only' or 'calendar'.
            In calendar mode, silent periods get a flat carry-forward bar
            (O=H=L=C=prev_close, volume=0).
    """
    if timeframe not in TIMEFRAME_TO_PANDAS:
        raise ValueError(f"Unknown timeframe: {timeframe}")
    rule = TIMEFRAME_TO_PANDAS[timeframe]
    threshold = config.get("neutral_threshold", 2)
    vol_cfg = config["volume"]

    df = df.copy().sort_values("timestamp").reset_index(drop=True)
    df = df.set_index(pd.DatetimeIndex(df["timestamp"]))

    rows = []
    grouper = pd.Grouper(freq=rule)

    if calendar_mode == "active-only":
        for period_start, group in df.groupby(grouper):
            if group.empty:
                continue
            rows.append(_period_row(period_start, rule, group, vol_cfg, threshold))
    elif calendar_mode == "calendar":
        if df.empty:
            return pd.DataFrame()
        # `floor`/`ceil` only support fixed-frequency offsets (5min, 1h, 1D...).
        # For anchored offsets (1W, MS, QS, YS), build via period_range instead.
        try:
            start = df.index.min().floor(rule)
            end   = df.index.max().ceil(rule)
            full_index = pd.date_range(start, end, freq=rule)
        except ValueError:
            # Anchored offsets aren't valid for `to_period`; map them to
            # plain period frequencies (W, M, Q, Y).
            ANCHORED = {"1W": "W", "MS": "M", "QS": "Q", "YS": "Y"}
            pf = ANCHORED.get(rule, rule)
            full_index = pd.period_range(
                start=df.index.min(), end=df.index.max(), freq=pf,
            ).to_timestamp()
        groups = dict(list(df.groupby(grouper)))
        prev_close = float(initial_index if initial_index is not None
                           else config.get("initial_index", 50))
        for period_start in full_index:
            group = groups.get(period_start, pd.DataFrame())
            if not group.empty:
                row = _period_row(period_start, rule, group, vol_cfg, threshold)
                prev_close = row["close"]
                rows.append(row)
            else:
                # Silent period: flat carry-forward, O=H=L=C=prev_close, volume=0.
                c = prev_close
                period_end = period_start + pd.tseries.frequencies.to_offset(rule)
                rows.append({
                    "period_start": period_start,
                    "period_end":   period_end,
                    "open": prev_close, "high": prev_close,
                    "low":  c,          "close": c,
                    "volume": 0.0,
                    "upper_shadow": 0.0, "lower_shadow": 0.0,
                    "body": 0.0,
                    "change": 0.0,
                    "change_pct": 0.0,
                    "direction": _direction(prev_close, c, threshold),
                    "message_count": 0, "event_count": 0,
                })
                prev_close = c
    else:
        raise ValueError(f"Unknown calendar_mode: {calendar_mode}")

    out = pd.DataFrame(rows)
    return out


def _period_row(period_start, rule, group, vol_cfg, threshold) -> dict:
    period_end = period_start + pd.tseries.frequencies.to_offset(rule)
    o = float(group["relationship_index"].iloc[0])
    c = float(group["relationship_index"].iloc[-1])
    h = float(group["relationship_index"].max())
    l = float(group["relationship_index"].min())
    upper = h - max(o, c)
    lower = min(o, c) - l
    body  = abs(c - o)
    vol   = compute_period_volume(group, vol_cfg)
    evt_count = int((group["event_tags"] != "neutral_chat").sum())
    return {
        "period_start": period_start,
        "period_end":   period_end,
        "open": o, "high": h, "low": l, "close": c,
        "volume": vol,
        "upper_shadow": upper, "lower_shadow": lower, "body": body,
        "change": c - o,
        "change_pct": (c - o) / o if o else 0.0,
        "direction": _direction(o, c, threshold),
        "message_count": len(group),
        "event_count": evt_count,
        # Per-bar attribution: which dimensions drove the move + standout
        # message-level rationales. Used by the frontend hover tooltip.
        "top_dims":   _dim_breakdown(group),
        "top_events": _top_events(group, k=4),
    }


def _dim_breakdown(group, top_n: int = 4) -> list[dict]:
    """Sum raw_delta per primary_dim within this bar; return top contributors
    by absolute magnitude, signed."""
    if group.empty or "primary_dim" not in group.columns:
        return []
    agg = (
        group.groupby("primary_dim")
             .agg(delta=("raw_delta", "sum"), count=("raw_delta", "size"))
             .reset_index()
    )
    agg["abs_delta"] = agg["delta"].abs()
    agg = agg.sort_values("abs_delta", ascending=False).head(top_n)
    return [
        {"dim": str(r["primary_dim"]),
         "delta": round(float(r["delta"]), 3),
         "count": int(r["count"])}
        for _, r in agg.iterrows()
        if abs(float(r["delta"])) > 1e-9     # drop zero-only dims
    ]


def _top_events(group, k: int = 4) -> list[dict]:
    """Pick k messages within the bar with the largest |raw_delta| AND
    a non-empty rationale — these are the standout moments."""
    if group.empty:
        return []
    g = group.copy()
    g["abs_delta"] = g.get("raw_delta", 0).abs()
    # Prefer rationale-bearing rows; fall back to any if too few
    rat = g[g.get("rationale", "").astype(str).str.strip() != ""]
    pool = rat if len(rat) >= k else g
    pool = pool.sort_values("abs_delta", ascending=False).head(k)
    out = []
    for _, r in pool.iterrows():
        msg = str(r.get("message", ""))
        if len(msg) > 60:
            msg = msg[:57] + "…"
        rat_text = str(r.get("rationale", "")).strip()
        if len(rat_text) > 80:
            rat_text = rat_text[:77] + "…"
        out.append({
            "ts":      pd.Timestamp(r["timestamp"]).isoformat(),
            "sender":  str(r.get("sender", "")),
            "message": msg,
            "rationale":   rat_text,
            "primary_dim": str(r.get("primary_dim", "")),
            "delta":   round(float(r.get("raw_delta", 0)), 3),
        })
    return out
