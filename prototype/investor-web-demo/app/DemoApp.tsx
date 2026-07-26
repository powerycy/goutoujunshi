"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

type Session = {
  token: string;
  expiresAt: number;
};

type Benefit = {
  devAnalysisRemaining?: number;
  demoOnly?: boolean;
};

type AnalysisResult = {
  emotionalGrounding?: string;
  facts?: string | string[];
  inferences?: string | string[];
  unknowns?: string | string[];
  recommendation?: string;
  reasons?: string | string[];
  nextAction?: string;
  messageDraft?: string | string[];
  observationWindow?: string;
  stopConditions?: string | string[];
  safetyNote?: string;
};

type Analysis = {
  id: string;
  status: "queued" | "running" | "delivered" | "blocked" | "failed";
  modelMode?: string;
  result?: AnalysisResult;
  errorMessage?: string;
  usage?: {
    weightedTokens: number;
    coinsEquivalent: number;
  };
};

const SESSION_KEY = "goutou-investor-session";
const POLL_DELAYS = [0, 1100, 1500, 1900, 2300, 2800];

async function request<T>(
  path: string,
  options: {
    method?: "GET" | "POST" | "DELETE";
    token?: string;
    body?: unknown;
    idempotencyKey?: string;
  } = {},
): Promise<T> {
  const response = await fetch(`/api/backend${path}`, {
    method: options.method ?? "GET",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey
        ? { "idempotency-key": options.idempotencyKey }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    code?: string;
    message?: string;
  };
  if (!response.ok) {
    const error = new Error(payload.message || "服务暂时不可用") as Error & {
      status?: number;
      code?: string;
    };
    error.status = response.status;
    error.code = payload.code;
    throw error;
  }
  return payload as T;
}

function list(values?: string | string[]) {
  const items = Array.isArray(values)
    ? values.filter((value) => typeof value === "string" && value.trim())
    : typeof values === "string" && values.trim()
      ? [values]
      : [];
  if (!items.length) return null;
  return (
    <ul>
      {items.map((value, index) => (
        <li key={`${index}-${value}`}>{value}</li>
      ))}
    </ul>
  );
}

function ResultView({ analysis }: { analysis: Analysis }) {
  const result = analysis.result;
  if (!result) return null;
  return (
    <section className="assistant-block" aria-live="polite">
      <div
        className={`assistant-head ${analysis.status === "blocked" ? "danger" : ""}`}
      >
        <Image src="/doghead-logo.png" alt="" width={30} height={30} unoptimized />
        <span>狗头军师判断</span>
        <span className="status-chip">
          {analysis.modelMode === "stepfun" ? "真实 AI 分析" : analysis.modelMode}
        </span>
      </div>
      {result.emotionalGrounding ? (
        <div className="answer-section">
          <h3>先接住你</h3>
          <p>{result.emotionalGrounding}</p>
        </div>
      ) : null}
      {result.recommendation ? (
        <p className="answer-lead">{result.recommendation}</p>
      ) : null}
      {result.reasons?.length ? (
        <div className="answer-section">
          <h3>核心判断</h3>
          {list(result.reasons)}
        </div>
      ) : null}
      {result.facts?.length ? (
        <div className="answer-section">
          <h3>已知事实</h3>
          {list(result.facts)}
        </div>
      ) : null}
      {result.inferences?.length ? (
        <div className="answer-section">
          <h3>合理推测</h3>
          {list(result.inferences)}
        </div>
      ) : null}
      {result.unknowns?.length ? (
        <div className="answer-section">
          <h3>仍需观察</h3>
          {list(result.unknowns)}
        </div>
      ) : null}
      {result.nextAction ? (
        <div className="answer-section">
          <h3>现在就做</h3>
          <p>{result.nextAction}</p>
        </div>
      ) : null}
      {result.messageDraft ? (
        <div className="answer-section">
          <h3>可以直接发</h3>
          <p className="message-draft">
            {Array.isArray(result.messageDraft)
              ? result.messageDraft.join("\n")
              : result.messageDraft}
          </p>
        </div>
      ) : null}
      {result.observationWindow ? (
        <div className="answer-section">
          <h3>观察窗口</h3>
          <p>{result.observationWindow}</p>
        </div>
      ) : null}
      {result.stopConditions?.length ? (
        <div className="answer-section">
          <h3>停止条件</h3>
          {list(result.stopConditions)}
        </div>
      ) : null}
      <p className="answer-note">
        {result.safetyNote ||
          "本内容由 AI 生成，仅用于关系决策参考，不替代心理、法律或医疗专业意见。"}
        {analysis.usage
          ? ` 本次成本折算 ${analysis.usage.weightedTokens.toLocaleString("zh-CN")} Token。`
          : ""}
      </p>
    </section>
  );
}

export default function DemoApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [accessCode, setAccessCode] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [benefit, setBenefit] = useState<Benefit | null>(null);
  const [error, setError] = useState("");
  const [adultConfirmed, setAdultConfirmed] = useState(true);
  const [sensitiveConsent, setSensitiveConsent] = useState(true);
  const [loadingStep, setLoadingStep] = useState(0);
  const pollAbort = useRef<AbortController | null>(null);

  const isRunning =
    analysis?.status === "queued" || analysis?.status === "running";
  const canSubmit =
    Boolean(session) &&
    question.trim().length >= 30 &&
    adultConfirmed &&
    sensitiveConsent &&
    !isRunning;
  const loadingLabels = useMemo(
    () => [
      "正在分清事实与推测…",
      "正在检查互惠、边界与机会成本…",
      "正在形成可执行的下一步…",
      "正在做安全与结构校验…",
    ],
    [],
  );

  useEffect(() => {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as Session;
      if (parsed.token && parsed.expiresAt > Date.now()) {
        queueMicrotask(() => setSession(parsed));
      }
      else sessionStorage.removeItem(SESSION_KEY);
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    request<Benefit>("/v1/beta/me", { token: session.token })
      .then(setBenefit)
      .catch((reason: Error & { status?: number }) => {
        if (reason.status === 401) logout();
      });
  }, [session]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = window.setInterval(
      () => setLoadingStep((step) => (step + 1) % loadingLabels.length),
      2600,
    );
    return () => window.clearInterval(interval);
  }, [isRunning, loadingLabels.length]);

  useEffect(
    () => () => {
      pollAbort.current?.abort();
    },
    [],
  );

  async function login(event: FormEvent) {
    event.preventDefault();
    if (accessCode.trim().length < 12) return;
    setLoginBusy(true);
    setLoginError("");
    try {
      const payload = await request<{
        token: string;
        expiresIn: number;
      }>("/v1/auth/web-demo", {
        method: "POST",
        body: { accessCode: accessCode.trim() },
      });
      const nextSession = {
        token: payload.token,
        expiresAt: Date.now() + payload.expiresIn * 1000,
      };
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
      setAccessCode("");
    } catch (reason) {
      setLoginError(reason instanceof Error ? reason.message : "访问失败，请重试");
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    pollAbort.current?.abort();
    sessionStorage.removeItem(SESSION_KEY);
    setSession(null);
    setBenefit(null);
    setAnalysis(null);
    setSubmittedQuestion("");
    setQuestion("");
    setDrawerOpen(false);
  }

  async function refreshBenefit(token: string) {
    const current = await request<Benefit>("/v1/beta/me", { token });
    setBenefit(current);
  }

  async function poll(token: string, analysisId: string) {
    const controller = new AbortController();
    pollAbort.current = controller;
    for (let attempt = 0; attempt < 45; attempt += 1) {
      const delay = POLL_DELAYS[Math.min(attempt, POLL_DELAYS.length - 1)];
      if (delay) await new Promise((resolve) => window.setTimeout(resolve, delay));
      if (controller.signal.aborted) return;
      const current = await request<Analysis>(`/v1/analyses/${analysisId}`, {
        token,
      });
      setAnalysis(current);
      if (
        current.status === "delivered" ||
        current.status === "blocked" ||
        current.status === "failed"
      ) {
        await refreshBenefit(token);
        return;
      }
    }
    throw new Error("分析仍在继续，请稍后重新打开本页查看");
  }

  async function submit() {
    if (!session || !canSubmit) return;
    const cleanQuestion = question.trim();
    setSubmittedQuestion(cleanQuestion);
    setQuestion("");
    setError("");
    setAnalysis({ id: "", status: "queued" });
    setLoadingStep(0);
    window.setTimeout(
      () => window.scrollTo({ top: 0, behavior: "smooth" }),
      0,
    );
    try {
      const created = await request<{
        analysisId: string;
        status: "queued";
      }>("/v1/analyses", {
        method: "POST",
        token: session.token,
        idempotencyKey: crypto.randomUUID(),
        body: {
          question: cleanQuestion,
          profile: {
            selfAlias: "我",
            targetAlias: "A",
            relationshipStage: "正在了解或相处中",
            goal: "判断最有利的下一步",
            emotionIntensity: 6,
          },
          consent: {
            adultConfirmed,
            sensitiveDataProcessing: sensitiveConsent,
          },
        },
      });
      setAnalysis({ id: created.analysisId, status: "queued" });
      await poll(session.token, created.analysisId);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "这次没有分析成功，请稍后再试";
      setError(message);
      setAnalysis((current) => ({
        id: current?.id || "",
        status: "failed",
        errorMessage: message,
      }));
      await refreshBenefit(session.token).catch(() => undefined);
    }
  }

  function newQuestion() {
    pollAbort.current?.abort();
    setAnalysis(null);
    setSubmittedQuestion("");
    setError("");
    setDrawerOpen(false);
  }

  return (
    <main className="demo-stage">
      <div className="phone-shell">
        <header className="navbar">
          <button
            className="icon-button"
            type="button"
            aria-label="打开菜单"
            onClick={() => setDrawerOpen(true)}
          >
            <span className="hamburger" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <h1 className="brand">狗头军师</h1>
          <span className="model-pill" title="服务在线" aria-label="服务在线" />
        </header>

        <div className="conversation">
          {!submittedQuestion && !analysis ? (
            <section className="hero">
              <Image
                className="hero-logo"
                src="/doghead-logo.png"
                alt="狗头军师"
                width={68}
                height={68}
                unoptimized
                priority
              />
              <h2>狗头军师，解决你的情感问题</h2>
              <p>先接住情绪，再分清事实，最后给一个现在就能执行的选择。</p>
              <div className="trust-row" aria-label="产品保障">
                <span className="trust-chip">真实阶跃模型</span>
                <span className="trust-chip">AI 生成 · 仅供参考</span>
                <span className="trust-chip">加密保存</span>
                <span className="trust-chip">有限体验额度</span>
              </div>
            </section>
          ) : null}

          {submittedQuestion ? (
            <div className="user-row">
              <div className="user-message">{submittedQuestion}</div>
            </div>
          ) : null}

          {isRunning ? (
            <section className="assistant-block" aria-live="polite">
              <div className="assistant-head">
                <Image src="/doghead-logo.png" alt="" width={30} height={30} unoptimized />
                <span>狗头军师正在判断</span>
              </div>
              <div className="loading-card">
                <div className="loading-track" aria-hidden="true">
                  <span />
                </div>
                <p className="loading-label">{loadingLabels[loadingStep]}</p>
              </div>
            </section>
          ) : null}

          {analysis?.status === "failed" ? (
            <section className="assistant-block" aria-live="assertive">
              <div className="assistant-head danger">
                <Image src="/doghead-logo.png" alt="" width={30} height={30} unoptimized />
                <span>这次没有分析成功</span>
              </div>
              <p className="answer-lead">
                {error || analysis.errorMessage || "服务暂时不可用，请稍后再试。"}
              </p>
              <button className="secondary-button" type="button" onClick={newQuestion}>
                重新提问
              </button>
            </section>
          ) : null}

          {analysis?.result ? <ResultView analysis={analysis} /> : null}
        </div>

        <div className="composer-wrap">
          <div className="composer">
            <label className="sr-only" htmlFor="relationship-question">
              描述你的关系问题
            </label>
            <textarea
              id="relationship-question"
              maxLength={4000}
              value={question}
              disabled={!session || isRunning}
              placeholder={
                session
                  ? "说说发生了什么、你最在意什么，以及你希望推进、确认、修复还是退出…"
                  : "输入投资人访问码后开始体验"
              }
              onChange={(event) => setQuestion(event.target.value)}
            />
            <div className="composer-bottom">
              <span className="composer-meta">
                {question.length} / 4000 · 至少 30 字
                <br />
                请用 A/B 代称，不填姓名、电话、地址
              </span>
              <button
                className="send-button"
                type="button"
                aria-label="提交真实 AI 分析"
                disabled={!canSubmit}
                onClick={submit}
              >
                <span className="send-arrow" aria-hidden="true" />
              </button>
            </div>
            <label className="consent-row">
              <input
                type="checkbox"
                checked={adultConfirmed && sensitiveConsent}
                onChange={(event) => {
                  setAdultConfirmed(event.target.checked);
                  setSensitiveConsent(event.target.checked);
                }}
              />
              <span>
                我已满 18 岁，并同意仅为本次 AI 分析处理我主动提交的敏感关系信息。
              </span>
            </label>
          </div>
        </div>

        {drawerOpen ? (
          <div
            className="drawer-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setDrawerOpen(false);
            }}
          >
            <aside className="drawer" aria-label="体验菜单">
              <div className="drawer-top">
                <strong>投资人体验</strong>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="关闭菜单"
                  onClick={() => setDrawerOpen(false)}
                >
                  ×
                </button>
              </div>
              <div className="drawer-section">
                <p className="drawer-kicker">剩余完整分析</p>
                <p className="quota">
                  {benefit?.devAnalysisRemaining ?? "—"} <span>次共享额度</span>
                </p>
                <p className="drawer-copy">
                  只有结果成功交付才扣除；失败、超时或安全拦截会返还预留额度。
                </p>
              </div>
              <div className="drawer-section">
                <p className="drawer-kicker">隐私与安全</p>
                <p className="drawer-copy">
                  问题与结果在服务端加密保存。请勿提交真实姓名、电话、身份证、账号或详细地址。
                </p>
                <p className="drawer-copy">
                  本产品由 AI 生成建议，不是心理治疗、医疗诊断或法律意见；遇到现实危险请优先联系可信的人与当地紧急服务。
                </p>
              </div>
              <div className="drawer-section">
                <button className="secondary-button" type="button" onClick={newQuestion}>
                  新建问题
                </button>
                <button className="secondary-button" type="button" onClick={logout}>
                  退出本次体验
                </button>
              </div>
            </aside>
          </div>
        ) : null}

        {!session ? (
          <div className="gate">
            <form className="gate-card" onSubmit={login}>
              <div className="gate-brand">
                <Image src="/doghead-logo.png" alt="" width={48} height={48} unoptimized />
                <div>
                  <strong>狗头军师</strong>
                  <span>INVESTOR PREVIEW</span>
                </div>
              </div>
              <h2>真实产品体验入口</h2>
              <p className="gate-intro">
                这不是静态样片。通过访问码后，你提交的问题会由真实阶跃模型分析，并计入受限的演示额度与成本记录。
              </p>
              <label className="field-label" htmlFor="access-code">
                投资人访问码
              </label>
              <input
                id="access-code"
                className="code-input"
                type="password"
                autoComplete="one-time-code"
                value={accessCode}
                onChange={(event) => setAccessCode(event.target.value)}
                placeholder="输入访问码"
              />
              <button
                className="primary-button"
                type="submit"
                disabled={loginBusy || accessCode.trim().length < 12}
              >
                {loginBusy ? "正在验证…" : "进入真实 Demo"}
              </button>
              {loginError ? (
                <p className="error-banner" role="alert">
                  {loginError}
                </p>
              ) : null}
              <p className="gate-note">
                访问码不会保存在网页中；服务端仅保存其不可逆摘要。会话在 4
                小时后失效，关闭标签页后本机自动清除。
              </p>
            </form>
          </div>
        ) : null}
      </div>
    </main>
  );
}
