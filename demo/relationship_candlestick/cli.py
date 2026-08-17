"""CLI — AI-only scoring (no local keyword fallback).

Subcommands:
  prepare  — parse chat → messages.jsonl (input for Skill or external scorer)
  ingest   — take a scored.jsonl → run aggregation, charts, report
  analyze  — end-to-end: parse → AI score → aggregate → output
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import List

import click

from .ai_scorer import load_scored_jsonl, write_messages_jsonl
from .ohlc import aggregate_ohlc
from .parser import parse
from .report import write_markdown_report, write_summary_json
from .charts import build_html
from .utils import ALL_TIMEFRAMES, load_config


def _resolve_timeframes(timeframe: str | None, all_tf: bool) -> List[str]:
    if all_tf:
        return ALL_TIMEFRAMES
    return [timeframe or "1d"]


def _emit_outputs(scored_df, ohlc_by_tf, out_dir, *, initial_index,
                  calendar_mode, scorer):
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    event_cols = [
        "timestamp","sender","message","event_tags",
        "flirt_score","warmth_score","engagement_score",
        "jealousy_score","care_score","invitation_score",
        "conflict_score","coldness_score","repair_score","probe_score",
        "raw_delta","relationship_index","rationale",
    ]
    event_cols = [c for c in event_cols if c in scored_df.columns]
    scored_df[event_cols].to_csv(out_dir / "relationship_events.csv", index=False)

    scored_df[["timestamp","sender","message","relationship_index","raw_delta","event_tags"]].to_csv(
        out_dir / "relationship_index_path.csv", index=False
    )

    for tf, ohlc in ohlc_by_tf.items():
        ohlc.to_csv(out_dir / f"relationship_ohlc_{tf}.csv", index=False)

    last_idx = float(scored_df["relationship_index"].iloc[-1])
    main_tf = next(iter(ohlc_by_tf))
    last_dir = ohlc_by_tf[main_tf]["direction"].iloc[-1] if not ohlc_by_tf[main_tf].empty else "neutral"
    write_summary_json(
        out_dir / "relationship_summary.json",
        initial_index=initial_index, latest_index=last_idx,
        timeframes=list(ohlc_by_tf.keys()),
        calendar_mode=calendar_mode,
        total_messages=len(scored_df),
        total_periods=sum(len(v) for v in ohlc_by_tf.values()),
        latest_direction=last_dir, scorer=scorer,
    )
    write_markdown_report(
        out_dir / "relationship_report.md",
        events_df=scored_df, ohlc_by_tf=ohlc_by_tf,
        initial_index=initial_index, calendar_mode=calendar_mode,
        scorer=scorer,
    )
    build_html(
        out_dir / "relationship_chart.html",
        events_df=scored_df, ohlc=ohlc_by_tf[main_tf], timeframe=main_tf,
    )


# ────────────── CLI ──────────────

@click.group(help="Relationship Candlestick Lab — AI-scored chat → OHLC.")
def main():
    pass


@main.command(help="Parse a chat file and emit messages.jsonl for the AI scorer / Skill.")
@click.option("--input", "input_path", required=True, type=click.Path(exists=True))
@click.option("--format", "fmt", type=click.Choice(["csv","json","txt"]))
@click.option("--output", "out_path", default="output/messages.jsonl", type=click.Path())
def prepare(input_path, fmt, out_path):
    df = parse(input_path, fmt)
    write_messages_jsonl(df, out_path)
    click.echo(f"Parsed {len(df)} messages → {out_path}")


@main.command(help="Ingest a scored.jsonl produced by Claude (Skill or API) and emit OHLC + report.")
@click.option("--scored", "scored_path", required=True, type=click.Path(exists=True))
@click.option("--config", "config_path", default=None, type=click.Path())
@click.option("--timeframe", default="1d", type=click.Choice(ALL_TIMEFRAMES))
@click.option("--all-timeframes", is_flag=True)
@click.option("--calendar-mode", default="active-only", type=click.Choice(["active-only","calendar"]))
@click.option("--initial-index", default=None, type=float)
@click.option("--output", "out_dir", default="output/demo", type=click.Path())
def ingest(scored_path, config_path, timeframe, all_timeframes,
           calendar_mode, initial_index, out_dir):
    config = load_config(config_path)
    init = initial_index if initial_index is not None else config.get("initial_index", 50)
    scored = load_scored_jsonl(scored_path)
    tfs = _resolve_timeframes(timeframe, all_timeframes)
    ohlc_by_tf = {
        tf: aggregate_ohlc(scored, tf, config, calendar_mode, init)
        for tf in tfs
    }
    _emit_outputs(scored, ohlc_by_tf, out_dir,
                  initial_index=init, calendar_mode=calendar_mode,
                  scorer="external")
    click.echo(f"Wrote outputs to {out_dir}/")


@main.command(help="End-to-end: parse → AI score → aggregate → output.")
@click.option("--input", "input_path", required=True, type=click.Path(exists=True))
@click.option("--format", "fmt", type=click.Choice(["csv","json","txt"]))
@click.option("--scorer", default="api", type=click.Choice(["api","skill"]),
              help="api=call Claude API directly; skill=emit messages.jsonl for Claude Code skill workflow.")
@click.option("--model", default="claude-sonnet-4-6", help="Anthropic model id (only when --scorer=api).")
@click.option("--batch-size", default=50, type=int, help="Messages per API call.")
@click.option("--context-window", default=30, type=int, help="Previously-scored messages shown as context per call.")
@click.option("--api-key", default=None, help="Anthropic API key (overrides ANTHROPIC_API_KEY).")
@click.option("--config", "config_path", default=None, type=click.Path())
@click.option("--timeframe", default="1d", type=click.Choice(ALL_TIMEFRAMES))
@click.option("--all-timeframes", is_flag=True)
@click.option("--calendar-mode", default="active-only", type=click.Choice(["active-only","calendar"]))
@click.option("--initial-index", default=None, type=float)
@click.option("--output", "out_dir", default="output/demo", type=click.Path())
def analyze(input_path, fmt, scorer, model, batch_size, context_window, api_key,
            config_path, timeframe, all_timeframes,
            calendar_mode, initial_index, out_dir):
    config = load_config(config_path)
    init = initial_index if initial_index is not None else config.get("initial_index", 50)

    messages_df = parse(input_path, fmt)
    out_dir_p = Path(out_dir)
    out_dir_p.mkdir(parents=True, exist_ok=True)

    if scorer == "skill":
        msg_path = out_dir_p / "messages.jsonl"
        write_messages_jsonl(messages_df, msg_path)
        click.echo(
            f"[skill mode] Wrote {len(messages_df)} messages → {msg_path}\n"
            f"  Next: in Claude Code, run /rcl-score on this file to produce "
            f"{out_dir_p / 'scored.jsonl'},\n"
            f"  then: relationship-candlestick ingest --scored {out_dir_p / 'scored.jsonl'} "
            f"--output {out_dir} --all-timeframes"
        )
        return

    # scorer == "api"
    from .api_scorer import score_with_api
    scored_path = out_dir_p / "scored.jsonl"
    scored = score_with_api(
        messages_df, scored_path,
        model=model, initial_index=init,
        batch_size=batch_size, context_window=context_window,
        api_key=api_key,
    )
    actual_scorer = f"api:{model}"

    tfs = _resolve_timeframes(timeframe, all_timeframes)
    ohlc_by_tf = {
        tf: aggregate_ohlc(scored, tf, config, calendar_mode, init)
        for tf in tfs
    }
    _emit_outputs(scored, ohlc_by_tf, out_dir,
                  initial_index=init, calendar_mode=calendar_mode,
                  scorer=actual_scorer)
    click.echo(f"Done. Outputs in {out_dir}/")


@main.command(help="Start the local web frontend (http://127.0.0.1:7000).")
@click.option("--host", default="127.0.0.1")
@click.option("--port", default=7000, type=int)
def serve(host, port):
    from .server import serve as _serve
    click.echo(f"Open http://{host}:{port} in your browser")
    _serve(host, port)


if __name__ == "__main__":
    main()
