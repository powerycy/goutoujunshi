import pandas as pd
from relationship_candlestick.ohlc import aggregate_ohlc
from relationship_candlestick.utils import load_config
from _fixtures import make_scored

CFG = load_config(None)


def _intraday_path():
    # one day with: open=50, dip to 30, recover to 60 → expect lower shadow
    return make_scored([
        ("2026-05-01 09:00", "A", "早", 50),
        ("2026-05-01 12:00", "B", "嗯", 35),
        ("2026-05-01 15:00", "A", "你怎么了", 30),
        ("2026-05-01 18:00", "B", "没事啦", 55),
        ("2026-05-01 22:00", "A", "晚安", 60),
    ])


def test_ohlc_shadow_identities():
    df = _intraday_path()
    ohlc = aggregate_ohlc(df, "1d", CFG, calendar_mode="active-only")
    r = ohlc.iloc[0]
    assert r["open"] == 50 and r["close"] == 60
    assert r["high"] == 60 and r["low"] == 30
    assert r["upper_shadow"] == 60 - max(50, 60) == 0
    assert r["lower_shadow"] == min(50, 60) - 30 == 20
    assert r["body"] == abs(60 - 50) == 10
    assert r["direction"] == "bullish"


def test_active_only_skips_silence():
    df = make_scored([
        ("2026-05-01 09:00", "A", "早", 50),
        ("2026-05-04 09:00", "A", "在吗", 52),
    ])
    ohlc = aggregate_ohlc(df, "1d", CFG, calendar_mode="active-only")
    assert len(ohlc) == 2


def test_calendar_fills_silence():
    df = make_scored([
        ("2026-05-01 09:00", "A", "早", 50),
        ("2026-05-04 09:00", "A", "在吗", 52),
    ])
    ohlc = aggregate_ohlc(df, "1d", CFG, calendar_mode="calendar")
    assert len(ohlc) >= 4
    assert (ohlc["volume"] == 0).any()


def test_all_timeframes_smoke():
    df = _intraday_path()
    for tf in ["5min", "1h", "4h", "1d", "1w"]:
        ohlc = aggregate_ohlc(df, tf, CFG, calendar_mode="active-only")
        assert not ohlc.empty
