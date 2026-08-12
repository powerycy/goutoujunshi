"""Tests for the v3 schema (relative deltas + atmosphere blending + no clamp)
+ backward compat with v1 / v2 schemas."""
import json
import math

import pandas as pd
import pytest

from relationship_candlestick.ai_scorer import (
    DIMENSIONS_V3, DEFAULT_TAU_HOURS, DEFAULT_BLEND_WEIGHT,
    compute_delta, apply_recurrence, time_decay_factor, compute_atmosphere,
    load_scored_jsonl, _schema_of,
)


def test_v3_dimensions_count():
    assert len(DIMENSIONS_V3) == 10


def test_schema_detection():
    assert _schema_of({"delta_vs_prior": 0}) == "v3"
    assert _schema_of({"delta_vs_atmosphere": 0}) == "v3"
    assert _schema_of({"dimensions": {}}) == "v2"
    assert _schema_of({"scores": {}}) == "v1"


def test_compute_delta_v3_blend():
    e = {"delta_vs_prior": 4, "delta_vs_atmosphere": 2}
    assert compute_delta(e, blend_weight=0.5) == 3.0
    assert compute_delta(e, blend_weight=1.0) == 4.0
    assert compute_delta(e, blend_weight=0.0) == 2.0


def test_compute_delta_v2_legacy():
    e = {"dimensions": {"affection": 5, "tension": 3}}
    expected = 5 * 0.30 + 3 * 0.20
    assert abs(compute_delta(e) - expected) < 1e-9


def test_compute_delta_v1_legacy():
    e = {"scores": {"flirt": 4, "coldness": 2}}
    expected = 4 * 0.25 - 2 * 0.20
    assert abs(compute_delta(e) - expected) < 1e-9


def test_v3_no_clamp_can_exceed_100():
    # Apply many big positive deltas; should easily go above 100.
    idx = 50.0
    for _ in range(20):
        idx = apply_recurrence(idx, 5.0, gap_hours=0.01, do_clamp=False)
    assert idx > 100, f"v3 should be unbounded, got {idx}"


def test_v3_no_clamp_can_go_below_zero():
    idx = 50.0
    for _ in range(20):
        idx = apply_recurrence(idx, -5.0, gap_hours=0.01, do_clamp=False)
    assert idx < 0, f"v3 should be unbounded, got {idx}"


def test_v1_v2_still_clamped():
    out = apply_recurrence(99, 100, gap_hours=0, do_clamp=True)
    assert out == 100
    out = apply_recurrence(1, -100, gap_hours=0, do_clamp=True)
    assert out == 0


def test_atmosphere_empty():
    a = compute_atmosphere([])
    assert a["recent_avg_index"] == 50.0


def test_atmosphere_uses_last_n():
    scored = [{"relationship_index": float(i), "delta": 0.1 * i}
              for i in range(50)]
    a = compute_atmosphere(scored, window=20)
    # mean of indexes 30..49 = 39.5
    assert abs(a["recent_avg_index"] - 39.5) < 1e-9
    assert a["window_size"] == 20


def test_load_scored_v3(tmp_path):
    msg = tmp_path / "messages.jsonl"
    sc  = tmp_path / "scored.jsonl"
    msg.write_text(
        '{"i":1,"timestamp":"2026-05-01T10:00:00","sender":"A","message":"想你了"}\n'
        '{"i":2,"timestamp":"2026-05-01T10:00:30","sender":"B","message":"我也想你"}\n',
        encoding="utf-8",
    )
    sc.write_text(
        '{"i":1,"delta_vs_prior":3.0,"delta_vs_atmosphere":5.0,"primary_dim":"affection","tags":["intimacy"],"rationale":""}\n'
        '{"i":2,"delta_vs_prior":1.0,"delta_vs_atmosphere":2.0,"primary_dim":"affection","tags":["intimacy"],"rationale":""}\n',
        encoding="utf-8",
    )
    df = load_scored_jsonl(sc, messages_path=msg, initial_index=50)
    # First: gap=0 => no decay; delta = 0.5*3 + 0.5*5 = 4.0; index = 50 + 4 = 54
    assert abs(df["relationship_index"].iloc[0] - 54.0) < 1e-3
    # Second: tiny gap, decay~0; delta = 0.5*1 + 0.5*2 = 1.5; index = 54 + 1.5 = 55.5
    assert abs(df["relationship_index"].iloc[1] - 55.5) < 1e-3
    assert df["schema"].iloc[0] == "v3"


def test_load_scored_v3_can_break_100(tmp_path):
    msg = tmp_path / "m.jsonl"; sc = tmp_path / "s.jsonl"
    lines_msg = []
    lines_sc = []
    for i in range(15):
        ts = f"2026-05-01T10:{i:02d}:00"
        lines_msg.append(f'{{"i":{i+1},"timestamp":"{ts}","sender":"A","message":"x"}}')
        lines_sc.append(f'{{"i":{i+1},"delta_vs_prior":5,"delta_vs_atmosphere":5,"primary_dim":"affection","tags":[],"rationale":""}}')
    msg.write_text("\n".join(lines_msg), encoding="utf-8")
    sc.write_text("\n".join(lines_sc), encoding="utf-8")
    df = load_scored_jsonl(sc, messages_path=msg, initial_index=50)
    assert df["relationship_index"].max() > 100, "v3 should break 100"


def test_load_scored_v2_still_clamped(tmp_path):
    msg = tmp_path / "m.jsonl"; sc = tmp_path / "s.jsonl"
    lines_msg = []; lines_sc = []
    for i in range(50):
        ts = f"2026-05-01T10:{i:02d}:00"
        lines_msg.append(f'{{"i":{i+1},"timestamp":"{ts}","sender":"A","message":"x"}}')
        lines_sc.append(f'{{"i":{i+1},"tags":[],"dimensions":{{"affection":10}},"reaction_to_prior":0,"rationale":""}}')
    msg.write_text("\n".join(lines_msg), encoding="utf-8")
    sc.write_text("\n".join(lines_sc), encoding="utf-8")
    df = load_scored_jsonl(sc, messages_path=msg, initial_index=50)
    assert df["relationship_index"].max() <= 100, "v2 should still be clamped"


def test_legacy_decay_at_tau():
    assert abs(time_decay_factor(DEFAULT_TAU_HOURS) - (1 - 1/math.e)) < 1e-9
