# -*- coding: utf-8 -*-
"""End-to-end TURN-based scoring pipeline (importable library form).

Used by both:
  - server.py `/api/jobs` (API mode in the web frontend)
  - scripts/score_turns_*.py (kept as thin CLI wrappers — though direct
    usage of this module is preferred for new code)

Mirrors the Skill workflow exactly:
    raw messages.jsonl
       └─ preprocess_to_turns(): trivial → auto_scored, the rest → turns
            └─ score_turns_async(): async batched LLM calls
                 └─ expand_to_scored(): turn-level → message-level scored.jsonl
"""
from __future__ import annotations

import asyncio
import json
import re
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional

URL_PATTERN = re.compile(r"^https?://\S+$")
SKILL_PATH  = Path(__file__).resolve().parent.parent / "skill" / "SKILL.md"


# ─── preprocess ─────────────────────────────────────────────────

def is_trivial(text: str) -> bool:
    text = (text or "").strip()
    if not text:        return True
    if len(text) == 1:  return True
    if URL_PATTERN.match(text): return True
    return False


def parse_ts(ts: str) -> datetime:
    if ts.endswith("Z"): ts = ts[:-1]
    return datetime.fromisoformat(ts)


def _finalize_turn(msgs: list[dict], turn_id: int) -> dict:
    text = "\n".join((m["message"] or "").rstrip("\n") for m in msgs)
    return {
        "turn_id":      turn_id,
        "sender":       msgs[0]["sender"],
        "ts_first":     msgs[0]["timestamp"],
        "ts_last":      msgs[-1]["timestamp"],
        "n_msgs":       len(msgs),
        "char_total":   sum(len(m["message"] or "") for m in msgs),
        "original_is":  [int(m["i"]) for m in msgs],
        "text":         text,
    }


def preprocess_to_turns(
    messages_jsonl: Path,
    out_dir: Path,
    gap_min: int = 10,
) -> dict:
    """Read messages.jsonl, split trivial from substantive, aggregate turns.

    Side effects: writes auto_scored.jsonl and turns.jsonl into out_dir.

    Returns: {messages_count, auto_count, substantive_count, turns_count,
              turns, auto}.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    msgs: list[dict] = []
    with messages_jsonl.open(encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line: msgs.append(json.loads(line))
    msgs.sort(key=lambda m: int(m["i"]))

    auto, substantive = [], []
    for m in msgs:
        if is_trivial(m.get("message", "")):
            auto.append({
                "i": int(m["i"]),
                "delta_vs_prior":      -0.2,
                "delta_vs_atmosphere": -0.2,
                "primary_dim":         "engagement",
                "tags":                [],
                "rationale":           "",
            })
        else:
            substantive.append(m)

    turns: list[dict] = []
    cur: list[dict] | None = None
    gap_seconds = gap_min * 60
    for m in substantive:
        if cur is None:
            cur = [m]; continue
        prev = cur[-1]
        same = (m["sender"] == prev["sender"])
        gap  = (parse_ts(m["timestamp"]) - parse_ts(prev["timestamp"])).total_seconds()
        if same and gap <= gap_seconds:
            cur.append(m)
        else:
            turns.append(_finalize_turn(cur, len(turns) + 1))
            cur = [m]
    if cur: turns.append(_finalize_turn(cur, len(turns) + 1))

    (out_dir / "auto_scored.jsonl").write_text(
        "\n".join(json.dumps(r, ensure_ascii=False) for r in auto) + ("\n" if auto else ""),
        encoding="utf-8",
    )
    (out_dir / "turns.jsonl").write_text(
        "\n".join(json.dumps(t, ensure_ascii=False) for t in turns) + ("\n" if turns else ""),
        encoding="utf-8",
    )

    return {
        "messages_count":    len(msgs),
        "auto_count":        len(auto),
        "substantive_count": len(substantive),
        "turns_count":       len(turns),
        "turns":             turns,
        "auto":              auto,
    }


# ─── scoring (multi-provider) ───────────────────────────────────

def render_batch_text(batch: list[dict]) -> str:
    lines = []
    for t in batch:
        lines.append(f"[{t['turn_id']}] {t['sender']} ({t['n_msgs']}msgs):")
        lines.append(t["text"])
        lines.append("---")
    return "\n".join(lines)


def build_user_prompt(batch: list[dict]) -> str:
    return (
        "Score each TURN below using the v3.1 schema described in the system "
        "prompt. A turn is one or more consecutive messages from the same sender "
        "concatenated with newlines — treat the whole turn as ONE event.\n\n"
        "Output ONLY one JSON object per turn, in input order, no markdown "
        "fences, no extra prose. Required fields:\n"
        '  {"turn_id": int, "delta_vs_prior": float, '
        '"delta_vs_atmosphere": float, "primary_dim": str, '
        '"tags": [str], "rationale": str}\n\n'
        f"Output exactly {len(batch)} JSONL lines.\n\n"
        "=== TURNS ===\n"
        f"{render_batch_text(batch)}"
    )


def _maybe_append(obj, batch_ids: set[int], out: list[dict]) -> None:
    if not isinstance(obj, dict): return
    tid = obj.get("turn_id")
    if tid is None or int(tid) not in batch_ids: return
    out.append({
        "turn_id":             int(tid),
        "delta_vs_prior":      float(obj.get("delta_vs_prior", 0.0)),
        "delta_vs_atmosphere": float(obj.get("delta_vs_atmosphere", 0.0)),
        "primary_dim":         str(obj.get("primary_dim", "engagement")),
        "tags":                obj.get("tags") or [],
        "rationale":           str(obj.get("rationale", "")),
    })


def parse_response(text: str, batch_ids: set[int]) -> list[dict]:
    text = text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        if "\n" in text: text = text.split("\n", 1)[1]
        if text.endswith("```"): text = text[:-3]
    out: list[dict] = []
    for line in text.splitlines():
        line = line.strip()
        if not line: continue
        try:    obj = json.loads(line)
        except: continue
        if isinstance(obj, list):
            for item in obj: _maybe_append(item, batch_ids, out)
        else:
            _maybe_append(obj, batch_ids, out)
    return out


def _format_batch_error(provider: str, model: str, batch_size: int,
                        attempts: int, elapsed: float, last_err: BaseException) -> str:
    return (
        f"{provider} batch failed: "
        f"model={model} batch_size={batch_size} attempts={attempts} elapsed={elapsed:.1f}s; "
        f"last error: {type(last_err).__name__}: {last_err}"
    )


async def _score_anthropic_batch(client, model, system_prompt, batch, semaphore,
                                  max_retries=4):
    batch_ids = {t["turn_id"] for t in batch}
    user_prompt = build_user_prompt(batch)
    delay = 2.0; last_err = None
    loop = asyncio.get_event_loop()
    started = loop.time()
    async with semaphore:
        for attempt in range(1, max_retries + 1):
            try:
                resp = await client.messages.create(
                    model=model, max_tokens=8192,
                    system=[{
                        "type": "text", "text": system_prompt,
                        "cache_control": {"type": "ephemeral"},
                    }],
                    messages=[{"role": "user", "content": user_prompt}],
                )
                text = "".join(
                    b.text for b in resp.content if getattr(b, "type", "") == "text"
                )
                return parse_response(text, batch_ids)
            except Exception as e:
                last_err = e
                await asyncio.sleep(delay); delay *= 2
        raise RuntimeError(_format_batch_error(
            "anthropic", model, len(batch), max_retries, loop.time() - started, last_err
        ))


async def _score_openai_batch(client, model, system_prompt, batch, semaphore,
                               max_retries=4, temperature=0.7):
    batch_ids = {t["turn_id"] for t in batch}
    user_prompt = build_user_prompt(batch)
    delay = 2.0; last_err = None
    loop = asyncio.get_event_loop()
    started = loop.time()
    async with semaphore:
        for attempt in range(1, max_retries + 1):
            try:
                resp = await client.chat.completions.create(
                    model=model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user",   "content": user_prompt},
                    ],
                    temperature=temperature,
                    max_tokens=8192,
                )
                text = resp.choices[0].message.content or ""
                return parse_response(text, batch_ids)
            except Exception as e:
                last_err = e
                await asyncio.sleep(delay); delay *= 2
        raise RuntimeError(_format_batch_error(
            "openai-compat", model, len(batch), max_retries, loop.time() - started, last_err
        ))


def _load_checkpoint(checkpoint_path: Path, expected_tids: set[int]) -> list[dict]:
    """Load already-scored rows from a prior run's turns_scored.jsonl.

    Only rows whose turn_id is in `expected_tids` are kept (so stale rows from
    a prior run with different preprocessing params are silently ignored).
    Duplicate turn_ids: keep the first occurrence.
    Malformed lines are skipped.
    """
    if not checkpoint_path.exists():
        return []
    seen: set[int] = set()
    out: list[dict] = []
    try:
        with checkpoint_path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    obj = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not isinstance(obj, dict):
                    continue
                tid = obj.get("turn_id")
                if tid is None:
                    continue
                try:
                    tid = int(tid)
                except (TypeError, ValueError):
                    continue
                if tid in expected_tids and tid not in seen:
                    out.append(obj)
                    seen.add(tid)
    except OSError:
        return []
    return out


async def score_turns_async(
    turns: list[dict],
    *,
    api_format: str,                 # "anthropic" | "openai"
    model: str,
    api_key: str,
    base_url: Optional[str] = None,
    batch_size: int = 50,
    concurrency: int = 5,
    timeout: float = 300.0,
    progress_cb: Optional[Callable[[int, int], None]] = None,
    checkpoint_path: Optional[Path] = None,
) -> list[dict]:
    """Score turns with batched async LLM calls.

    Resilience features:
      * If `checkpoint_path` is given, completed batches are appended to that
        file as they finish — so a crash mid-run preserves partial work.
      * On a new call with the same `checkpoint_path`, already-scored turn_ids
        are loaded and skipped, so re-running resumes from where it stopped.
      * Per-batch failures (after retries) no longer abort the whole job —
        successful batches are persisted, and a single ``RuntimeError`` is
        raised at the end summarizing the failures, so the next run can resume.

    `timeout` is the per-HTTP-request timeout in seconds. Default 300 covers
    most reasoning models (o1, deepseek-reasoner, etc.). Bump higher if you
    hit timeouts, or lower if you want to fail fast on flaky chat models.
    """
    system_prompt = SKILL_PATH.read_text(encoding="utf-8")
    total = len(turns)

    # ─── resume from checkpoint ──────────────────────────────────
    expected_tids = {int(t["turn_id"]) for t in turns}
    results: list[dict] = []
    if checkpoint_path is not None:
        results = _load_checkpoint(checkpoint_path, expected_tids)
    already_done: set[int] = {int(r["turn_id"]) for r in results}

    if progress_cb:
        progress_cb(len(already_done), total)

    remaining = [t for t in turns if int(t["turn_id"]) not in already_done]
    if not remaining:
        return results

    # ─── set up client only when there is work to do ─────────────
    if api_format == "anthropic":
        from anthropic import AsyncAnthropic
        client = AsyncAnthropic(api_key=api_key, timeout=timeout)
        batch_fn = _score_anthropic_batch
    else:                              # "openai"
        from openai import AsyncOpenAI
        import httpx
        # Bypass system proxy on Windows (Clash on 127.0.0.1:7897 etc.)
        http_client = httpx.AsyncClient(timeout=timeout, trust_env=False)
        client = AsyncOpenAI(
            api_key=api_key,
            base_url=base_url,
            timeout=timeout,
            http_client=http_client,
        )
        batch_fn = _score_openai_batch

    batches = [remaining[i:i + batch_size] for i in range(0, len(remaining), batch_size)]
    semaphore = asyncio.Semaphore(concurrency)
    write_lock = asyncio.Lock()
    completed_count = [len(already_done)]

    cp_file = None
    if checkpoint_path is not None:
        checkpoint_path.parent.mkdir(parents=True, exist_ok=True)
        cp_file = checkpoint_path.open("a", encoding="utf-8", newline="\n")

    async def task(batch):
        rows = await batch_fn(client, model, system_prompt, batch, semaphore)
        async with write_lock:
            results.extend(rows)
            if cp_file is not None:
                for r in rows:
                    cp_file.write(json.dumps(r, ensure_ascii=False) + "\n")
                cp_file.flush()
            completed_count[0] += len(batch)
            if progress_cb:
                progress_cb(completed_count[0], total)

    try:
        gather_results = await asyncio.gather(
            *[task(b) for b in batches], return_exceptions=True
        )
    finally:
        if cp_file is not None:
            try: cp_file.close()
            except Exception: pass

    failures = [r for r in gather_results if isinstance(r, BaseException)]
    if failures:
        n_total = len(batches)
        n_failed = len(failures)
        first = failures[0]
        cp_hint = (
            f" Partial results saved to {checkpoint_path}; re-run the same job to resume."
            if checkpoint_path is not None else
            " (No checkpoint path was provided, so partial results were not persisted.)"
        )
        raise RuntimeError(
            f"Scoring incomplete: {n_failed} of {n_total} batch(es) failed after retries "
            f"(model={model}, batch_size={batch_size}, timeout={timeout}s). "
            f"Successfully scored {len(results)} of {total} turns.{cp_hint} "
            f"First failure: {type(first).__name__}: {first}"
        )

    return results


# ─── expand ─────────────────────────────────────────────────────

ZERO = {
    "delta_vs_prior":      0.0,
    "delta_vs_atmosphere": 0.0,
    "primary_dim":         "engagement",
    "tags":                [],
    "rationale":           "",
}


def expand_to_scored(
    turns: list[dict],
    turns_scored: list[dict],
    autos: list[dict],
    messages: list[dict],
    out_path: Path,
) -> dict:
    score_by_turn = {int(s["turn_id"]): s for s in turns_scored}
    by_i: dict[int, dict] = {}

    for a in autos:
        i = int(a["i"])
        by_i[i] = {"i": i, **{k: a.get(k, ZERO[k]) for k in ZERO}}

    missing_turn_scores: list[int] = []
    for t in turns:
        tid = int(t["turn_id"])
        ois = [int(x) for x in t["original_is"]]
        score = score_by_turn.get(tid)
        if score is None:
            missing_turn_scores.append(tid)
            for i in ois: by_i[i] = {"i": i, **ZERO}
            continue
        first = ois[0]
        by_i[first] = {
            "i":                   first,
            "delta_vs_prior":      score["delta_vs_prior"],
            "delta_vs_atmosphere": score["delta_vs_atmosphere"],
            "primary_dim":         score["primary_dim"],
            "tags":                score["tags"],
            "rationale":           score["rationale"],
        }
        for i in ois[1:]:
            by_i[i] = {"i": i, **ZERO}

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="\n") as f:
        for i in sorted(by_i):
            f.write(json.dumps(by_i[i], ensure_ascii=False) + "\n")

    return {
        "total_i":             len(by_i),
        "missing_turn_scores": missing_turn_scores,
    }


# ─── one-shot synchronous entry (for server / threads) ──────────

def run_full_pipeline(
    messages_jsonl: Path,
    out_dir: Path,
    *,
    api_format: str,
    model: str,
    api_key: str,
    base_url: Optional[str] = None,
    batch_size: int = 50,
    concurrency: int = 5,
    gap_min: int = 10,
    timeout: float = 300.0,
    progress_cb: Optional[Callable[[str, int, int], None]] = None,
) -> Path:
    """Sync entry: preprocess → score → expand. Returns final scored.jsonl path.

    progress_cb(stage, done, total) is invoked at every milestone:
        ("preprocessing", 0, 0)
        ("preprocessing", N, N)
        ("scoring",       k, total_turns)  ← repeated as batches finish
        ("expanding",     0, 0)
        ("done",          total_turns, total_turns)
    """
    if progress_cb: progress_cb("preprocessing", 0, 0)
    pre = preprocess_to_turns(messages_jsonl, out_dir, gap_min=gap_min)
    if progress_cb:
        progress_cb("preprocessing", pre["turns_count"], pre["turns_count"])
        progress_cb("scoring",       0,                  pre["turns_count"])

    def _score_progress(done, total):
        if progress_cb: progress_cb("scoring", done, total)

    # `asyncio.run()` calls `signal.set_wakeup_fd(-1)` on close, which only
    # works in the main thread. server.py runs us in a worker thread, so
    # build/destroy the event loop manually instead.
    #
    # `turns_scored.jsonl` is now persisted incrementally inside
    # score_turns_async (one append per finished batch), so partial work
    # survives crashes and re-running with the same out_dir resumes.
    checkpoint_path = out_dir / "turns_scored.jsonl"
    loop = asyncio.new_event_loop()
    try:
        asyncio.set_event_loop(loop)
        turns_scored = loop.run_until_complete(score_turns_async(
            pre["turns"],
            api_format=api_format, model=model, api_key=api_key,
            base_url=base_url, batch_size=batch_size, concurrency=concurrency,
            timeout=timeout,
            progress_cb=_score_progress,
            checkpoint_path=checkpoint_path,
        ))
    finally:
        try: loop.close()
        except Exception: pass
        asyncio.set_event_loop(None)

    if progress_cb: progress_cb("expanding", 0, 0)
    with messages_jsonl.open(encoding="utf-8") as f:
        msgs = [json.loads(l) for l in f if l.strip()]
    out_path = out_dir / "scored.jsonl"
    expand_to_scored(pre["turns"], turns_scored, pre["auto"], msgs, out_path)

    if progress_cb:
        progress_cb("done", pre["turns_count"], pre["turns_count"])
    return out_path
