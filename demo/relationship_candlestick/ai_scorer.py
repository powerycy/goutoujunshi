"""Loader + recurrence math (v3 schema, with v1/v2 backward compat).

Three scoring schemas auto-detected per line:

  V3 (relative):
      {"i":..., "delta_vs_prior":±X.X, "delta_vs_atmosphere":±X.X,
       "primary_dim":"affection", "tags":[...], "rationale":"..."}
      → delta_blend = 0.5 * vs_prior + 0.5 * vs_atmosphere
      → NO CLAMP (index can go above 100 / below 0)

  V2 (signed dimensions):
      {"i":..., "tags":[...], "dimensions":{...7 signed dims...},
       "reaction_to_prior":..., "rationale":"..."}
      → raw_delta = Σ(dim * weight); CLAMP [0,100]

  V1 (unsigned buckets, legacy):
      {"i":..., "event_tags":[...], "scores":{...10 buckets...}, "rationale":"..."}
      → raw_delta = Σ(score * weight); CLAMP [0,100]

Time-decay recurrence (universal):
    decay   = 1 - exp(-Δt_hours / TAU)            # TAU=72h default
    index_t = prev_index*(1-decay) + 50*decay + delta_blend [+ recip]
              [+ optional clamp to [0,100] for v1/v2]
"""
from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Optional

import pandas as pd

from .utils import clamp


# ─── 10 dimensions used in v3 (tags only — math uses delta_blend) ─
DIMENSIONS_V3 = [
    "affection", "engagement", "care", "conflict", "tension",
    "investment", "awkwardness",
    "future_orientation", "vulnerability", "shared_identity",
]

# ─── v2: 7 signed dimensions ──────────────────────────────────────
DIMENSIONS = [
    "affection", "engagement", "care", "conflict",
    "tension", "investment", "awkwardness",
]
DIM_WEIGHTS = {
    "affection":   0.30,
    "tension":     0.20,
    "investment":  0.20,
    "care":        0.15,
    "engagement":  0.10,
    "conflict":    0.20,
    "awkwardness": 0.05,
}

# ─── v1: 10 unsigned buckets (legacy) ─────────────────────────────
LEGACY_BUCKETS = [
    "flirt", "warmth", "engagement", "jealousy", "care",
    "invitation", "repair", "conflict", "coldness", "probe",
]
LEGACY_WEIGHTS = {
    "flirt":      0.25,
    "warmth":     0.20,
    "engagement": 0.15,
    "repair":     0.15,
    "probe":      0.10,
    "jealousy":   0.125,
    "care":       0.10,
    "invitation": 0.125,
    "conflict":  -0.25,
    "coldness":  -0.20,
}

SCORE_BUCKETS = LEGACY_BUCKETS  # backward-compat name


# ─── backward-compat shims for older imports ─────────────────────
def compute_raw_delta(entry: dict) -> float:
    """Deprecated alias for compute_delta — kept for v1/v2 callers."""
    return compute_delta(entry)


DEFAULT_DECAY = 0.025  # legacy alias for old tests

# ─── Recurrence parameters ────────────────────────────────────────
DEFAULT_TAU_HOURS    = 72.0
DEFAULT_BLEND_WEIGHT = 0.5      # vs_prior weight; vs_atmosphere = 1 - this
DEFAULT_RECIP_W      = 0.10     # legacy reciprocity (v2 reaction_to_prior)
DEFAULT_DECAY_LEGACY = 0.025
ATMOSPHERE_WINDOW    = 20       # how many recent msgs define "atmosphere"


def _schema_of(entry: dict) -> str:
    if "delta_vs_prior" in entry or "delta_vs_atmosphere" in entry:
        return "v3"
    if "dimensions" in entry:
        return "v2"
    return "v1"


def compute_delta(entry: dict, blend_weight: float = DEFAULT_BLEND_WEIGHT) -> float:
    """Return the per-message delta to add (after decay) to the running index.
    For v3: blend the two relative deltas.
    For v1/v2: weighted sum of bucket/dim scores (legacy)."""
    s = _schema_of(entry)
    if s == "v3":
        a = float(entry.get("delta_vs_prior", 0))
        b = float(entry.get("delta_vs_atmosphere", 0))
        return blend_weight * a + (1 - blend_weight) * b
    if s == "v2":
        d = entry.get("dimensions", {})
        return float(sum(int(d.get(k, 0)) * w for k, w in DIM_WEIGHTS.items()))
    s_dict = entry.get("scores", {})
    return float(sum(int(s_dict.get(k, 0)) * w for k, w in LEGACY_WEIGHTS.items()))


def time_decay_factor(gap_hours: float, tau_hours: float = DEFAULT_TAU_HOURS) -> float:
    g = max(0.0, float(gap_hours))
    return 1.0 - math.exp(-g / max(0.001, tau_hours))


def apply_recurrence(
    prev_index: float,
    delta: float,
    *,
    gap_hours: float | None = None,
    tau_hours: float = DEFAULT_TAU_HOURS,
    reaction_to_prior: float = 0.0,
    prev_raw_delta: float = 0.0,
    recip_weight: float = DEFAULT_RECIP_W,
    legacy_decay: float = DEFAULT_DECAY_LEGACY,
    do_clamp: bool = True,
) -> float:
    """Compute index_t = prev*(1-decay) + 50*decay + delta + reciprocity.
    `do_clamp=True` → clamp to [0,100] (used for v1/v2 backward compat).
    `do_clamp=False` → unbounded (v3 native)."""
    decay = legacy_decay if gap_hours is None else time_decay_factor(gap_hours, tau_hours)
    sign = 1.0 if prev_raw_delta > 0 else (-1.0 if prev_raw_delta < 0 else 0.0)
    recip = float(reaction_to_prior) * sign * recip_weight
    out = prev_index * (1.0 - decay) + 50.0 * decay + delta + recip
    return clamp(out) if do_clamp else out


def compute_atmosphere(scored_so_far: list, window: int = ATMOSPHERE_WINDOW) -> dict:
    """Compute recent atmosphere stats over the last `window` scored messages."""
    if not scored_so_far:
        return {"recent_avg_index": 50.0, "recent_avg_delta": 0.0,
                "window_size": window}
    tail = scored_so_far[-window:]
    avg_idx = sum(r["relationship_index"] for r in tail) / len(tail)
    avg_delta = sum(r.get("delta", r.get("raw_delta", 0)) for r in tail) / len(tail)
    return {"recent_avg_index": round(avg_idx, 2),
            "recent_avg_delta": round(avg_delta, 3),
            "window_size": window}


def load_scored_jsonl(
    path: str | Path,
    *,
    messages_path: Optional[str | Path] = None,
    initial_index: float = 50.0,
    tau_hours: float = DEFAULT_TAU_HOURS,
    blend_weight: float = DEFAULT_BLEND_WEIGHT,
    recip_weight: float = DEFAULT_RECIP_W,
    legacy_decay: float = DEFAULT_DECAY_LEGACY,
    recompute_index: bool = True,
) -> pd.DataFrame:
    """Load scored.jsonl (any schema), compute the index path with time decay
    + (for v3) two-frame relative blend.

    Returns a DataFrame with one row per message and columns:
        timestamp, sender, message, event_tags, raw_delta, relationship_index,
        rationale, reaction_to_prior, gap_seconds, gap_hours, schema,
        + per-dim columns where applicable, + timing helpers.
    """
    path = Path(path)
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        for ln, line in enumerate(f, 1):
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except json.JSONDecodeError as e:
                raise ValueError(f"scored JSONL line {ln} invalid: {e}")
    if not rows:
        raise ValueError(f"No scored messages in {path}")

    # Re-join message text from messages.jsonl if compact format.
    needs_join = any("timestamp" not in r for r in rows)
    if needs_join:
        if messages_path is None:
            messages_path = path.parent / "messages.jsonl"
        if not Path(messages_path).exists():
            raise ValueError(
                f"scored lines lack message text and {messages_path} not found"
            )
        msgs = {}
        with open(messages_path, "r", encoding="utf-8") as f:
            for idx, line in enumerate(f, 1):
                line = line.strip()
                if not line:
                    continue
                m = json.loads(line)
                msgs[m.get("i", idx)] = m
        for r in rows:
            i = r.get("i")
            if i is None or i not in msgs:
                raise ValueError(f"scored line missing/invalid i={i}")
            base = msgs[i]
            r.setdefault("timestamp", base["timestamp"])
            r.setdefault("sender",    base["sender"])
            r.setdefault("message",   base["message"])

    rows.sort(key=lambda r: pd.to_datetime(r["timestamp"]))

    df_rows = []
    cur_index = float(initial_index)
    prev_raw_delta = 0.0
    prev_ts: Optional[pd.Timestamp] = None
    for r in rows:
        ts = pd.to_datetime(r["timestamp"])
        gap_seconds = 0.0 if prev_ts is None else max(0.0, (ts - prev_ts).total_seconds())
        gap_hours = gap_seconds / 3600.0

        schema = _schema_of(r)
        delta = compute_delta(r, blend_weight=blend_weight)
        reaction = float(r.get("reaction_to_prior", 0))
        do_clamp = (schema != "v3")  # v3 unbounded

        if recompute_index:
            cur_index = apply_recurrence(
                cur_index, delta,
                gap_hours=gap_hours, tau_hours=tau_hours,
                reaction_to_prior=reaction, prev_raw_delta=prev_raw_delta,
                recip_weight=recip_weight, legacy_decay=legacy_decay,
                do_clamp=do_clamp,
            )
        else:
            if "relationship_index" in r:
                cur_index = float(r["relationship_index"])
                if do_clamp:
                    cur_index = clamp(cur_index)

        # Tags can live under multiple keys depending on schema.
        tags = r.get("tags") or r.get("event_tags") or ["neutral_chat"]
        if isinstance(tags, str):
            tags = [tags]

        row = {
            "timestamp": ts,
            "sender":    str(r["sender"]),
            "message":   str(r["message"]),
            "event_tags": "|".join(tags),
            "raw_delta": round(delta, 4),
            "relationship_index": round(cur_index, 4),
            "rationale": str(r.get("rationale", "")),
            "reaction_to_prior": reaction,
            "gap_seconds": gap_seconds,
            "gap_hours": gap_hours,
            "schema": schema,
        }

        if schema == "v3":
            row["delta_vs_prior"]      = float(r.get("delta_vs_prior", 0))
            row["delta_vs_atmosphere"] = float(r.get("delta_vs_atmosphere", 0))
            row["primary_dim"]         = str(r.get("primary_dim", ""))
        elif schema == "v2":
            d = r.get("dimensions", {})
            for k in DIMENSIONS:
                row[f"{k}_score"] = float(d.get(k, 0))
        else:  # v1
            sc = r.get("scores", {})
            for k in LEGACY_BUCKETS:
                row[f"{k}_score"] = float(sc.get(k, 0))

        df_rows.append(row)
        prev_raw_delta = delta
        prev_ts = ts

    df = pd.DataFrame(df_rows).reset_index(drop=True)

    df["msg_len"]        = df["message"].str.len()
    df["is_topic_start"] = df["gap_seconds"] >= 30 * 60
    df["is_fast_reply"]  = (df["gap_seconds"] > 0) & (df["gap_seconds"] <= 60)
    df["is_long_reply"]  = df["msg_len"] >= 80
    df["is_one_word"]    = df["msg_len"] <= 2
    df["is_delayed"]     = df["gap_seconds"] >= 180 * 60
    return df


def write_messages_jsonl(df: pd.DataFrame, out_path: str | Path) -> None:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        for i, (_, r) in enumerate(df.iterrows(), 1):
            f.write(json.dumps({
                "i": i,
                "timestamp": r["timestamp"].isoformat(),
                "sender":    r["sender"],
                "message":   r["message"],
            }, ensure_ascii=False) + "\n")
