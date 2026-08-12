"""FastAPI backend for the local web frontend.

Endpoints
  POST /api/demo                — load the public synthetic judge scenario
  POST /api/jobs                — start a new analysis job
  GET  /api/jobs/{id}           — job status + progress
  GET  /api/jobs/{id}/timeframes — list of computed timeframes
  GET  /api/jobs/{id}/ohlc?tf=  — OHLC data for chart
  GET  /api/jobs/{id}/events    — event markers (for tooltips)
  GET  /                         — serves the frontend SPA

Designed for single-user local use. In-memory job registry. Background
thread scores via Anthropic API and streams progress.
"""
from __future__ import annotations

import hashlib
import os
import threading
import traceback
import uuid
from pathlib import Path
from typing import Dict, Optional

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .ai_scorer import load_scored_jsonl, write_messages_jsonl
from .indicators import compute as compute_indicators
from .ohlc import aggregate_ohlc
from .parser import parse
from .utils import ALL_TIMEFRAMES, load_config


PKG_ROOT = Path(__file__).resolve().parent.parent
FRONTEND_DIR = PKG_ROOT / "frontend"
WORK_DIR = PKG_ROOT / "output" / "_jobs"
WORK_DIR.mkdir(parents=True, exist_ok=True)
DEMO_SCORED_PATH = PKG_ROOT / "examples" / "goai_demo_scored.jsonl"


# ─── job registry ─────────────────────────────────────────────────

class Job:
    def __init__(self, jid: str):
        self.id = jid
        self.status = "created"        # created | running | done | failed
        self.stage = "parsing"          # parsing | scoring | aggregating | done
        self.progress = 0.0             # 0..1
        self.scored = 0
        self.total = 0
        self.error: Optional[str] = None
        self.work_dir = WORK_DIR / jid
        self.work_dir.mkdir(parents=True, exist_ok=True)
        self.scored_path = self.work_dir / "scored.jsonl"
        self.ohlc_by_tf: Dict[str, pd.DataFrame] = {}
        self.events_df: Optional[pd.DataFrame] = None
        self.params: dict = {}

    def to_dict(self):
        return {
            "id": self.id,
            "status": self.status,
            "stage": self.stage,
            "progress": round(self.progress, 4),
            "scored": self.scored,
            "total": self.total,
            "error": self.error,
            "timeframes": list(self.ohlc_by_tf.keys()),
            "params": self.params,
        }


JOBS: Dict[str, Job] = {}
_CREATE_JOB_LOCK = threading.Lock()


# ─── request models ───────────────────────────────────────────────

class JobRequest(BaseModel):
    chat_path: str = Field(..., description="Absolute path to chat file (CSV/JSON/TXT)")
    fmt: Optional[str] = Field(None, description="csv|json|txt; auto-detect if omitted")
    scorer: str = Field("api", description="api or skill")
    # Multi-provider: provider (anthropic/openai/deepseek/...) + api_format
    # ("anthropic" or "openai") + base_url + model. base_url is optional for
    # Anthropic (SDK uses its own); required for openai-compat providers.
    provider:   str = Field("anthropic")
    api_format: str = Field("anthropic")
    model:      str = Field("claude-sonnet-4-6")
    base_url:   Optional[str] = None
    api_key:    Optional[str] = None
    initial_index: float = 50.0
    batch_size: int = 50
    context_window: int = 30        # kept for API back-compat; new pipeline ignores
    calendar_mode: str = "active-only"
    concurrency: int = 5
    gap_min:     int = 10
    timeout:     float = 300.0      # per-HTTP-request timeout in seconds


class DecisionRequest(BaseModel):
    goal: str = Field("推进", description="推进|确认|修复|退出")


# ─── job worker ───────────────────────────────────────────────────

def _run_job(job: Job, req: JobRequest):
    try:
        config = load_config(None)
        job.stage = "parsing"
        job.status = "running"

        # 1) parse
        raw = req.chat_path.strip().strip('"').strip("'")
        chat_path = Path(raw)
        if not chat_path.exists():
            raise FileNotFoundError(f"chat_path not found: {chat_path}")
        if chat_path.is_dir():
            # auto-find a single .csv / .json / .txt inside
            cands = sorted(
                [p for p in chat_path.iterdir()
                 if p.suffix.lower() in {".csv", ".json", ".txt"}]
            )
            if not cands:
                raise FileNotFoundError(
                    f"{chat_path} 是目录，但里面没找到 .csv / .json / .txt 文件"
                )
            if len(cands) > 1:
                names = ", ".join(p.name for p in cands)
                raise FileNotFoundError(
                    f"{chat_path} 里有多个候选文件 [{names}]，请填写完整文件路径"
                )
            chat_path = cands[0]
        messages_df = parse(chat_path, req.fmt)
        job.total = len(messages_df)
        write_messages_jsonl(messages_df, job.work_dir / "messages.jsonl")

        # 2) score (skill mode just stops here, user goes to /rcl-score in IDE)
        if req.scorer == "skill":
            job.stage = "awaiting-skill"
            job.status = "done"
            return

        # API mode: run the SAME turn-based pipeline the Skill path runs.
        # preprocess (剔单字+聚合 turns) → async LLM scoring → expand → aggregate.
        from .pipeline import run_full_pipeline

        def _cb(stage: str, done: int, total: int):
            job.stage    = stage
            job.scored   = done
            job.total    = total
            job.progress = (done / total) if total else 0.0

        api_key = req.api_key
        if not api_key:
            raise RuntimeError("API key is required for API mode")
        scored_path = run_full_pipeline(
            messages_jsonl=job.work_dir / "messages.jsonl",
            out_dir=job.work_dir,
            api_format=req.api_format or "anthropic",
            model=req.model,
            api_key=api_key,
            base_url=req.base_url,
            batch_size=req.batch_size,
            concurrency=req.concurrency,
            gap_min=req.gap_min,
            timeout=req.timeout,
            progress_cb=_cb,
        )

        # 3) load enriched scored.jsonl (auto-joins messages text) + aggregate
        job.stage = "aggregating"
        scored_df = load_scored_jsonl(
            scored_path,
            messages_path=job.work_dir / "messages.jsonl",
            initial_index=req.initial_index,
        )
        job.events_df = scored_df
        for tf in ALL_TIMEFRAMES:
            job.ohlc_by_tf[tf] = aggregate_ohlc(
                scored_df, tf, config,
                req.calendar_mode, req.initial_index,
            )

        job.stage = "done"
        job.status = "done"
        job.progress = 1.0
    except Exception as e:
        job.status = "failed"
        job.error = f"{type(e).__name__}: {e}\n{traceback.format_exc()}"


# ─── ingest helper for skill workflow ────────────────────────────

def _aggregate_from_scored(job: Job, scored_path: Path, calendar_mode: str, initial_index: float):
    config = load_config(None)
    scored_df = load_scored_jsonl(scored_path, initial_index=initial_index)
    job.events_df = scored_df
    job.total = len(scored_df)
    job.scored = len(scored_df)
    for tf in ALL_TIMEFRAMES:
        job.ohlc_by_tf[tf] = aggregate_ohlc(
            scored_df, tf, config, calendar_mode, initial_index
        )
    job.stage = "done"
    job.status = "done"
    job.progress = 1.0


# ─── app ──────────────────────────────────────────────────────────

app = FastAPI(title="Relationship Candlestick Lab")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:7000", "http://localhost:7000"],
    allow_credentials=False,
    allow_methods=["*"], allow_headers=["*"],
)


def _resolve_chat_path(raw: str) -> Path:
    """Apply the same chat-path resolution that `_run_job` does, but eagerly,
    so we can stat the file before computing a stable jid.

    Strips surrounding quotes/whitespace; if the path is a directory, picks
    a single .csv/.json/.txt file inside (errors if 0 or >1 candidates).
    """
    s = raw.strip().strip('"').strip("'")
    p = Path(s)
    if not p.exists():
        raise HTTPException(400, f"chat_path not found: {p}")
    p = p.resolve()
    if p.is_dir():
        cands = sorted(
            x for x in p.iterdir()
            if x.suffix.lower() in {".csv", ".json", ".txt"}
        )
        if not cands:
            raise HTTPException(400, f"{p} 是目录，但里面没找到 .csv / .json / .txt 文件")
        if len(cands) > 1:
            names = ", ".join(x.name for x in cands)
            raise HTTPException(400, f"{p} 里有多个候选文件 [{names}]，请填写完整文件路径")
        p = cands[0]
    return p


def _compute_stable_jid(req: JobRequest, chat_path: Path) -> str:
    """Deterministic 12-char job id derived from inputs that affect the score
    output. Two runs that hash to the same jid share a work_dir, which is what
    enables resume-from-checkpoint across submissions.

    Hash includes:
      * chat file fingerprint: normalized path + size + mtime (catches content
        changes without paying a full SHA over a big file)
      * api_format / provider / model / base_url (different model = different
        scores, must not contaminate)
      * gap_min (changes turn boundaries, hence turn_id assignments)

    Hash deliberately excludes:
      * api_key (rotating key shouldn't invalidate progress, and keys must
        not appear in any disk path)
      * batch_size / concurrency / timeout (perf knobs, output is identical)
      * initial_index / calendar_mode (post-scoring aggregation only)
    """
    try:
        st = chat_path.stat()
    except OSError as e:
        raise HTTPException(400, f"could not stat chat file {chat_path}: {e}")
    parts = [
        os.path.normcase(str(chat_path)),
        str(st.st_size),
        str(int(st.st_mtime)),
        req.api_format or "",
        req.provider or "",
        req.model or "",
        req.base_url or "",
        str(req.gap_min),
    ]
    key = "\x00".join(parts).encode("utf-8")
    return hashlib.sha256(key).hexdigest()[:12]


@app.post("/api/jobs")
def create_job(req: JobRequest):
    # Skill mode does no scoring server-side, so checkpoint-resume doesn't
    # apply — keep its original uuid behaviour.
    if req.scorer == "skill":
        jid = uuid.uuid4().hex[:12]
    else:
        jid = _compute_stable_jid(req, _resolve_chat_path(req.chat_path))

    # Hold the lock across the registry check + write so two concurrent
    # submits with the same jid can't both pass the "no existing job" gate
    # and double-spawn workers that would race on the same checkpoint.
    with _CREATE_JOB_LOCK:
        if req.scorer != "skill":
            existing = JOBS.get(jid)
            if existing is not None and existing.status in {"created", "running"}:
                return existing.to_dict()
        job = Job(jid)
        job.params = req.model_dump(exclude={"api_key"})
        JOBS[jid] = job

    th = threading.Thread(target=_run_job, args=(job, req), daemon=True)
    th.start()
    return job.to_dict()


@app.get("/api/jobs/{jid}")
def get_job(jid: str):
    if jid not in JOBS:
        raise HTTPException(404, "job not found")
    return JOBS[jid].to_dict()


@app.post("/api/demo")
def create_demo():
    """Load a deterministic, public synthetic scenario for judge review.

    No API key, upload, or real chat content is required. Reusing a stable id
    also keeps the demo link and automated acceptance checks deterministic.
    """
    jid = "goai-demo-v1"
    existing = JOBS.get(jid)
    if existing is not None and existing.status == "done":
        return existing.to_dict()
    if not DEMO_SCORED_PATH.exists():
        raise HTTPException(500, "demo fixture is missing")

    job = Job(jid)
    job.params = {
        "scorer": "synthetic-demo",
        "scenario": "从邀约升温、轻微冲突与修复，到明确慢节奏边界后的下一步",
        "data_scope": "公开合成数据；不包含真实聊天记录",
        "calendar_mode": "active-only",
        "initial_index": 50.0,
    }
    JOBS[jid] = job
    try:
        _aggregate_from_scored(job, DEMO_SCORED_PATH, "active-only", 50.0)
    except Exception as exc:
        job.status = "failed"
        job.error = f"{type(exc).__name__}: {exc}"
        raise HTTPException(500, job.error)
    return job.to_dict()


@app.get("/api/jobs/{jid}/brief")
def get_decision_brief(jid: str):
    job = JOBS.get(jid)
    if not job or job.events_df is None:
        raise HTTPException(404, "job not found")
    demo = jid == "goai-demo-v1"
    current_index = float(job.events_df["relationship_index"].iloc[-1])
    if not demo:
        return {
            "scope": "仅基于导入记录中的可观察互动信号",
            "current_index": round(current_index, 1),
            "signals": [],
            "facts": ["已完成消息级评分与多周期聚合。"],
            "inferences": ["趋势只描述记录内的互动变化，不等于对方真实意图。"],
            "unknowns": ["线下互动、记录之外的上下文、双方对关系的明确表述。"],
        }
    return {
        "scope": "公开合成案例 · 2026-07-01 至 2026-07-16 · 38 条消息",
        "current_index": round(current_index, 1),
        "signals": [
            {"label": "双向主动", "value": "6 次", "tone": "up"},
            {"label": "具体邀约", "value": "3 次", "tone": "up"},
            {"label": "冲突修复", "value": "1 次", "tone": "up"},
            {"label": "节奏边界", "value": "1 次", "tone": "guard"},
        ],
        "facts": [
            "对方两次明确接受邀约并给出可执行时间。",
            "一次轻微冲突后，我方具体道歉并修正；对方接受，随后再次主动开启话题。",
            "对方提出“想慢一点”后，仍主动提议周六见面。",
        ],
        "inferences": [
            "互动存在正向承接，值得继续了解；当前更重要的约束是尊重节奏，而不是急于确认关系。",
            "修复已经发生，但应通过后续一致行动验证，而不是靠一句话判定。",
        ],
        "unknowns": [
            "线下语气、肢体反馈与未记录的互动。",
            "对方是否希望关系升级，以及希望在何时定义关系。",
            "双方长期目标和边界是否兼容。",
        ],
    }


@app.post("/api/jobs/{jid}/decision")
def create_decision(jid: str, req: DecisionRequest):
    job = JOBS.get(jid)
    if not job or job.events_df is None:
        raise HTTPException(404, "job not found")
    plans = {
        "推进": {
            "headline": "接受邀约，同时把节奏边界写进下一步",
            "message": "那周六见。你说想慢一点我记得，所以不用急着给关系下定义；我挺享受现在这样认真了解彼此的节奏。",
            "reasons": ["回应对方的具体邀约", "明确尊重已表达的慢节奏边界", "只推进一次会面，不索取即时承诺"],
            "window": "发送后观察 7 天：对方是否回应、是否兑现见面、见面后是否继续双向发起。",
            "stop": "若连续两次邀约都由你单向推动，或对方再次明确不希望推进，就停止升级并回到普通联系。",
        },
        "确认": {
            "headline": "先确认边界，不逼问身份",
            "message": "我想确认一下节奏：我们先继续约会、认真了解，但暂时不急着定义关系，这样对你舒服吗？",
            "reasons": ["把模糊焦虑转成可回答的问题", "询问相处方式而不是逼迫承诺", "允许对方明确不同意"],
            "window": "给对方 48 小时自然回应，不连续追问。",
            "stop": "若对方回避两次或明确表示只想做朋友，就接受边界并停止关系确认。",
        },
        "修复": {
            "headline": "承认具体影响，并给出可验证修正",
            "message": "上次我替你做决定让你不舒服，这点是我的问题。以后涉及你的安排我会先问，不替你下结论；你也可以随时提醒我。",
            "reasons": ["只为自己的行为负责", "说明具体修正，不索取原谅", "把控制权还给对方"],
            "window": "观察接下来两次互动中，自己是否真的先询问、再行动。",
            "stop": "若同类越界再次发生，暂停推进并优先处理相处边界。",
        },
        "退出": {
            "headline": "清楚结束投入，保留尊重",
            "message": "谢谢这段时间的相处。我发现自己的期待和现在的节奏不太一致，所以我想先停在这里，不再继续推进。祝你接下来顺利。",
            "reasons": ["表达自己的决定，不归因攻击", "不给虚假希望", "避免继续消耗双方"],
            "window": "发出后不追加解释；如有必要，只处理一次善后信息。",
            "stop": "不以试探、冷处理或反复撤回来换取对方追问。",
        },
    }
    goal = req.goal if req.goal in plans else "推进"
    return {
        "goal": goal,
        "human_confirmation_required": True,
        "trace": ["公开合成消息", "消息级相对评分", "日线趋势与关键事件", "事实/推断/未知分层", "目标与可逆性约束"],
        **plans[goal],
    }


class IngestRequest(BaseModel):
    scored_path: str
    calendar_mode: str = "active-only"
    initial_index: float = 50.0


@app.post("/api/ingest")
def ingest_scored(req: IngestRequest):
    """For skill mode: user provides path to a scored.jsonl produced externally."""
    p = Path(req.scored_path)
    if not p.exists():
        raise HTTPException(400, f"scored file not found: {p}")
    jid = uuid.uuid4().hex[:12]
    job = Job(jid)
    job.params = {"scorer": "ingest", "scored_path": str(p)}
    JOBS[jid] = job
    try:
        _aggregate_from_scored(job, p, req.calendar_mode, req.initial_index)
    except Exception as e:
        job.status = "failed"
        job.error = f"{type(e).__name__}: {e}"
    return job.to_dict()


@app.get("/api/jobs/{jid}/ohlc")
def get_ohlc(jid: str, tf: str = Query(..., description="timeframe e.g. 1d")):
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404)
    if tf not in job.ohlc_by_tf:
        raise HTTPException(404, f"timeframe {tf} not computed")
    df = job.ohlc_by_tf[tf]
    out = []
    for _, r in df.iterrows():
        # lightweight-charts expects { time: unixSeconds, open, high, low, close, value (volume) }
        out.append({
            "time": int(pd.Timestamp(r["period_start"]).timestamp()),
            "open": float(r["open"]),
            "high": float(r["high"]),
            "low":  float(r["low"]),
            "close":float(r["close"]),
            "volume": float(r["volume"]),
            "msg_count": int(r["message_count"]),
            "event_count": int(r["event_count"]),
            "direction": r["direction"],
            "change":     float(r["change"])     if "change"     in r else 0.0,
            "change_pct": float(r["change_pct"]) if "change_pct" in r else 0.0,
            # Per-bar attribution for the hover tooltip.
            "top_dims":   list(r["top_dims"])    if "top_dims"   in r and isinstance(r["top_dims"],   list) else [],
            "top_events": list(r["top_events"])  if "top_events" in r and isinstance(r["top_events"], list) else [],
        })
    return out


@app.get("/api/jobs/{jid}/events")
def get_events(jid: str):
    job = JOBS.get(jid)
    if not job or job.events_df is None:
        raise HTTPException(404)
    df = job.events_df
    out = []
    for _, r in df.iterrows():
        out.append({
            "time": int(pd.Timestamp(r["timestamp"]).timestamp()),
            "sender": r["sender"],
            "message": str(r["message"])[:200],
            "tags": str(r["event_tags"]),
            "index": float(r["relationship_index"]),
            "rationale": str(r.get("rationale", "")),
        })
    return out


@app.get("/api/jobs/{jid}/indicators")
def get_indicators(
    jid: str,
    tf: str = Query(..., description="timeframe e.g. 1d"),
    spec: str = Query(
        "",
        description=(
            "compact spec, e.g. 'ma:5,10,20;bb:20,2;macd;rsi:14;kdj'. "
            "Empty returns no indicators."
        ),
    ),
):
    job = JOBS.get(jid)
    if not job:
        raise HTTPException(404)
    if tf not in job.ohlc_by_tf:
        raise HTTPException(404, f"timeframe {tf} not computed")
    df = job.ohlc_by_tf[tf]
    return compute_indicators(df, spec)


# ─── static frontend ──────────────────────────────────────────────

if FRONTEND_DIR.exists():
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

    @app.get("/")
    def root():
        return FileResponse(str(FRONTEND_DIR / "index.html"))


def serve(host: str = "127.0.0.1", port: int = 7000):
    import uvicorn
    uvicorn.run(app, host=host, port=port, log_level="info")
