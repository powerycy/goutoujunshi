from relationship_candlestick.ohlc import aggregate_ohlc
from relationship_candlestick.utils import load_config
from _fixtures import make_scored

CFG = load_config(None)


def _df():
    return make_scored([
        ("2026-05-01 10:00", "A", "早", 60),
        ("2026-05-04 10:00", "A", "想你", 65),
    ])


def test_silence_flat_keeps_close():
    ohlc = aggregate_ohlc(_df(), "1d", CFG, calendar_mode="calendar")
    silent = ohlc[ohlc["volume"] == 0]
    assert not silent.empty
    for _, r in silent.iterrows():
        assert r["open"] == r["close"]
