"""Tests for the v2 scoring schema + time-decay recurrence + reciprocity
+ backward-compat with v1 legacy buckets."""
import json
import math

import pandas as pd
import pytest

from relationship_candlestick.ai_scorer import (
    DIMENSIONS, DIM_WEIGHTS, LEGACY_BUCKETS, LEGACY_WEIGHTS,
    DEFAULT_TAU_HOURS, DEFAULT_RECIP_W,
    apply_recurrence, compute_raw_delta, time_decay_factor,
    load_scored_jsonl,
)


def test_dims_complete():
    assert set(DIMENSIONS) == set(DIM_WEIGHTS.keys())


def test_compute_raw_delta_new_schema():
    e = {"dimensions": {"affection": 5, "tension": 3, "conflict": -2}}
    expected = 5*0.30 + 3*0.20 - 2*0.20
    assert abs(compute_raw_delta(e) - expected) < 1e-9


def test_compute_raw_delta_legacy_schema():
    e = {"scores": {"flirt": 4, "coldness": 2}}
    expected = 4*0.25 - 2*0.20
    assert abs(compute_raw_delta(e) - expected) < 1e-9


def test_time_decay_zero_at_zero_gap():
    assert time_decay_factor(0) == 0.0


def test_time_decay_monotonic():
    assert time_decay_factor(1) < time_decay_factor(10) < time_decay_factor(100)


def test_time_decay_at_tau():
    # at gap=tau, decay = 1 - 1/e ≈ 0.632
    assert abs(time_decay_factor(DEFAULT_TAU_HOURS) - (1 - 1/math.e)) < 1e-9


def test_recurrence_no_gap_means_no_decay():
    # gap=0 => decay=0 => index just = prev + raw_delta (clamped)
    out = apply_recurrence(70, 5, gap_hours=0)
    assert out == 75


def test_recurrence_long_gap_pulls_to_50():
    # Very long gap => decay≈1 => result dominated by 50 + raw_delta
    out = apply_recurrence(90, 0, gap_hours=10000)
    assert abs(out - 50) < 0.5


def test_recurrence_clamps():
    assert apply_recurrence(99, 100, gap_hours=0) == 100
    assert apply_recurrence(1, -100, gap_hours=0) == 0


def test_recurrence_reciprocity_amplifies_with_prior():
    # Prior was strong positive (raw=+5); current reaction +5 amplifies further.
    out = apply_recurrence(50, 0, gap_hours=0, reaction_to_prior=5, prev_raw_delta=5)
    expected = 50 + 5 * 1.0 * DEFAULT_RECIP_W   # = 50.5
    assert abs(out - expected) < 1e-9


def test_recurrence_cold_reaction_to_strong_signal_dampens():
    # Prior strong positive, current cold reaction => negative bonus.
    out = apply_recurrence(50, 0, gap_hours=0, reaction_to_prior=-5, prev_raw_delta=5)
    expected = 50 + (-5) * 1.0 * DEFAULT_RECIP_W   # = 49.5
    assert abs(out - expected) < 1e-9


def test_recurrence_no_reciprocity_when_prior_neutral():
    # Prior raw_delta=0 => sign=0 => recip=0 regardless of reaction.
    out = apply_recurrence(50, 2, gap_hours=0, reaction_to_prior=5, prev_raw_delta=0)
    assert out == 52


def test_load_scored_new_schema(tmp_path):
    msg = tmp_path / "messages.jsonl"
    sc  = tmp_path / "scored.jsonl"
    msg.write_text(
        '{"i":1,"timestamp":"2026-05-01T10:00:00","sender":"A","message":"想你了"}\n'
        '{"i":2,"timestamp":"2026-05-01T10:00:30","sender":"B","message":"我也想你"}\n',
        encoding="utf-8",
    )
    sc.write_text(
        '{"i":1,"tags":["flirt"],"dimensions":{"affection":8,"tension":2},"reaction_to_prior":0,"rationale":""}\n'
        '{"i":2,"tags":["flirt"],"dimensions":{"affection":7,"tension":1},"reaction_to_prior":4,"rationale":""}\n',
        encoding="utf-8",
    )
    df = load_scored_jsonl(sc, messages_path=msg, initial_index=50)
    assert len(df) == 2
    # First message: idx ≈ 50 + 8*0.30 + 2*0.20 = 52.8 (gap=0 => no decay, no prior)
    assert abs(df["relationship_index"].iloc[0] - 52.8) < 1e-3
    # Second: tiny gap (30s) => ~no decay; raw=7*0.30+1*0.20=2.3; reciprocity=4*sign(+)*0.10=+0.4
    expected2 = 52.8 + 2.3 + 0.4
    assert abs(df["relationship_index"].iloc[1] - expected2) < 1e-3


def test_load_scored_legacy_schema(tmp_path):
    msg = tmp_path / "messages.jsonl"
    sc  = tmp_path / "scored.jsonl"
    msg.write_text(
        '{"i":1,"timestamp":"2026-05-01T10:00:00","sender":"A","message":"想你了宝宝"}\n',
        encoding="utf-8",
    )
    sc.write_text(
        '{"i":1,"event_tags":["flirt"],"scores":{"flirt":10},"rationale":""}\n',
        encoding="utf-8",
    )
    df = load_scored_jsonl(sc, messages_path=msg, initial_index=50)
    # gap=0 => no decay; raw=10*0.25=2.5
    assert abs(df["relationship_index"].iloc[0] - 52.5) < 1e-3


def test_long_silence_decays_index(tmp_path):
    msg = tmp_path / "m.jsonl"; sc = tmp_path / "s.jsonl"
    # Two messages 10 days apart, each pushing +6 raw_delta.
    msg.write_text(
        '{"i":1,"timestamp":"2026-01-01T10:00:00","sender":"A","message":"喜欢你"}\n'
        '{"i":2,"timestamp":"2026-01-11T10:00:00","sender":"B","message":"嗯"}\n',
        encoding="utf-8",
    )
    sc.write_text(
        '{"i":1,"tags":[],"dimensions":{"affection":8},"reaction_to_prior":0,"rationale":""}\n'
        '{"i":2,"tags":[],"dimensions":{"affection":-3},"reaction_to_prior":-2,"rationale":""}\n',
        encoding="utf-8",
    )
    df = load_scored_jsonl(sc, messages_path=msg, initial_index=50)
    # 10 days = 240 hours, tau=72 → decay=1-exp(-240/72)≈0.964
    # so idx_2 ≈ 0.036 * idx_1 + 0.964 * 50 + (-3)*0.30 + recip
    assert df["relationship_index"].iloc[1] < 55  # mostly pulled back to ~50
    assert df["relationship_index"].iloc[1] > 45
