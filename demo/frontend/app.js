// Relationship Candlestick Lab — frontend SPA.
// Two flows: Skill (ingest existing scored.jsonl) | API (analyze fresh chat).
// Hash routing + localStorage persistence + job resume on refresh.

const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// ─── persisted form fields (api_key NEVER persisted) ───────────
const LS_FORMS   = "rcl.forms.v2";
const LS_JOB     = "rcl.lastJobId";
const LS_TF      = "rcl.lastTimeframe";
const LS_IND     = "rcl.indicators.v1";   // checkbox + params persistence
const LS_HISTORY = "rcl.history.v1";       // [{id, label, kind, scored_path, chat_path, ts, calendar_mode, initial_index, provider, model}]

// File paths often contain personal identifiers (names, IDs, etc.) that
// should NOT linger in browser storage between visits. We persist only
// non-sensitive UI state (model choice, calendar mode, batch size, etc.).
// scored-path / chat-path / api-key are intentionally NOT persisted.
const FORM_FIELDS = [
  "skill-initial-index", "skill-calendar-mode",
  "fmt",
  "provider", "model", "custom-model", "custom-baseurl",
  "api-initial-index", "batch-size", "context-window",
  "api-calendar-mode",
];

// Provider catalog: each entry knows its API protocol family + default
// base URL + a curated list of latest mainstream models. The dropdown
// always appends a "__custom__" option so the user can type ANY model id.
//
// API formats:
//   "anthropic" → Anthropic Messages API (uses anthropic SDK on the backend)
//   "openai"    → OpenAI-compatible /v1/chat/completions (works for
//                  DeepSeek/Moonshot/Qwen/Zhipu/Doubao/xAI/Gemini-compat)
const CUSTOM_MODEL = "__custom__";   // sentinel: user fills custom-model input

const PROVIDER_CONFIG = {
  anthropic: {
    label:    "Anthropic（Claude 系列）",
    api_format: "anthropic",
    base_url: "",                            // SDK uses its own default
    models: [
      { id: "claude-opus-4-7",          label: "claude-opus-4-7" },
      { id: "claude-sonnet-4-6",        label: "claude-sonnet-4-6（推荐）" },
      { id: "claude-haiku-4-5-20251001", label: "claude-haiku-4-5" },
    ],
  },
  openai: {
    label:    "OpenAI（GPT 系列）",
    api_format: "openai",
    base_url: "https://api.openai.com/v1",
    models: [
      { id: "gpt-5",       label: "gpt-5" },
      { id: "gpt-5-mini",  label: "gpt-5-mini" },
      { id: "gpt-5-nano",  label: "gpt-5-nano（最快最便宜）" },
      { id: "gpt-5.5",     label: "gpt-5.5" },
      { id: "gpt-5.4",     label: "gpt-5.4" },
    ],
  },
  deepseek: {
    label:    "DeepSeek",
    api_format: "openai",
    base_url: "https://api.deepseek.com/v1",
    models: [
      { id: "deepseek-chat",     label: "deepseek-chat（V3，推荐）" },
      { id: "deepseek-reasoner", label: "deepseek-reasoner（R1，推理）" },
    ],
  },
  google: {
    label:    "Google（Gemini）",
    api_format: "openai",                   // 走 Gemini OpenAI 兼容端点
    base_url: "https://generativelanguage.googleapis.com/v1beta/openai",
    models: [
      { id: "gemini-3-pro",    label: "gemini-3-pro" },
      { id: "gemini-3-flash",  label: "gemini-3-flash（推荐）" },
      { id: "gemini-2.5-pro",  label: "gemini-2.5-pro" },
      { id: "gemini-2.5-flash", label: "gemini-2.5-flash" },
    ],
  },
  xai: {
    label:    "xAI（Grok）",
    api_format: "openai",
    base_url: "https://api.x.ai/v1",
    models: [
      { id: "grok-4",         label: "grok-4" },
      { id: "grok-4-fast",    label: "grok-4-fast（推荐）" },
      { id: "grok-3",         label: "grok-3" },
    ],
  },
  moonshot: {
    label:    "月之暗面 Moonshot（Kimi）",
    api_format: "openai",
    base_url: "https://api.moonshot.cn/v1",
    models: [
      { id: "kimi-k2-0905-preview", label: "kimi-k2（推荐）" },
      { id: "moonshot-v1-128k",     label: "moonshot-v1-128k" },
      { id: "moonshot-v1-32k",      label: "moonshot-v1-32k" },
      { id: "moonshot-v1-8k",       label: "moonshot-v1-8k（最便宜）" },
    ],
  },
  qwen: {
    label:    "通义千问（阿里 DashScope）",
    api_format: "openai",
    base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    models: [
      { id: "qwen-max",     label: "qwen-max（推荐）" },
      { id: "qwen-plus",    label: "qwen-plus" },
      { id: "qwen-turbo",   label: "qwen-turbo（最快）" },
      { id: "qwen3-235b-a22b", label: "qwen3-235b" },
    ],
  },
  zhipu: {
    label:    "智谱 GLM",
    api_format: "openai",
    base_url: "https://open.bigmodel.cn/api/paas/v4",
    models: [
      { id: "glm-4-plus",   label: "glm-4-plus（推荐）" },
      { id: "glm-4-air",    label: "glm-4-air" },
      { id: "glm-4-flash",  label: "glm-4-flash（最便宜）" },
    ],
  },
  doubao: {
    label:    "豆包（字节火山方舟）",
    api_format: "openai",
    base_url: "https://ark.cn-beijing.volces.com/api/v3",
    models: [
      { id: "doubao-pro-256k",  label: "doubao-pro-256k（推荐）" },
      { id: "doubao-pro-32k",   label: "doubao-pro-32k" },
      { id: "doubao-lite-32k",  label: "doubao-lite-32k" },
    ],
  },
  ernie: {
    label:    "百度文心 ERNIE",
    api_format: "openai",
    base_url: "https://qianfan.baidubce.com/v2",
    models: [
      { id: "ernie-4.5-turbo-128k", label: "ernie-4.5-turbo-128k（推荐）" },
      { id: "ernie-4.5-8k",         label: "ernie-4.5-8k" },
      { id: "ernie-speed-128k",     label: "ernie-speed-128k（最便宜）" },
    ],
  },
  custom: {
    label:    "自定义（OpenAI 兼容协议）",
    api_format: "openai",
    base_url: "",
    models: [],     // 选了 custom 厂商时只能填自定义 model id + endpoint
  },
};

function loadForms() {
  try {
    const data = JSON.parse(localStorage.getItem(LS_FORMS) || "{}");
    // One-time scrub: older builds persisted file paths (which can leak
    // personal info). Strip them on load so they never reappear in inputs.
    let dirty = false;
    for (const k of ["scored-path", "chat-path", "api-key"]) {
      if (k in data) { delete data[k]; dirty = true; }
    }
    if (dirty) localStorage.setItem(LS_FORMS, JSON.stringify(data));
    for (const id of FORM_FIELDS) {
      const el = $("#" + id);
      if (el && data[id] !== undefined && data[id] !== null) el.value = data[id];
    }
  } catch (_) { /* ignore */ }
}
function saveForms() {
  const data = {};
  for (const id of FORM_FIELDS) {
    const el = $("#" + id);
    if (el) data[id] = el.value;
  }
  localStorage.setItem(LS_FORMS, JSON.stringify(data));
}
// auto-save on every change
document.addEventListener("input",  saveForms, true);
document.addEventListener("change", saveForms, true);

// ─── chart state ───────────────────────────────────────────────
let CURRENT_JOB = null;
let CURRENT_TF  = localStorage.getItem(LS_TF) || "1d";
let CURRENT_GOAL = "推进";
let CHART = null, CANDLE_SERIES = null, VOLUME_SERIES = null;
let POLL_TIMER = null;

// indicator render state — v5 native panes mean we just track series refs
let OVERLAY_SERIES = {};   // {seriesName: Series} — drawn on pane 0 (main)
let PANE_SERIES    = {};   // {paneName(MACD/RSI/KDJ): {seriesName: Series}}

// Per-bar attribution payload from /ohlc, keyed by FAKE time so the
// hover handler can look it up directly using param.time.
let BARS_BY_FAKE_TIME = new Map();

// EVEN-SPACING TIME REMAP
// active-only mode skips silent periods → real timestamps have arbitrary
// gaps. Lightweight-charts spaces bars by their NATURAL time interval
// (daily step → daily slots, weekly step → 7-day slots with 6-day visual
// gaps). To render any timeframe as TradingView-style tight bars, we
// remap every bar to a 1-day-step fake timestamp anchored at FAKE_EPOCH.
// The chart treats them as daily bars (equal spacing), and the X-axis /
// tooltip restore the real time via REAL_BY_FAKE.
const FAKE_EPOCH = 946684800;     // 2000-01-01 UTC, far from real (2020+) data
const FAKE_STEP  = 86400;          // 1 day → forces equal daily-bar spacing
let FAKE_BY_REAL = new Map();
let REAL_BY_FAKE = new Map();

function buildTimeRemap(tf, realTimes) {
  FAKE_BY_REAL = new Map();
  REAL_BY_FAKE = new Map();
  if (!realTimes.length) return;
  realTimes.forEach((rt, i) => {
    const fake = FAKE_EPOCH + i * FAKE_STEP;
    FAKE_BY_REAL.set(rt, fake);
    REAL_BY_FAKE.set(fake, rt);
  });
}
const CURRENT_FMT = (rt) => FAKE_BY_REAL.get(rt) ?? rt;

// ─── stage routing via hash ────────────────────────────────────
const STAGES = ["mode", "skill", "api", "progress", "chart"];
function showStage(name) {
  STAGES.forEach((n) => {
    const el = $(`#stage-${n}`);
    if (el) el.classList.toggle("active", n === name);
  });
  // toolbar buttons
  $("#btn-home").hidden = (name === "mode");
  $("#job-pill").hidden = !CURRENT_JOB || (name === "mode");
  if (CURRENT_JOB) $("#topbar-job-id").textContent = CURRENT_JOB;
}

function navigate(hash) {
  if (window.location.hash !== hash) window.location.hash = hash;
  else handleHash();
}

function handleHash() {
  const h = window.location.hash || "#mode-select";
  if (h === "#mode-select" || h === "#" || h === "") {
    clearPollers();
    showStage("mode");
    refreshResumeBar();
  } else if (h === "#skill") {
    clearPollers();
    showStage("skill");
  } else if (h === "#api") {
    clearPollers();
    showStage("api");
  } else if (h === "#progress") {
    showStage("progress");
    if (CURRENT_JOB) startPolling();
  } else if (h.startsWith("#chart")) {
    const m = h.match(/^#chart\/([a-z0-9]+)$/);
    if (m) CURRENT_JOB = m[1];
    if (!CURRENT_JOB) { navigate("#mode-select"); return; }
    localStorage.setItem(LS_JOB, CURRENT_JOB);
    showStage("chart");
    loadChart(CURRENT_TF);
  } else {
    navigate("#mode-select");
  }
}
window.addEventListener("hashchange", handleHash);

// ─── topbar home button ────────────────────────────────────────
$("#btn-home").addEventListener("click", () => {
  // Don't drop the job from localStorage — let resume bar offer it back.
  CURRENT_JOB = null;
  navigate("#mode-select");
});

// ─── mode card clicks ──────────────────────────────────────────
$$(".mode-card").forEach((c) => {
  c.addEventListener("click", () => {
    const t = c.dataset.target;
    navigate(t === "skill" ? "#skill" : "#api");
  });
});

// ─── GOAI judge demo: deterministic, no key, no real data ────
$("#btn-demo")?.addEventListener("click", async () => {
  const button = $("#btn-demo");
  const status = $("#demo-status");
  button.disabled = true;
  button.textContent = "正在载入证据…";
  status.textContent = "构建消息级趋势与可追溯决策上下文";
  try {
    const r = await fetch("/api/demo", { method: "POST" });
    if (!r.ok) throw new Error(await r.text());
    const job = await r.json();
    CURRENT_JOB = job.id;
    CURRENT_TF = "1d";
    rememberJob({
      id: job.id,
      kind: "demo",
      label: "GOAI 评委合成案例",
      calendar_mode: "active-only",
      initial_index: 50,
    });
    navigate(`#chart/${CURRENT_JOB}`);
  } catch (e) {
    status.textContent = "载入失败：" + (e.message || e);
    button.disabled = false;
    button.textContent = "重新载入合成示例 →";
  }
});

// ─── resume bar (last job) ─────────────────────────────────────
// ─── 历史分析 ─────────────────────────────────────────────────
function loadHistory() {
  try { return JSON.parse(localStorage.getItem(LS_HISTORY) || "[]"); }
  catch (_) { return []; }
}
function saveHistory(list) {
  localStorage.setItem(LS_HISTORY, JSON.stringify(list.slice(0, 30)));   // cap 30
}
function rememberJob(entry) {
  // entry: {id, label, kind, scored_path, calendar_mode, initial_index, ts, ...}
  const list = loadHistory().filter((e) => e.id !== entry.id);
  list.unshift({ ts: Date.now(), ...entry });
  saveHistory(list);
}
function forgetJob(id) {
  saveHistory(loadHistory().filter((e) => e.id !== id));
}

async function refreshResumeBar() {
  const list = loadHistory();
  const bar = $("#resume-bar");
  if (!list.length) { bar.hidden = true; return; }
  bar.hidden = false;
  bar.innerHTML = "";

  for (const entry of list) {
    const row = document.createElement("div");
    row.className = "history-row";
    const time = new Date(entry.ts).toLocaleString("zh-CN", { hour12: false });
    const kindIcon = entry.kind === "skill" ? "🛠️" : "🔌";
    row.innerHTML = `
      <span class="h-icon">${kindIcon}</span>
      <span class="h-label" title="${entry.scored_path || entry.chat_path || ""}">${entry.label || entry.id}</span>
      <span class="h-meta">${time}</span>
      <span class="h-id"><code>${entry.id.slice(0,8)}</code></span>
      <button class="h-open ghost small" data-id="${entry.id}">打开</button>
      <button class="h-del  ghost small" data-id="${entry.id}" title="从历史移除">×</button>
    `;
    const openBtn = row.querySelector(".h-open");
    openBtn.addEventListener("click", () => openHistoryEntry(entry, openBtn));
    row.querySelector(".h-del").addEventListener("click", () => {
      forgetJob(entry.id); refreshResumeBar();
    });
    bar.appendChild(row);
  }
}

// Per-entry in-flight guard — prevents double-clicks from spawning N
// concurrent re-ingest requests (which would each error out and bury the
// user under a stack of alert() dialogs).
const HISTORY_INFLIGHT = new Set();

async function openHistoryEntry(entry, btn) {
  if (HISTORY_INFLIGHT.has(entry.id)) return;
  HISTORY_INFLIGHT.add(entry.id);
  const originalLabel = btn ? btn.textContent : "";
  if (btn) { btn.disabled = true; btn.textContent = "加载中…"; }

  const finish = (errMsg) => {
    HISTORY_INFLIGHT.delete(entry.id);
    if (btn) {
      btn.disabled = false;
      btn.textContent = originalLabel || "打开";
    }
    if (errMsg) {
      // Show error inline next to the row, not as an alert — quiet & dismissable.
      const row = btn?.closest(".history-row");
      let slot = row?.querySelector(".h-err");
      if (!slot && row) {
        slot = document.createElement("div");
        slot.className = "h-err";
        slot.style.cssText = "grid-column: 1/-1; color: var(--err); font-size: 11px; padding: 4px 0 0; font-family: var(--font-body);";
        row.appendChild(slot);
      }
      if (slot) slot.textContent = errMsg;
    }
  };

  try {
    // First try the in-memory job (survives page reloads while server is up)
    let r;
    try {
      r = await fetch(`/api/jobs/${entry.id}`);
    } catch (e) {
      r = null;   // network error → fall through to re-ingest
    }
    if (r && r.ok) {
      const job = await r.json();
      if (job.status === "done" || (job.timeframes && job.timeframes.length)) {
        CURRENT_JOB = entry.id;
        finish(null);
        navigate(`#chart/${entry.id}`);
        return;
      }
      if (job.status === "running") {
        CURRENT_JOB = entry.id;
        finish(null);
        navigate("#progress");
        return;
      }
    }

    // Server lost the job → re-ingest from disk if we have scored_path.
    if (!entry.scored_path) {
      finish("此任务在服务器内存中已失效，且没有保存 scored.jsonl 路径。");
      return;
    }
    const r2 = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scored_path:   entry.scored_path,
        initial_index: entry.initial_index ?? 50,
        calendar_mode: entry.calendar_mode || "active-only",
      }),
    });
    if (!r2.ok) throw new Error("HTTP " + r2.status + " " + (await r2.text()).slice(0, 200));
    const job = await r2.json();
    if (job.status === "failed") throw new Error(job.error || "未知错误");
    // Re-ingested under a new id — replace history entry in place.
    forgetJob(entry.id);
    rememberJob({ ...entry, id: job.id, ts: Date.now() });
    CURRENT_JOB = job.id;
    finish(null);
    navigate(`#chart/${job.id}`);
  } catch (e) {
    const msg = String(e && e.message || e || "未知错误");
    let hint = "无法打开该任务：" + msg;
    if (/Failed to fetch/i.test(msg)) hint = "无法连接服务器，请检查后端是否在运行，并打开启动日志中显示的地址。";
    finish(hint);
  }
}

// ─── Stage 1A: Skill ingest ───────────────────────────────────
$("#btn-ingest").addEventListener("click", async () => {
  $("#skill-error").textContent = "";
  const body = {
    scored_path: $("#scored-path").value.trim().replace(/^["']|["']$/g, ""),
    initial_index: parseFloat($("#skill-initial-index").value),
    calendar_mode: $("#skill-calendar-mode").value,
  };
  if (!body.scored_path) {
    $("#skill-error").textContent = "请填写 scored.jsonl 绝对路径";
    return;
  }
  try {
    const r = await fetch("/api/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    const job = await r.json();
    if (job.status === "failed") throw new Error(job.error);
    CURRENT_JOB = job.id;
    localStorage.setItem(LS_JOB, CURRENT_JOB);
    rememberJob({
      id: job.id, kind: "skill",
      label: deriveLabelFromPath(body.scored_path),
      scored_path: body.scored_path,
      calendar_mode: body.calendar_mode,
      initial_index: body.initial_index,
    });
    navigate(`#chart/${CURRENT_JOB}`);
  } catch (e) {
    $("#skill-error").textContent = "失败: " + e.message;
  }
});

function deriveLabelFromPath(p) {
  if (!p) return "";
  // Use the parent folder name if it looks like a job folder, else basename.
  const norm = p.replace(/\\/g, "/").replace(/\/$/, "");
  const parts = norm.split("/");
  const last = parts[parts.length - 1] || "";
  const parent = parts[parts.length - 2] || "";
  if (/scored.*\.jsonl$/i.test(last) && parent) return parent;
  return last;
}

// ─── Stage 1B: API analyze ────────────────────────────────────
function rebuildProviderOptions() {
  const sel = $("#provider");
  if (!sel) return;
  const prev = sel.value;
  sel.innerHTML = "";
  for (const [key, cfg] of Object.entries(PROVIDER_CONFIG)) {
    const opt = document.createElement("option");
    opt.value = key; opt.textContent = cfg.label;
    sel.appendChild(opt);
  }
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
}

function rebuildModelOptions() {
  const provider = $("#provider").value;
  const cfg = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.custom;
  const sel = $("#model");
  const prev = sel.value;
  sel.innerHTML = "";
  for (const m of cfg.models) {
    const opt = document.createElement("option");
    opt.value = m.id; opt.textContent = m.label;
    sel.appendChild(opt);
  }
  // Always append a "custom model id" choice so the user can type any
  // model name even within a known provider.
  const customOpt = document.createElement("option");
  customOpt.value = CUSTOM_MODEL;
  customOpt.textContent = "自定义模型 ID（在下方填写）";
  sel.appendChild(customOpt);
  // Restore previous selection if still available; otherwise default to first.
  if ([...sel.options].some((o) => o.value === prev)) sel.value = prev;
  else if (provider === "custom") sel.value = CUSTOM_MODEL;
  // Custom-baseurl is only relevant for the "custom" provider; preset
  // base_url for known providers and lock by hiding the input.
  $("#custom-baseurl-label").classList.toggle("show", provider === "custom");
  if (provider !== "custom") {
    $("#custom-baseurl").value = cfg.base_url;
  }
  syncCustomModelVisibility();
}

function syncCustomModelVisibility() {
  // Show "自定义模型 ID" input whenever the model dropdown is on the
  // custom-model placeholder OR when the provider itself is custom.
  const provider = $("#provider").value;
  const modelChoice = $("#model").value;
  const show = provider === "custom" || modelChoice === CUSTOM_MODEL;
  $("#custom-model-label").classList.toggle("show", show);
}

$("#provider")?.addEventListener("change", rebuildModelOptions);
$("#model")?.addEventListener("change", syncCustomModelVisibility);

$("#btn-start-api").addEventListener("click", async () => {
  $("#api-error").textContent = "";
  const provider = $("#provider").value;
  const cfg = PROVIDER_CONFIG[provider] || PROVIDER_CONFIG.custom;
  const customModel = $("#custom-model").value.trim();
  const baseUrl     = $("#custom-baseurl").value.trim();
  const dropdownChoice = $("#model").value;
  // Resolve effective model id: dropdown's custom sentinel → use input;
  // otherwise dropdown wins, but custom input still overrides if filled.
  const modelId = (dropdownChoice === CUSTOM_MODEL || !dropdownChoice)
    ? customModel
    : (customModel || dropdownChoice);

  const body = {
    chat_path: $("#chat-path").value.trim().replace(/^["']|["']$/g, ""),
    fmt: $("#fmt").value || null,
    scorer: "api",
    provider:    provider,
    api_format:  cfg.api_format,
    model:       modelId,
    base_url:    baseUrl || cfg.base_url || null,
    api_key:     $("#api-key").value || null,
    initial_index:  parseFloat($("#api-initial-index").value),
    batch_size:     parseInt($("#batch-size").value),
    context_window: parseInt($("#context-window").value),
    calendar_mode:  $("#api-calendar-mode").value,
  };
  if (!body.chat_path) { $("#api-error").textContent = "请填写聊天文件绝对路径"; return; }
  if (!body.api_key)   { $("#api-error").textContent = "请填写 API Key"; return; }
  if (!body.model)     { $("#api-error").textContent = "请选择或在下方填写模型 ID"; return; }
  if (provider === "custom" && !body.base_url) {
    $("#api-error").textContent = "自定义厂商需要填 API Endpoint（base URL）";
    return;
  }
  try {
    const r = await fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!r.ok) throw new Error(await r.text());
    const job = await r.json();
    CURRENT_JOB = job.id;
    localStorage.setItem(LS_JOB, CURRENT_JOB);
    $("#job-id").textContent = job.id;
    rememberJob({
      id: job.id, kind: "api",
      label: deriveLabelFromPath(body.chat_path),
      chat_path: body.chat_path,
      provider: body.provider,
      model: body.model,
      calendar_mode: body.calendar_mode,
      initial_index: body.initial_index,
    });
    navigate("#progress");
  } catch (e) {
    $("#api-error").textContent = "提交失败: " + e.message;
  }
});

// ─── Stage 2: progress polling ────────────────────────────────
function clearPollers() { if (POLL_TIMER) { clearInterval(POLL_TIMER); POLL_TIMER = null; } }

function startPolling() {
  clearPollers();
  POLL_TIMER = setInterval(pollJob, 1000);
  pollJob();
}

// Stage codes from backend → human-readable Chinese
const STAGE_LABEL = {
  parsing:       "解析聊天文件",
  preprocessing: "预处理（剔单字 + 聚合 turns）",
  scoring:       "LLM 评分中",
  expanding:     "反扩展回消息级",
  aggregating:   "聚合 K 线",
  done:          "完成",
  "awaiting-skill": "等待 Skill 模式人工评分",
};

// Map common backend exceptions to friendly Chinese hints
function friendlyErrorMessage(raw) {
  const msg = String(raw || "").toLowerCase();
  if (/api[_\s-]?key|authentication|unauthorized|401/.test(msg))
    return "API Key 无效或未授权。请回上一步检查 Key 是否填对。";
  if (/connecterror|connection error|connection refused|cannot connect to proxy/.test(msg))
    return "连接失败。可能是网络问题、代理未启动，或选定的厂商在你所在地区不可访问。";
  if (/rate limit|429|too many requests/.test(msg))
    return "API 调用频率被限流，请等几分钟后重试，或把「高级设置→并发」调小。";
  if (/404|model.*not found|model_not_found|invalid model/.test(msg))
    return "模型 ID 不对或所选厂商不支持该模型。请回上一步换一个模型。";
  if (/timeout|read timed out/.test(msg))
    return "请求超时。可能是模型响应太慢或网络不稳，可以把「高级设置→批大小」调小后重试。";
  if (/no such file|filenotfound/.test(msg))
    return "聊天文件路径不存在或拼写错误，请检查绝对路径。";
  if (/insufficient.*balance|payment|quota/.test(msg))
    return "API 账户余额不足或额度已用完。请充值或换厂商。";
  return "";   // no friendly mapping → show raw
}

async function pollJob() {
  if (!CURRENT_JOB) return;
  try {
    const r = await fetch(`/api/jobs/${CURRENT_JOB}`);
    if (!r.ok) {
      clearPollers();
      renderJobError("找不到任务（服务器可能重启过）", "");
      return;
    }
    const job = await r.json();
    $("#job-id").textContent = CURRENT_JOB;
    $("#job-status").textContent = job.status === "running" ? "进行中"
                                  : job.status === "done"    ? "完成"
                                  : job.status === "failed"  ? "失败"
                                  : job.status;
    const stageName = STAGE_LABEL[job.stage] || job.stage || "—";
    $("#stage-line").innerHTML = `阶段：<code>${stageName}</code>`;
    $("#bar-fill").style.width = (job.progress * 100).toFixed(1) + "%";
    $("#bar-label").textContent = `${job.scored} / ${job.total}`;
    if (job.status === "failed") {
      clearPollers();
      const friendly = friendlyErrorMessage(job.error);
      renderJobError(friendly || "任务失败", job.error || "");
    } else if (job.status === "done") {
      clearPollers();
      // Backfill scored.jsonl path into history so this job can be re-opened
      // even after the server restarts (the file persists on disk).
      const list = loadHistory();
      const idx = list.findIndex((e) => e.id === CURRENT_JOB);
      if (idx >= 0 && !list[idx].scored_path) {
        // server.py uses output/_jobs/<jid>/scored.jsonl as the canonical path
        list[idx].scored_path = `output/_jobs/${CURRENT_JOB}/scored.jsonl`;
        saveHistory(list);
      }
      navigate(`#chart/${CURRENT_JOB}`);
    }
  } catch (e) {
    renderJobError("无法连接服务器：" + e.message, "");
  }
}

function renderJobError(headline, detail) {
  const box = $("#progress-error");
  if (!box) return;
  let html = `<div class="err-headline">${headline}</div>`;
  if (detail) {
    html += `<details class="err-detail"><summary>查看技术详情</summary>` +
            `<pre>${detail.replace(/[<>&]/g, (c) => ({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</pre></details>`;
  }
  html += `<div class="err-actions">` +
          `<a href="#api"   class="primary small">回去改设置</a>` +
          `<a href="#mode-select" class="ghost small">回首页</a>` +
          `</div>`;
  box.innerHTML = html;
}

// ─── Stage 3: chart (lightweight-charts v5 — multi-pane native) ──
function ensureChart() {
  if (CHART) return;
  const host = $("#chart");
  CHART = LightweightCharts.createChart(host, {
    layout: {
      background: { type: "solid", color: "#0e0d0c" },
      textColor: "#c2bbb0",
      fontFamily: '"DM Mono", "JetBrains Mono", "Microsoft YaHei", monospace',
      panes: { separatorColor: "#3a342c", separatorHoverColor: "#5a4f40",
               enableResize: true },
      attributionLogo: false,                    // 删 TradingView 左下角水印
    },
    grid: {
      vertLines: { color: "#2a2e39" },
      horzLines: { color: "#2a2e39" },
    },
    crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
    rightPriceScale: { borderColor: "#363a45" },
    timeScale: {
      borderColor: "#3a3025",
      // timeVisible:false stops lightweight-charts from injecting its own
      // intraday time labels — our tickMarkFormatter then truly controls
      // every tick. We compose intraday vs daily display in the formatter.
      timeVisible: false,
      secondsVisible: false,
      // Map fake time back to real for X-axis labels.
      //   • If the fake time hits one of our bars exactly → show its real date.
      //   • If it's an interpolated tick → snap to the nearest in-range fake
      //     bar (within or after our data) and show that real date.
      //   • Returning a non-empty string is critical: empty causes
      //     lightweight-charts to fall back to its default formatter, which
      //     then exposes the synthetic 2000-XX dates. We always return ours.
      tickMarkFormatter: (time) => {
        if (REAL_BY_FAKE.size === 0) return " ";
        let real = REAL_BY_FAKE.get(time);
        if (real == null) {
          let idx = Math.floor((time - FAKE_EPOCH) / FAKE_STEP);
          if (idx < 0) idx = 0;
          if (idx >= REAL_BY_FAKE.size) idx = REAL_BY_FAKE.size - 1;
          const snapped = FAKE_EPOCH + idx * FAKE_STEP;
          real = REAL_BY_FAKE.get(snapped);
          if (real == null) return " ";
        }
        const d = new Date(real * 1000);
        const yr = d.getFullYear();
        const mo = String(d.getMonth() + 1).padStart(2, "0");
        const da = String(d.getDate()).padStart(2, "0");
        const hr = String(d.getHours()).padStart(2, "0");
        const mn = String(d.getMinutes()).padStart(2, "0");
        const intraday = CURRENT_TF && !["1d","1w","1mo","1q","1y"].includes(CURRENT_TF);
        return intraday ? `${mo}/${da} ${hr}:${mn}` : `${yr}/${mo}/${da}`;
      },
    },
    autoSize: true,
  });
  // v5: addSeries(SeriesType, options, paneIndex?). paneIndex default 0.
  CANDLE_SERIES = CHART.addSeries(LightweightCharts.CandlestickSeries, {
    upColor: "#ef5350",     downColor: "#26a69a",
    borderUpColor: "#ef5350", borderDownColor: "#26a69a",
    wickUpColor: "#ef5350", wickDownColor: "#26a69a",
    priceFormat: { type: "price", precision: 2, minMove: 0.01 },
  });
  // Volume STAYS in main pane (pane 0) as overlay using its own priceScale.
  // Putting volume in a separate native v5 pane creates a visible gap +
  // separator strip between K-line and volume. The overlay trick keeps the
  // tight TradingView-style look users expect.
  CHART.priceScale("right").applyOptions({
    scaleMargins: { top: 0.05, bottom: 0.30 },
    borderColor: "#363a45",
  });
  VOLUME_SERIES = CHART.addSeries(LightweightCharts.HistogramSeries, {
    priceFormat: { type: "volume" },
    priceScaleId: "vol",
    color: "#26a69a",
  });
  CHART.priceScale("vol").applyOptions({
    scaleMargins: { top: 0.78, bottom: 0.02 },
    borderColor: "#363a45",
  });
  CHART.subscribeCrosshairMove(updateLegend);
}

// Apply pane height ratios. Sub-panes (MACD/RSI/KDJ) start at index 1
// because volume lives inside pane 0 as an overlay.
const PANE_STRETCH_MAIN  = 5;   // K-line + volume overlay
const PANE_STRETCH_STUDY = 2;   // each of MACD/RSI/KDJ

function applyDefaultPaneStretches() {
  if (!CHART) return;
  let panes;
  try { panes = CHART.panes(); } catch (_) { return; }
  if (!panes.length) return;
  for (let i = 0; i < panes.length; i++) {
    const factor = i === 0 ? PANE_STRETCH_MAIN : PANE_STRETCH_STUDY;
    try { panes[i].setStretchFactor(factor); } catch (_) {}
  }
}

// Map of v3.1 primary_dim → human-readable Chinese label.
const DIM_LABEL = {
  affection:          "亲昵",
  engagement:         "互动",
  care:               "关心",
  conflict:           "冲突",
  tension:            "暧昧张力",
  investment:         "投入",
  awkwardness:        "尴尬",
  future_orientation: "未来导向",
  vulnerability:      "脆弱袒露",
  shared_identity:    "内圈感",
};

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
  }[ch]));
}

function updateLegend(param) {
  const el = $("#legend");
  if (!param || !param.time || !param.seriesData) { el.style.display = "none"; return; }
  const c = param.seriesData.get(CANDLE_SERIES);
  const v = param.seriesData.get(VOLUME_SERIES);
  if (!c) { el.style.display = "none"; return; }
  const up = c.close >= c.open;
  const cls = up ? "up" : "down";
  const arrow = up ? "▲" : (c.close === c.open ? "—" : "▼");
  const change = c.close - c.open;
  const changePct = c.open ? (change / c.open) * 100 : 0;
  const realTime = REAL_BY_FAKE.get(param.time) ?? param.time;
  const date = new Date(realTime * 1000).toLocaleString("zh-CN", { hour12: false });

  // Per-bar attribution from cached /ohlc payload
  const bar = BARS_BY_FAKE_TIME.get(param.time) || {};
  const dims = bar.top_dims || [];
  const events = bar.top_events || [];

  let dimsHtml = "";
  if (dims.length) {
    const items = dims.map((d) => {
      const sign = d.delta >= 0 ? "+" : "";
      const dimCls = d.delta >= 0 ? "up" : "down";
      const label = DIM_LABEL[d.dim] || d.dim;
      return `<span class="dim-chip ${dimCls}">${escapeHtml(label)} ${sign}${d.delta.toFixed(2)}</span>`;
    }).join("");
    dimsHtml = `<div class="legend-section-title">主导维度</div><div class="dim-row">${items}</div>`;
  }

  let eventsHtml = "";
  if (events.length) {
    const items = events.map((e) => {
      const sign = e.delta >= 0 ? "+" : "";
      const dimCls = e.delta >= 0 ? "up" : "down";
      const label = DIM_LABEL[e.primary_dim] || e.primary_dim || "—";
      const rat = e.rationale ? ` · ${escapeHtml(e.rationale)}` : "";
      return `<div class="evt"><span class="evt-meta">${escapeHtml(e.sender)}</span> <span class="evt-msg">${escapeHtml(e.message)}</span><div class="evt-tail"><span class="dim-chip ${dimCls}">${escapeHtml(label)} ${sign}${e.delta.toFixed(2)}</span><span class="evt-rat">${rat}</span></div></div>`;
    }).join("");
    eventsHtml = `<div class="legend-section-title">关键时刻</div>${items}`;
  }

  el.style.display = "block";
  el.innerHTML = `
    <div class="row"><span class="k">时间</span><span class="v">${date}</span></div>
    <div class="row"><span class="k">涨跌</span><span class="v ${cls}">${arrow} ${change >= 0 ? "+" : ""}${change.toFixed(2)} (${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%)</span></div>
    <div class="row"><span class="k">开/收</span><span class="v ${cls}">${c.open.toFixed(2)} → ${c.close.toFixed(2)}</span></div>
    <div class="row"><span class="k">高/低</span><span class="v">${c.high.toFixed(2)} / ${c.low.toFixed(2)}</span></div>
    <div class="row"><span class="k">量</span><span class="v">${v ? v.value.toFixed(1) : "-"}${bar.msg_count != null ? `（${bar.msg_count} 条）` : ""}</span></div>
    ${dimsHtml}
    ${eventsHtml}
  `;
}

async function loadChart(tf) {
  if (!CURRENT_JOB) { navigate("#mode-select"); return; }
  ensureChart();
  CURRENT_TF = tf;
  localStorage.setItem(LS_TF, tf);
  $$(".tf").forEach((b) => b.classList.toggle("active", b.dataset.tf === tf));
  try {
    const r = await fetch(`/api/jobs/${CURRENT_JOB}/ohlc?tf=${tf}`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      $("#chart-meta").textContent = `${tf}: 0 bars`;
      CANDLE_SERIES.setData([]); VOLUME_SERIES.setData([]);
      return;
    }
    buildTimeRemap(tf, data.map((d) => d.time));
    // Cache attribution by fake time so updateLegend can reverse-lookup.
    BARS_BY_FAKE_TIME = new Map();
    for (const d of data) {
      BARS_BY_FAKE_TIME.set(CURRENT_FMT(d.time), d);
    }
    const candles = data.map((d) => ({
      time: CURRENT_FMT(d.time),
      open: d.open, high: d.high, low: d.low, close: d.close,
    }));
    // Color volume by SAME criterion as candles (close vs open),
    // not by the backend's threshold-based `direction` string —
    // otherwise small moves get a neutral-gray volume bar but a red/green candle.
    const vols = data.map((d) => ({
      time: CURRENT_FMT(d.time), value: d.volume,
      color: d.close > d.open ? "rgba(239,83,80,0.55)"     // 红
           : d.close < d.open ? "rgba(38,166,154,0.55)"     // 绿
           : "rgba(120,123,134,0.55)",                       // 完全平
    }));
    CANDLE_SERIES.setData(candles);
    VOLUME_SERIES.setData(vols);
    CHART.timeScale().fitContent();
    const last = data[data.length - 1];
    // `last.time` is always unix-sec from the backend; format for display only.
    const lastDate = new Date(last.time * 1000).toLocaleString("zh-CN", { hour12: false });
    $("#chart-meta").textContent =
      `${tf} · ${data.length} bars · 最新 ${lastDate} · close ${last.close.toFixed(2)}`;
    // Re-render indicators on top of fresh OHLC data.
    await applyIndicators();
    await loadDecisionBrief();
  } catch (e) {
    $("#chart-meta").textContent = "加载失败: " + e.message;
  }
}

function renderList(selector, items) {
  const el = $(selector);
  if (!el) return;
  el.innerHTML = (items || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

async function loadDecisionBrief() {
  if (!CURRENT_JOB) return;
  try {
    const r = await fetch(`/api/jobs/${CURRENT_JOB}/brief`);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const brief = await r.json();
    $("#decision-scope").textContent = `${brief.scope} · 当前指数 ${brief.current_index}`;
    const signals = $("#signal-grid");
    signals.innerHTML = (brief.signals || []).map((s) => `
      <div class="signal ${escapeHtml(s.tone || "")}">
        <span>${escapeHtml(s.label)}</span><b>${escapeHtml(s.value)}</b>
      </div>`).join("");
    if (!(brief.signals || []).length) signals.innerHTML = `<div class="signal neutral"><span>当前指数</span><b>${brief.current_index}</b></div>`;
    renderList("#fact-list", brief.facts);
    renderList("#inference-list", brief.inferences);
    renderList("#unknown-list", brief.unknowns);
  } catch (e) {
    $("#decision-scope").textContent = "决策简报加载失败：" + e.message;
  }
}

$$(".goal").forEach((button) => {
  button.addEventListener("click", () => {
    CURRENT_GOAL = button.dataset.goal;
    $$(".goal").forEach((b) => b.classList.toggle("active", b === button));
    $("#decision-result").hidden = true;
    $("#confirm-state").textContent = "";
  });
});

$("#btn-decision")?.addEventListener("click", async () => {
  const button = $("#btn-decision");
  button.disabled = true;
  button.textContent = "正在核对证据与边界…";
  try {
    const r = await fetch(`/api/jobs/${CURRENT_JOB}/decision`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ goal: CURRENT_GOAL }),
    });
    if (!r.ok) throw new Error(await r.text());
    const result = await r.json();
    $("#decision-headline").textContent = result.headline;
    $("#decision-message").textContent = result.message;
    renderList("#decision-reasons", result.reasons);
    $("#decision-window").textContent = result.window;
    $("#decision-stop").textContent = result.stop;
    $("#decision-result").hidden = false;
    $("#confirm-state").textContent = "";
    $("#decision-result").scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (e) {
    $("#confirm-state").textContent = "生成失败：" + e.message;
  } finally {
    button.disabled = false;
    button.textContent = "生成可逆方案";
  }
});

$("#btn-confirm")?.addEventListener("click", () => {
  $("#confirm-state").textContent = "已确认。下一步：只执行这一条消息，并按观察窗口复盘；系统不会替你发送。";
  $("#btn-confirm").textContent = "已由你确认";
  $("#btn-confirm").disabled = true;
});

$$(".tf").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!CURRENT_JOB) return;
    loadChart(btn.dataset.tf);
  });
});

// ─── indicators: spec build, fetch, render ─────────────────────

const IND_DEFS = [
  { id: "ma",   paramId: "ind-ma-periods", default: "5,10,20" },
  { id: "bb",   paramId: "ind-bb-params",  default: "20,2"    },
  { id: "macd", paramId: "ind-macd-params", default: "12,26,9" },
  { id: "rsi",  paramId: "ind-rsi-params",  default: "14"      },
  { id: "kdj",  paramId: "ind-kdj-params",  default: "9,3,3"   },
];

function loadIndState() {
  try {
    const s = JSON.parse(localStorage.getItem(LS_IND) || "{}");
    for (const def of IND_DEFS) {
      const chk = $("#ind-" + def.id);
      const inp = $("#" + def.paramId);
      if (chk && s[def.id]?.on !== undefined) chk.checked = !!s[def.id].on;
      if (inp && s[def.id]?.params)          inp.value   = s[def.id].params;
    }
  } catch (_) { /* ignore */ }
}
function saveIndState() {
  const s = {};
  for (const def of IND_DEFS) {
    const chk = $("#ind-" + def.id);
    const inp = $("#" + def.paramId);
    s[def.id] = { on: !!(chk && chk.checked),
                  params: (inp && inp.value) || def.default };
  }
  localStorage.setItem(LS_IND, JSON.stringify(s));
}

function buildSpec() {
  const parts = [];
  for (const def of IND_DEFS) {
    const chk = $("#ind-" + def.id);
    if (!chk || !chk.checked) continue;
    const inp = $("#" + def.paramId);
    const params = (inp && inp.value || def.default).trim();
    parts.push(params ? `${def.id}:${params}` : def.id);
  }
  return parts.join(";");
}

const OVERLAY_PALETTE = [
  "#f6c343", "#42a5f5", "#ab47bc", "#ef9a9a", "#26c6da",
  "#ffa726", "#9ccc65", "#7e57c2", "#ec407a", "#5c6bc0",
];

function clearOverlays() {
  for (const k of Object.keys(OVERLAY_SERIES)) {
    try { CHART.removeSeries(OVERLAY_SERIES[k]); } catch (_) {}
  }
  OVERLAY_SERIES = {};
}

// In v5, removing a pane removes all series in it AND collapses pane indices.
// We always remove from the highest index downward to keep numbering stable
// during teardown.
function clearAllSubpanes() {
  PANE_SERIES = {};
  if (!CHART) return;
  // chart.panes() returns ordered list; pane 0 is main and must NOT be removed.
  let panes;
  try { panes = CHART.panes(); } catch (_) { return; }
  for (let i = panes.length - 1; i >= 1; i--) {
    try { CHART.removePane(i); } catch (_) {}
  }
}

function addOverlayLine(name, points, color) {
  const series = CHART.addSeries(LightweightCharts.LineSeries, {
    color, lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  });
  series.setData(points
    .filter((p) => p.value !== null)
    .map((p) => ({ time: CURRENT_FMT(p.time), value: p.value })));
  OVERLAY_SERIES[name] = series;
}

function addPaneLine(paneIndex, paneName, name, points, color) {
  const series = CHART.addSeries(LightweightCharts.LineSeries, {
    color, lineWidth: 1,
    priceLineVisible: false,
    lastValueVisible: false,
    crosshairMarkerVisible: false,
  }, paneIndex);
  series.setData(points
    .filter((p) => p.value !== null)
    .map((p) => ({ time: CURRENT_FMT(p.time), value: p.value })));
  (PANE_SERIES[paneName] = PANE_SERIES[paneName] || {})[name] = series;
}

function addPaneHistogram(paneIndex, paneName, name, points) {
  const series = CHART.addSeries(LightweightCharts.HistogramSeries, {
    priceLineVisible: false,
    lastValueVisible: false,
  }, paneIndex);
  const data = points
    .filter((p) => p.value !== null)
    .map((p) => ({
      time: CURRENT_FMT(p.time), value: p.value,
      color: p.value >= 0 ? "rgba(239,83,80,0.7)" : "rgba(38,166,154,0.7)",
    }));
  series.setData(data);
  (PANE_SERIES[paneName] = PANE_SERIES[paneName] || {})[name] = series;
}

async function applyIndicators() {
  if (!CHART || !CURRENT_JOB || !CURRENT_TF) return;
  saveIndState();

  // Wipe overlays + sub-panes; rebuild from scratch each apply.
  clearOverlays();
  clearAllSubpanes();

  const spec = buildSpec();
  if (!spec) return;

  let payload;
  try {
    const url = `/api/jobs/${CURRENT_JOB}/indicators?tf=${encodeURIComponent(CURRENT_TF)}&spec=${encodeURIComponent(spec)}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error("HTTP " + r.status);
    payload = await r.json();
  } catch (e) {
    console.warn("[indicators] fetch failed:", e);
    return;
  }

  // Overlays — always pane 0 (main).
  let colorIdx = 0;
  for (const [name, points] of Object.entries(payload.overlays || {})) {
    addOverlayLine(name, points, OVERLAY_PALETTE[colorIdx % OVERLAY_PALETTE.length]);
    colorIdx++;
  }

  // Sub-panes: assign sequential pane indices 1, 2, 3 in payload order.
  // v5 auto-creates the pane on addSeries(..., paneIndex) if missing,
  // shares the time scale automatically, and lays out vertical separators.
  let nextPaneIndex = 1;
  for (const [paneName, seriesMap] of Object.entries(payload.panes || {})) {
    const idx = nextPaneIndex++;
    let i = 0;
    for (const [seriesName, points] of Object.entries(seriesMap)) {
      if (paneName === "MACD" && /HIST/i.test(seriesName)) {
        addPaneHistogram(idx, paneName, seriesName, points);
      } else {
        addPaneLine(idx, paneName, seriesName, points,
                    OVERLAY_PALETTE[i % OVERLAY_PALETTE.length]);
      }
      i++;
    }
  }
  // Re-assert pane height ratios after the layout reshuffle.
  applyDefaultPaneStretches();
}

// Wire toolbar (DOM is already parsed since this script is at end of <body>)
function wireIndicatorToolbar() {
  loadIndState();
  $("#ind-apply")?.addEventListener("click", () => applyIndicators());
  for (const def of IND_DEFS) {
    const inp = $("#" + def.paramId);
    if (inp) inp.addEventListener("keydown", (e) => {
      if (e.key === "Enter") applyIndicators();
    });
    const chk = $("#ind-" + def.id);
    if (chk) chk.addEventListener("change", () => applyIndicators());
  }
}
wireIndicatorToolbar();

// ─── boot: restore form fields, then route by hash or last job ──
rebuildProviderOptions();   // build <select id="provider"> options first
loadForms();                 // restore saved provider/model values
rebuildModelOptions();       // populate model dropdown for current provider
// loadForms ran before model options existed — re-apply the saved model id
// after rebuild so the user's last choice is preserved across reloads.
try {
  const stored = JSON.parse(localStorage.getItem(LS_FORMS) || "{}");
  if (stored.model && [...$("#model").options].some((o) => o.value === stored.model)) {
    $("#model").value = stored.model;
  }
} catch (_) { /* ignore */ }

(async function boot() {
  const h = window.location.hash;
  if (h && h !== "#" && h !== "#mode-select") {
    // Explicit hash present (e.g. user pasted #chart/<id> or refreshed on a stage)
    const m = h.match(/^#chart\/([a-z0-9]+)$/);
    if (m) {
      CURRENT_JOB = m[1];
      // Verify job still exists on the server
      try {
        const r = await fetch(`/api/jobs/${CURRENT_JOB}`);
        if (!r.ok) { CURRENT_JOB = null; navigate("#mode-select"); return; }
      } catch (_) { CURRENT_JOB = null; navigate("#mode-select"); return; }
    }
    handleHash();
    return;
  }
  // No hash: show mode select; resume bar will offer last job if available.
  navigate("#mode-select");
})();
