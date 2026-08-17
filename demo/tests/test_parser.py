from pathlib import Path
import pytest
from relationship_candlestick.parser import parse

EX = Path(__file__).resolve().parent.parent / "examples"

def test_parse_csv():
    df = parse(EX / "sample_chat.csv")
    assert len(df) > 50
    assert set(df.columns) >= {"timestamp", "sender", "message"}
    assert df["timestamp"].is_monotonic_increasing

def test_parse_json():
    df = parse(EX / "sample_chat.json")
    assert len(df) == 9
    assert df.iloc[-1]["message"] == "我也喜欢你"

def test_parse_txt():
    df = parse(EX / "sample_chat.txt")
    assert len(df) == 9
    assert df.iloc[0]["sender"] == "A"

def test_parse_csv_wechat_v2(tmp_path):
    p = tmp_path / "wx.csv"
    p.write_text(
        "id,MsgSvrID,type_name,is_sender,talker,msg,src,CreateTime\n"
        "1,1001,文本,1,abc,在吗,,2025-03-01 14:23:11\n"
        "2,1002,文本,0,小红,在的,,2025-03-01 14:24:00\n"
        "3,1003,图片,0,小红,[图片],,2025-03-01 14:25:00\n"
        "4,1004,文本,1,abc,吃了吗,,2025-03-01 14:26:00\n",
        encoding="utf-8",
    )
    df = parse(p)
    assert len(df) == 3
    assert list(df["sender"]) == ["me", "小红", "me"]
    assert df.iloc[0]["message"] == "在吗"


def test_parse_csv_aliases(tmp_path):
    p = tmp_path / "aliased.csv"
    p.write_text(
        "time,from,text\n"
        "2025-03-01 10:00:00,me,hi\n"
        "2025-03-01 10:01:00,her,hello\n",
        encoding="utf-8",
    )
    df = parse(p)
    assert len(df) == 2
    assert df.iloc[1]["sender"] == "her"


def test_parse_csv_missing_cols(tmp_path):
    p = tmp_path / "bad.csv"
    p.write_text("foo,bar\n1,2\n", encoding="utf-8")
    with pytest.raises(ValueError, match="missing required columns"):
        parse(p)


def test_parse_csv_gbk(tmp_path):
    p = tmp_path / "gbk.csv"
    p.write_bytes(
        ("id,MsgSvrID,type_name,is_sender,talker,msg,src,CreateTime\n"
         "1,1001,文本,1,abc,你今天在干嘛,,2025-03-01 14:23:11\n"
         "2,1002,文本,0,小红,在写代码,,2025-03-01 14:24:00\n"
        ).encode("gb18030")
    )
    df = parse(p)
    assert len(df) == 2
    assert df.iloc[1]["message"] == "在写代码"


def test_parse_txt_bad(tmp_path):
    p = tmp_path / "bad.txt"
    p.write_text("this is not a chat line\n", encoding="utf-8")
    with pytest.raises(ValueError):
        parse(p)
