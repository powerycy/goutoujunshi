"""Per-period volume computation.

Volume is interaction intensity, NOT financial volume:
    volume = Σ per_message
           + Σ per_character
           + Σ per_fast_reply
"""
from __future__ import annotations

import pandas as pd


def compute_period_volume(group: pd.DataFrame, vol_cfg: dict) -> float:
    if group.empty:
        return 0.0
    msg_count = len(group)
    chars     = int(group["msg_len"].sum())
    fasts     = int(group["is_fast_reply"].sum())

    return (
        msg_count * vol_cfg["per_message"]
        + chars   * vol_cfg["per_character"]
        + fasts   * vol_cfg["per_fast_reply"]
    )
