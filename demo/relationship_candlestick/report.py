"""Generate the markdown analysis report and the summary JSON."""
from __future__ import annotations

import json
from pathlib import Path
from typing import Dict, List

import pandas as pd


DISCLAIMER = (
    "本工具只分析聊天互动中的可观察信号，"
    "不判断对方真实内心，也不能预测关系结果。"
)


def write_summary_json(
    out_path: str | Path,
    *,
    initial_index: float,
    latest_index: float,
    timeframes: List[str],
    calendar_mode: str,
    total_messages: int,
    total_periods: int,
    latest_direction: str,
    scorer: str,
) -> None:
    payload = {
        "initial_index": initial_index,
        "latest_index": round(latest_index, 2),
        "generated_timeframes": timeframes,
        "calendar_mode": calendar_mode,
        "total_messages": total_messages,
        "total_periods": total_periods,
        "latest_direction": latest_direction,
        "scorer": scorer,
        "disclaimer": DISCLAIMER,
    }
    Path(out_path).write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def _top_events(events_df: pd.DataFrame, tag: str, n: int = 5) -> pd.DataFrame:
    mask = events_df["event_tags"].str.contains(tag, regex=False)
    return events_df[mask].head(n)[["timestamp", "sender", "message"]]


def write_markdown_report(
    out_path: str | Path,
    *,
    events_df: pd.DataFrame,
    ohlc_by_tf: Dict[str, pd.DataFrame],
    initial_index: float,
    calendar_mode: str,
    scorer: str,
) -> None:
    latest_index = float(events_df["relationship_index"].iloc[-1])
    latest_dir = "持平"
    main_tf = next(iter(ohlc_by_tf))
    last_bar = ohlc_by_tf[main_tf].iloc[-1]
    latest_dir = {"bullish": "上涨", "bearish": "下跌", "neutral": "走平"}[last_bar["direction"]]

    flirt_msgs   = _top_events(events_df, "flirt")
    cold_msgs    = _top_events(events_df, "cold_reply")
    conflict_msgs= _top_events(events_df, "conflict")
    repair_msgs  = _top_events(events_df, "repair")
    probe_msgs   = _top_events(events_df, "probe")

    parts = []
    parts.append("# 暧昧 K 线生成报告\n")
    parts.append("## 1. 结论先行\n")
    parts.append(f"- 最新 relationship_index：**{latest_index:.2f}**（初始 {initial_index}）")
    parts.append(f"- 最近周期方向（{main_tf}）：**{latest_dir}**")
    parts.append(f"- 主要升温事件数：flirt {len(flirt_msgs)} / repair {len(repair_msgs)}")
    parts.append(f"- 主要降温事件数：cold_reply {len(cold_msgs)} / conflict {len(conflict_msgs)}")
    parts.append(f"- 试探事件：{len(probe_msgs)} 条")
    parts.append(
        f"- 数据覆盖：{events_df['timestamp'].min()} → {events_df['timestamp'].max()}"
    )
    parts.append(f"- 已生成周期：{', '.join(ohlc_by_tf.keys())}")
    parts.append(f"- 打分来源：**{scorer}**\n")

    parts.append("## 2. 数据说明\n")
    parts.append(f"- 总消息数：{len(events_df)}")
    parts.append(f"- calendar_mode：`{calendar_mode}`（silent 周期 flat 持平 carry-forward）")
    parts.append(f"- 初始 index：{initial_index}\n")

    parts.append("## 3. 消息级指数路径说明\n")
    parts.append(
        "每条消息按 SKILL.md 的桶位规则（flirt / warmth / engagement / repair / probe / "
        "jealousy / care / invitation / coldness / conflict）打分，"
        "再用加权和得 `raw_delta`，递推得到 `relationship_index ∈ [0, 100]`。"
        "完整路径见 `relationship_index_path.csv`。\n"
    )

    parts.append("## 4. K 线生成逻辑\n")
    parts.append(
        "- **Open** = 周期内第一条 `relationship_index`\n"
        "- **High** = 周期内最高 `relationship_index`\n"
        "- **Low**  = 周期内最低 `relationship_index`\n"
        "- **Close**= 周期内最后一条 `relationship_index`\n"
        "- **upper_shadow** = `high - max(open, close)`\n"
        "- **lower_shadow** = `min(open, close) - low`\n"
        "- **body** = `|close - open|`\n"
        "- **Volume** = 消息数·1.0 + 字数·0.05 + 主开话题·2.0 + 情绪事件·3.0 + 快速回复·1.5\n\n"
        "上影线 / 下影线**不是语义判断**生成的，而是由消息级 / 小周期 `relationship_index` 路径"
        "聚合后 **机械计算** 出来的。\n"
    )

    parts.append("## 5. 主要事件摘要\n")
    for label, frame in [
        ("升温（flirt）", flirt_msgs),
        ("修复（repair）", repair_msgs),
        ("冷淡（cold_reply）", cold_msgs),
        ("冲突（conflict）", conflict_msgs),
        ("试探（probe）", probe_msgs),
    ]:
        parts.append(f"### {label}\n")
        if frame.empty:
            parts.append("（无）\n")
        else:
            parts.append("| 时间 | 发送人 | 消息 |")
            parts.append("|---|---|---|")
            for _, r in frame.iterrows():
                msg = str(r["message"]).replace("|", "\\|")[:60]
                parts.append(f"| {r['timestamp']} | {r['sender']} | {msg} |")
            parts.append("")

    parts.append("## 6. 多周期 K 线摘要\n")
    for tf, ohlc in ohlc_by_tf.items():
        parts.append(f"### {tf}\n")
        parts.append(f"- bars: {len(ohlc)}")
        if not ohlc.empty:
            parts.append(
                f"- index range: {ohlc['low'].min():.1f} → {ohlc['high'].max():.1f}"
            )
            parts.append(
                f"- 方向分布: bullish {int((ohlc['direction']=='bullish').sum())}, "
                f"bearish {int((ohlc['direction']=='bearish').sum())}, "
                f"neutral {int((ohlc['direction']=='neutral').sum())}"
            )
        parts.append("")

    parts.append("## 7. 局限性说明\n")
    parts.append(DISCLAIMER + "\n")
    parts.append(
        "- 词典/打分有偏差时，结果有偏差。可通过 `--config` 替换权重，或用 `--scorer api` 让 Claude 重打。\n"
        "- 本版本不做技术形态识别（头肩顶 / W 底 / MACD 等），仅生成可视化与可复核的 OHLC。\n"
    )

    Path(out_path).write_text("\n".join(parts), encoding="utf-8")
