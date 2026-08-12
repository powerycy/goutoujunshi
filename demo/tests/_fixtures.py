"""Build a synthetic 'scored' DataFrame as if Claude had already scored it."""
import pandas as pd
from relationship_candlestick.ai_scorer import LEGACY_BUCKETS, DIMENSIONS


def make_scored(rows):
    """rows: list of (ts, sender, message, relationship_index)."""
    df = pd.DataFrame([{
        "timestamp": pd.Timestamp(ts), "sender": s, "message": m,
        "relationship_index": float(idx),
        "raw_delta": 0.0, "event_tags": "neutral_chat", "rationale": "",
        "reaction_to_prior": 0.0,
        **{f"{b}_score": 0.0 for b in LEGACY_BUCKETS},
        **{f"{d}_score": 0.0 for d in DIMENSIONS},
    } for ts, s, m, idx in rows]).sort_values("timestamp").reset_index(drop=True)
    df["msg_len"] = df["message"].str.len()
    df["gap_seconds"] = df["timestamp"].diff().dt.total_seconds().fillna(0)
    df["gap_hours"] = df["gap_seconds"] / 3600.0
    df["is_topic_start"] = df["gap_seconds"] >= 30 * 60
    df["is_fast_reply"]  = (df["gap_seconds"] > 0) & (df["gap_seconds"] <= 60)
    df["is_long_reply"]  = df["msg_len"] >= 80
    df["is_one_word"]    = df["msg_len"] <= 2
    df["is_delayed"]     = df["gap_seconds"] >= 180 * 60
    return df
