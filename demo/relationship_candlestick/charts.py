"""Build a self-contained Plotly HTML chart: index path + candles + volume + events."""
from __future__ import annotations

from pathlib import Path
from typing import Dict

import pandas as pd


def _build_html_matplotlib(out_path, *, events_df, ohlc, timeframe):
    """Plotly fallback: render with matplotlib, embed PNG into self-contained HTML."""
    import base64, io
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt
    import matplotlib.dates as mdates
    from matplotlib.patches import Rectangle
    import numpy as np
    import pandas as pd

    events_df = events_df.copy()
    events_df["timestamp"] = pd.to_datetime(events_df["timestamp"])
    ohlc = ohlc.copy()
    ohlc["period_start"] = pd.to_datetime(ohlc["period_start"])

    fig, axes = plt.subplots(
        3, 1, figsize=(14, 10), sharex=True,
        gridspec_kw={"height_ratios": [3, 4, 1.2], "hspace": 0.08},
    )
    ax_idx, ax_k, ax_vol = axes

    # 1) index path + event markers
    ax_idx.plot(events_df["timestamp"], events_df["relationship_index"],
                color="#444", linewidth=1.0, label="relationship_index")
    ax_idx.set_ylim(0, 100)
    ax_idx.set_ylabel("index")
    ax_idx.set_title(f"Relationship Candlestick Lab — {timeframe}")
    ax_idx.grid(True, alpha=0.3)
    ax_idx.axhline(50, color="#bbb", linestyle="--", linewidth=0.7)

    palette = {"flirt":"#ff66aa","intimacy":"#ff99cc","jealousy":"#cc66ff",
               "invitation":"#33ccff","repair":"#66cc99","probe":"#ffaa33",
               "conflict":"#cc3333","cold_reply":"#888888"}
    for tag, color in palette.items():
        sub = events_df[events_df["event_tags"].astype(str).str.contains(tag, regex=False)]
        if sub.empty:
            continue
        ax_idx.scatter(sub["timestamp"], sub["relationship_index"],
                       s=22, color=color, edgecolors="#222", linewidths=0.4,
                       label=tag, zorder=3)
    ax_idx.legend(loc="upper left", fontsize=8, ncol=4)

    # 2) candlesticks
    if not ohlc.empty:
        # bar width: half the median gap between bars
        if len(ohlc) > 1:
            gaps = np.diff(mdates.date2num(ohlc["period_start"]))
            width = float(np.median(gaps)) * 0.7
        else:
            width = 0.6
        for _, r in ohlc.iterrows():
            x = mdates.date2num(r["period_start"])
            color = "#cc3333" if r["close"] >= r["open"] else "#33aa66"
            # wick
            ax_k.vlines(x, r["low"], r["high"], color=color, linewidth=1.0)
            # body
            y = min(r["open"], r["close"])
            h = max(abs(r["close"] - r["open"]), 0.2)
            ax_k.add_patch(Rectangle((x - width / 2, y), width, h,
                                      facecolor=color, edgecolor=color, alpha=0.9))
        ax_k.set_ylim(0, 100)
        ax_k.set_ylabel("OHLC")
        ax_k.grid(True, alpha=0.3)

        # 3) volume
        bar_colors = ["#cc3333" if d == "bullish" else "#33aa66" if d == "bearish" else "#888"
                      for d in ohlc["direction"]]
        ax_vol.bar(mdates.date2num(ohlc["period_start"]), ohlc["volume"],
                   width=width, color=bar_colors, align="center")
        ax_vol.set_ylabel("vol")
        ax_vol.grid(True, alpha=0.3)

    ax_vol.xaxis.set_major_locator(mdates.AutoDateLocator())
    ax_vol.xaxis.set_major_formatter(mdates.DateFormatter("%m-%d %H:%M"))
    fig.autofmt_xdate()

    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=130, bbox_inches="tight")
    plt.close(fig)
    img_b64 = base64.b64encode(buf.getvalue()).decode("ascii")

    Path(out_path).write_text(
        f"""<!doctype html><html><head><meta charset="utf-8">
<title>Relationship Candlestick — {timeframe}</title>
<style>body{{font-family:sans-serif;margin:24px;background:#fafafa}}
img{{max-width:100%;height:auto;box-shadow:0 2px 8px rgba(0,0,0,.1);background:#fff}}
.note{{color:#666;font-size:12px;margin-top:8px}}</style></head>
<body><h2>Relationship Candlestick — {timeframe}</h2>
<img src="data:image/png;base64,{img_b64}">
<p class="note">Rendered with matplotlib (plotly not installed). PNG is embedded — file is fully self-contained.</p>
</body></html>""",
        encoding="utf-8",
    )


_EVENT_COLORS = {
    "flirt":     "#ff66aa",
    "intimacy":  "#ff99cc",
    "jealousy":  "#cc66ff",
    "invitation":"#33ccff",
    "repair":    "#66cc99",
    "probe":     "#ffaa33",
    "conflict":  "#cc3333",
    "cold_reply":"#888888",
}


def build_html(
    out_path: str | Path,
    *,
    events_df: pd.DataFrame,
    ohlc: pd.DataFrame,
    timeframe: str,
) -> None:
    try:
        import plotly.graph_objects as go
        from plotly.subplots import make_subplots
    except ImportError:
        _build_html_matplotlib(out_path, events_df=events_df, ohlc=ohlc, timeframe=timeframe)
        return
    fig = make_subplots(
        rows=3, cols=1, shared_xaxes=True,
        row_heights=[0.45, 0.40, 0.15], vertical_spacing=0.04,
        subplot_titles=("Relationship Index 路径与事件", f"K 线（{timeframe}）", "Volume"),
    )

    # 1) Index path with event markers.
    fig.add_trace(
        go.Scatter(
            x=events_df["timestamp"], y=events_df["relationship_index"],
            mode="lines", line=dict(color="#444", width=1.5),
            name="relationship_index",
            hovertemplate="%{x}<br>index=%{y:.2f}<extra></extra>",
        ),
        row=1, col=1,
    )
    for tag, color in _EVENT_COLORS.items():
        mask = events_df["event_tags"].str.contains(tag, regex=False)
        sub = events_df[mask]
        if sub.empty:
            continue
        fig.add_trace(
            go.Scatter(
                x=sub["timestamp"], y=sub["relationship_index"],
                mode="markers", marker=dict(size=8, color=color, line=dict(width=0.5, color="#222")),
                name=tag,
                text=sub["message"].str.slice(0, 40),
                hovertemplate="%{x}<br>%{text}<br>index=%{y:.2f}<extra>"+tag+"</extra>",
            ),
            row=1, col=1,
        )

    # 2) Candles.
    if not ohlc.empty:
        fig.add_trace(
            go.Candlestick(
                x=ohlc["period_start"],
                open=ohlc["open"], high=ohlc["high"],
                low=ohlc["low"],   close=ohlc["close"],
                increasing_line_color="#cc3333", decreasing_line_color="#33aa66",
                name="OHLC",
            ),
            row=2, col=1,
        )
        # 3) Volume.
        colors = ["#cc3333" if d == "bullish" else "#33aa66" if d == "bearish" else "#888"
                  for d in ohlc["direction"]]
        fig.add_trace(
            go.Bar(x=ohlc["period_start"], y=ohlc["volume"], marker_color=colors, name="volume"),
            row=3, col=1,
        )

    fig.update_layout(
        title=f"Relationship Candlestick Lab — {timeframe}",
        xaxis_rangeslider_visible=False,
        height=900, template="plotly_white",
        legend=dict(orientation="h", y=-0.05),
    )
    fig.update_yaxes(range=[0, 100], row=1, col=1, title="index")
    fig.update_yaxes(range=[0, 100], row=2, col=1, title="OHLC")
    fig.update_yaxes(title="vol",     row=3, col=1)

    Path(out_path).write_text(
        fig.to_html(include_plotlyjs="inline", full_html=True),
        encoding="utf-8",
    )
