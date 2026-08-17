"""Pure-Python technical indicators on a relationship-K-line OHLC DataFrame.

All math runs locally — never goes near an LLM.

Input contract: a DataFrame with at least these columns:
    period_start (datetime), open, high, low, close, volume

Output contract: each function returns a dict of {series_name: list[(unix_seconds, value or None)]}
so the frontend can plot directly. None marks "indicator not yet defined" (warm-up bars).

Implemented:
    ma(periods)            -> simple moving averages of close
    ema(periods)           -> exponential moving averages of close
    bbands(period, sigma)  -> bollinger upper / middle / lower
    macd(fast, slow, sig)  -> dif / dea / hist
    rsi(period)            -> rsi
    kdj(n, k, d)           -> k / d / j
"""
from __future__ import annotations

from typing import Iterable

import numpy as np
import pandas as pd


# ─── helpers ─────────────────────────────────────────────────────

def _ts_seconds(df: pd.DataFrame) -> list[int]:
    return [int(pd.Timestamp(t).timestamp()) for t in df["period_start"]]


def _series_or_none(values: np.ndarray, valid_from: int) -> list:
    """Convert a numpy array to JSON-friendly [v, v, None, None, ...] form."""
    out = []
    for i, v in enumerate(values):
        if i < valid_from or v is None or (isinstance(v, float) and np.isnan(v)):
            out.append(None)
        else:
            out.append(round(float(v), 4))
    return out


def _zip_xy(times: list[int], values: list) -> list[dict]:
    return [{"time": t, "value": v} for t, v in zip(times, values)]


# ─── moving averages ─────────────────────────────────────────────

def ma(df: pd.DataFrame, periods: Iterable[int]) -> dict[str, list[dict]]:
    times = _ts_seconds(df)
    close = df["close"].astype(float).to_numpy()
    out: dict[str, list[dict]] = {}
    for n in periods:
        n = int(n)
        if n <= 0:
            continue
        s = pd.Series(close).rolling(window=n, min_periods=n).mean().to_numpy()
        out[f"MA{n}"] = _zip_xy(times, _series_or_none(s, n - 1))
    return out


def ema(df: pd.DataFrame, periods: Iterable[int]) -> dict[str, list[dict]]:
    times = _ts_seconds(df)
    close = df["close"].astype(float).to_numpy()
    out: dict[str, list[dict]] = {}
    for n in periods:
        n = int(n)
        if n <= 0:
            continue
        s = pd.Series(close).ewm(span=n, adjust=False, min_periods=n).mean().to_numpy()
        out[f"EMA{n}"] = _zip_xy(times, _series_or_none(s, n - 1))
    return out


# ─── bollinger bands ─────────────────────────────────────────────

def bbands(df: pd.DataFrame, period: int = 20,
           sigma: float = 2.0) -> dict[str, list[dict]]:
    times = _ts_seconds(df)
    close = df["close"].astype(float)
    mid = close.rolling(window=period, min_periods=period).mean()
    std = close.rolling(window=period, min_periods=period).std(ddof=0)
    upper = mid + sigma * std
    lower = mid - sigma * std
    valid = period - 1
    return {
        f"BB_UPPER({period},{sigma})": _zip_xy(times, _series_or_none(upper.to_numpy(), valid)),
        f"BB_MID({period},{sigma})":   _zip_xy(times, _series_or_none(mid.to_numpy(), valid)),
        f"BB_LOWER({period},{sigma})": _zip_xy(times, _series_or_none(lower.to_numpy(), valid)),
    }


# ─── MACD ────────────────────────────────────────────────────────

def macd(df: pd.DataFrame, fast: int = 12, slow: int = 26,
         signal: int = 9) -> dict[str, list[dict]]:
    times = _ts_seconds(df)
    close = df["close"].astype(float)
    ema_fast = close.ewm(span=fast, adjust=False, min_periods=fast).mean()
    ema_slow = close.ewm(span=slow, adjust=False, min_periods=slow).mean()
    dif = ema_fast - ema_slow
    dea = dif.ewm(span=signal, adjust=False, min_periods=signal).mean()
    hist = (dif - dea) * 2  # 国内 MACD 习惯 ×2
    valid = slow - 1
    return {
        f"MACD_DIF({fast},{slow},{signal})":  _zip_xy(times, _series_or_none(dif.to_numpy(),  valid)),
        f"MACD_DEA({fast},{slow},{signal})":  _zip_xy(times, _series_or_none(dea.to_numpy(),  valid + signal - 1)),
        f"MACD_HIST({fast},{slow},{signal})": _zip_xy(times, _series_or_none(hist.to_numpy(), valid + signal - 1)),
    }


# ─── RSI (Wilder smoothing) ──────────────────────────────────────

def rsi(df: pd.DataFrame, period: int = 14) -> dict[str, list[dict]]:
    times = _ts_seconds(df)
    close = df["close"].astype(float)
    delta = close.diff()
    gain = delta.clip(lower=0.0)
    loss = (-delta).clip(lower=0.0)

    # Wilder's smoothing == EMA with alpha = 1/period
    avg_gain = gain.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    avg_loss = loss.ewm(alpha=1.0 / period, adjust=False, min_periods=period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    rsi_v = 100 - (100 / (1 + rs))
    rsi_v = rsi_v.fillna(100.0)  # all-up edge case
    return {
        f"RSI({period})": _zip_xy(times, _series_or_none(rsi_v.to_numpy(), period)),
    }


# ─── KDJ ─────────────────────────────────────────────────────────

def kdj(df: pd.DataFrame, n: int = 9, k_period: int = 3,
        d_period: int = 3) -> dict[str, list[dict]]:
    """KDJ: K/D are EMA of RSV; J = 3K - 2D. Standard Chinese formulation."""
    times = _ts_seconds(df)
    high  = df["high"].astype(float)
    low   = df["low"].astype(float)
    close = df["close"].astype(float)

    low_n  = low.rolling(window=n, min_periods=n).min()
    high_n = high.rolling(window=n, min_periods=n).max()
    rsv = (close - low_n) / (high_n - low_n).replace(0, np.nan) * 100
    rsv = rsv.fillna(50.0)  # if high == low, neutral

    # K = SMA(RSV, k_period), starting at 50; D = SMA(K, d_period) starting at 50.
    # We use Wilder-like recursion that's the standard:
    # K_t = ((k_period - 1) * K_{t-1} + RSV_t) / k_period
    # D_t = ((d_period - 1) * D_{t-1} + K_t) / d_period
    k_arr = np.zeros(len(rsv))
    d_arr = np.zeros(len(rsv))
    prev_k = 50.0
    prev_d = 50.0
    rsv_arr = rsv.to_numpy()
    for i in range(len(rsv_arr)):
        v = rsv_arr[i]
        if np.isnan(v):
            k_arr[i] = np.nan
            d_arr[i] = np.nan
            continue
        k_val = ((k_period - 1) * prev_k + v) / k_period
        d_val = ((d_period - 1) * prev_d + k_val) / d_period
        k_arr[i] = k_val
        d_arr[i] = d_val
        prev_k = k_val
        prev_d = d_val
    j_arr = 3 * k_arr - 2 * d_arr

    valid = n - 1
    return {
        f"KDJ_K({n},{k_period},{d_period})": _zip_xy(times, _series_or_none(k_arr, valid)),
        f"KDJ_D({n},{k_period},{d_period})": _zip_xy(times, _series_or_none(d_arr, valid)),
        f"KDJ_J({n},{k_period},{d_period})": _zip_xy(times, _series_or_none(j_arr, valid)),
    }


# ─── spec parser ─────────────────────────────────────────────────

def parse_spec(spec: str) -> list[tuple[str, list[float]]]:
    """Parse a compact indicator-spec string.

    Examples:
        "ma:5,10,20"
        "ema:12,26"
        "bb:20,2"
        "macd:12,26,9"
        "rsi:14"
        "kdj:9,3,3"
        "ma:5,10,20;bb:20,2;macd;rsi:14;kdj"

    Returns a list of (name, params) tuples. Unknown names are skipped.
    """
    out = []
    if not spec:
        return out
    for chunk in spec.split(";"):
        chunk = chunk.strip()
        if not chunk:
            continue
        if ":" in chunk:
            name, raw = chunk.split(":", 1)
            params = []
            for p in raw.split(","):
                p = p.strip()
                if not p:
                    continue
                try:
                    params.append(float(p) if "." in p else int(p))
                except ValueError:
                    continue
        else:
            name, params = chunk, []
        out.append((name.lower().strip(), params))
    return out


# ─── dispatcher ──────────────────────────────────────────────────

DEFAULTS = {
    "ma":   [5, 10, 20],
    "ema":  [12, 26],
    "bb":   [20, 2.0],
    "macd": [12, 26, 9],
    "rsi":  [14],
    "kdj":  [9, 3, 3],
}


def compute(df: pd.DataFrame, spec: str) -> dict:
    """Compute a bundle of indicators given a spec string.

    Returns a dict shaped:
        {
          "overlays": {<series_name>: [{time, value}, ...], ...},   # to draw on price chart
          "panes":    {"MACD": {...}, "RSI": {...}, "KDJ": {...}},  # each value is dict of series
        }
    """
    overlays: dict = {}
    panes: dict = {}
    if df is None or df.empty:
        return {"overlays": overlays, "panes": panes}

    for name, params in parse_spec(spec):
        p = params or DEFAULTS.get(name, [])
        try:
            if name == "ma":
                overlays.update(ma(df, [int(x) for x in p]))
            elif name == "ema":
                overlays.update(ema(df, [int(x) for x in p]))
            elif name == "bb":
                period = int(p[0]) if len(p) >= 1 else 20
                sigma  = float(p[1]) if len(p) >= 2 else 2.0
                overlays.update(bbands(df, period=period, sigma=sigma))
            elif name == "macd":
                fast   = int(p[0]) if len(p) >= 1 else 12
                slow   = int(p[1]) if len(p) >= 2 else 26
                signal = int(p[2]) if len(p) >= 3 else 9
                panes["MACD"] = macd(df, fast=fast, slow=slow, signal=signal)
            elif name == "rsi":
                period = int(p[0]) if len(p) >= 1 else 14
                panes["RSI"] = rsi(df, period=period)
            elif name == "kdj":
                n = int(p[0]) if len(p) >= 1 else 9
                k = int(p[1]) if len(p) >= 2 else 3
                d = int(p[2]) if len(p) >= 3 else 3
                panes["KDJ"] = kdj(df, n=n, k_period=k, d_period=d)
        except Exception as e:
            # Skip broken indicators silently — frontend gets the rest.
            print(f"[indicators] skip {name}({p}): {e}")
    return {"overlays": overlays, "panes": panes}
