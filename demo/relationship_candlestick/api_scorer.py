"""Anthropic API scorer (v3 schema).

The AI judges every message with TWO RELATIVE deltas (vs prior message + vs
recent atmosphere) plus a primary dimension tag (10 dimensions). The framework
computes the running relationship_index with time-decayed recurrence and
no upper/lower clamp.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import List

import pandas as pd

from .ai_scorer import (
    DIMENSIONS_V3, DEFAULT_TAU_HOURS, DEFAULT_BLEND_WEIGHT,
    DEFAULT_RECIP_W, ATMOSPHERE_WINDOW,
    apply_recurrence, compute_delta, compute_atmosphere,
    load_scored_jsonl, write_messages_jsonl,
)


SKILL_PATH = Path(__file__).resolve().parent.parent / "skill" / "SKILL.md"


def _read_skill() -> str:
    return SKILL_PATH.read_text(encoding="utf-8")


def _msg_to_dict(r) -> dict:
    return {
        "i": int(r["i"]),
        "ts": r["timestamp"].isoformat(),
        "sender": r["sender"],
        "text": r["message"],
    }


def _ctx_dict(prev: dict) -> dict:
    """Compact context line for an already-scored v3 message."""
    return {
        "i": prev["i"],
        "ts": prev["ts"],
        "sender": prev["sender"],
        "text": prev["text"],
        "delta_vs_prior":      prev.get("delta_vs_prior", 0),
        "delta_vs_atmosphere": prev.get("delta_vs_atmosphere", 0),
        "primary_dim":         prev.get("primary_dim", ""),
        "tags":                prev.get("tags", []),
        "idx":                 round(prev["relationship_index"], 2),
    }


def _strip_fences(text: str) -> str:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[1] if "\n" in text else text
        if text.endswith("```"):
            text = text[:-3]
    return text.strip()


def score_with_api(
    messages_df: pd.DataFrame,
    out_path: str | Path,
    *,
    model: str = "claude-sonnet-4-6",
    initial_index: float = 50.0,
    batch_size: int = 50,
    context_window: int = 30,
    tau_hours: float = DEFAULT_TAU_HOURS,
    blend_weight: float = DEFAULT_BLEND_WEIGHT,
    recip_weight: float = DEFAULT_RECIP_W,
    atmosphere_window: int = ATMOSPHERE_WINDOW,
    api_key: str | None = None,
    verbose: bool = True,
    progress_cb=None,
) -> pd.DataFrame:
    """Score every message via Claude API (v3 schema)."""
    try:
        from anthropic import Anthropic
    except ImportError as e:
        raise RuntimeError("AI scoring requires: pip install anthropic") from e

    key = api_key or os.environ.get("ANTHROPIC_API_KEY")
    if not key:
        raise RuntimeError(
            "ANTHROPIC_API_KEY is not set. Pass api_key= or set env var."
        )
    client = Anthropic(api_key=key)
    skill = _read_skill()

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    df = messages_df.copy().reset_index(drop=True)
    df["i"] = df.index + 1
    all_msgs = [_msg_to_dict(r) for _, r in df.iterrows()]
    by_i = {m["i"]: m for m in all_msgs}
    n = len(all_msgs)

    scored: List[dict] = []
    cur_index = float(initial_index)
    prev_delta = 0.0
    prev_ts: pd.Timestamp | None = None

    with open(out_path, "w", encoding="utf-8") as fout:
        for start in range(0, n, batch_size):
            batch = all_msgs[start:start + batch_size]
            ctx = [_ctx_dict(o) for o in scored[-context_window:]]
            atmosphere = compute_atmosphere(scored, window=atmosphere_window)

            payload = {
                "previous_relationship_index": round(cur_index, 2),
                "atmosphere": atmosphere,
                "context_already_scored": ctx,
                "new_messages_to_score": batch,
            }
            user_block = (
                "Read the SKILL.md system prompt — note the v3 schema "
                "(two relative deltas + primary_dim + tags). Score each new "
                "message. Output ONLY one JSON object per new message, in "
                "input order, no markdown fences.\n\n"
                f"```json\n{json.dumps(payload, ensure_ascii=False)}\n```\n\n"
                f"Output exactly {len(batch)} JSONL lines, each with: i, "
                "delta_vs_prior, delta_vs_atmosphere, primary_dim, tags, rationale."
            )

            if verbose:
                print(f"[api] batch {start//batch_size+1}/"
                      f"{(n+batch_size-1)//batch_size} "
                      f"({len(batch)} msgs, ctx={len(ctx)}, "
                      f"atmo={atmosphere['recent_avg_index']:.1f}, "
                      f"prev_idx={cur_index:.2f})",
                      file=sys.stderr, flush=True)

            resp = client.messages.create(
                model=model,
                max_tokens=8192,
                system=skill,
                messages=[{"role": "user", "content": user_block}],
            )
            text = "".join(
                b.text for b in resp.content if getattr(b, "type", "") == "text"
            )
            text = _strip_fences(text)

            for line in text.splitlines():
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                i = obj.get("i")
                if i not in by_i:
                    continue
                base = by_i[i]
                ts = pd.to_datetime(base["ts"])
                gap_hours = 0.0 if prev_ts is None else max(0.0, (ts - prev_ts).total_seconds() / 3600.0)

                d_prior = float(obj.get("delta_vs_prior", 0))
                d_atmo  = float(obj.get("delta_vs_atmosphere", 0))
                primary = str(obj.get("primary_dim", ""))
                tags    = obj.get("tags") or ["neutral_chat"]
                rat     = str(obj.get("rationale", ""))

                row = {
                    "i": i,
                    "timestamp": base["ts"],
                    "sender":    base["sender"],
                    "message":   base["text"],
                    "delta_vs_prior":      d_prior,
                    "delta_vs_atmosphere": d_atmo,
                    "primary_dim": primary,
                    "tags": tags,
                    "rationale": rat,
                }

                # framework arithmetic
                delta_blend = compute_delta(row, blend_weight=blend_weight)
                cur_index = apply_recurrence(
                    cur_index, delta_blend,
                    gap_hours=gap_hours, tau_hours=tau_hours,
                    do_clamp=False,
                )
                row["relationship_index"] = round(cur_index, 4)
                row["delta"] = round(delta_blend, 4)

                scored.append(row)
                fout.write(json.dumps(row, ensure_ascii=False) + "\n")
                prev_delta = delta_blend
                prev_ts = ts

            fout.flush()
            if progress_cb:
                progress_cb(len(scored), n)

    return load_scored_jsonl(
        out_path, recompute_index=False,
        tau_hours=tau_hours, blend_weight=blend_weight,
        recip_weight=recip_weight,
    )
