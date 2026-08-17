from relationship_candlestick.volume import compute_period_volume
from relationship_candlestick.utils import load_config
from _fixtures import make_scored

CFG = load_config(None)


def test_volume_positive_and_components():
    df = make_scored([
        ("2026-05-01 10:00:00", "A", "想你了宝宝喜欢你", 55),
        ("2026-05-01 10:00:30", "B", "我也想你", 60),
    ])
    v = compute_period_volume(df, CFG["volume"])
    # at minimum: 2 messages * 1.0 + chars * 0.05
    assert v >= 2 + 12 * 0.05
