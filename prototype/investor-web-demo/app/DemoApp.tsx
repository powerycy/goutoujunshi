"use client";

import Image from "next/image";
import {
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

type Session = {
  token: string;
  expiresAt: number;
};

type Benefit = {
  devAnalysisRemaining?: number;
  purchaseRecords?: Array<{
    packageId: string;
    displayedPriceFen: number;
    createdAt: string;
  }>;
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
  result?: AnalysisResult;
  errorMessage?: string;
  createdAt?: string;
  profile?: {
    targetAlias?: string;
    goal?: string;
  };
};

type Screen = "home" | "me" | "pricing" | "history" | "result";

const SESSION_KEY = "goutou-mobile-demo-session-v2";
const POLL_DELAYS = [0, 1100, 1500, 1900, 2300, 2800];
const PACKAGES = [
  { id: "cny_1", price: 1, coins: 10, label: "首充限定" },
  { id: "cny_6", price: 6, coins: 30, label: "单题补给" },
  { id: "cny_12", price: 12, coins: 75, label: "持续跟进" },
];

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

function textList(values?: string | string[]) {
  if (Array.isArray(values)) {
    return values.filter(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
  }
  return typeof values === "string" && values.trim() ? [values] : [];
}

function AnswerItems({ values }: { values?: string | string[] }) {
  const items = textList(values);
  if (!items.length) return null;
  return (
    <div className="answer-items">
      {items.map((item, index) => (
        <p key={`${index}-${item}`}>{item}</p>
      ))}
    </div>
  );
}

function ResultContent({
  analysis,
  detailed = false,
}: {
  analysis: Analysis;
  detailed?: boolean;
}) {
  const result = analysis.result;
  if (!result) return null;
  if (analysis.status === "blocked") {
    return (
      <section className="assistant-block result-content">
        <div className="assistant-head danger">
          <Image
            src="/doghead-logo.png"
            alt=""
            width={22}
            height={22}
            unoptimized
          />
          <span>先处理现实安全</span>
        </div>
        <p className="answer-copy">{result.emotionalGrounding}</p>
        <div className="answer-section">
          <h3>现在先做</h3>
          <AnswerItems values={result.facts} />
        </div>
        <div className="answer-section">
          <h3>停止条件</h3>
          <AnswerItems values={result.stopConditions} />
        </div>
      </section>
    );
  }
  return (
    <section className={`assistant-block result-content ${detailed ? "detailed" : ""}`}>
      <div className="assistant-head">
        <Image
          src="/doghead-logo.png"
          alt=""
          width={22}
          height={22}
          unoptimized
        />
        <span>狗头军师判断</span>
      </div>
      {detailed && result.emotionalGrounding ? (
        <div className="answer-section first">
          <h3>先稳一下</h3>
          <p className="answer-copy">{result.emotionalGrounding}</p>
        </div>
      ) : null}
      {result.recommendation ? (
        <p className="answer-lead">{result.recommendation}</p>
      ) : null}
      {result.reasons ? (
        <div className="answer-section">
          <h3>核心判断</h3>
          <AnswerItems values={result.reasons} />
        </div>
      ) : null}
      {detailed && result.facts ? (
        <div className="answer-section">
          <h3>已知事实</h3>
          <AnswerItems values={result.facts} />
        </div>
      ) : null}
      {detailed && result.inferences ? (
        <div className="answer-section">
          <h3>合理推测</h3>
          <AnswerItems values={result.inferences} />
        </div>
      ) : null}
      {detailed && result.unknowns ? (
        <div className="answer-section">
          <h3>关键未知</h3>
          <AnswerItems values={result.unknowns} />
        </div>
      ) : null}
      {result.nextAction ? (
        <div className="answer-section">
          <h3>行动建议</h3>
          <p className="answer-copy">{result.nextAction}</p>
        </div>
      ) : null}
      {detailed && result.messageDraft ? (
        <div className="message-draft">
          <span>可选话术</span>
          <p>
            “
            {Array.isArray(result.messageDraft)
              ? result.messageDraft.join("\n")
              : result.messageDraft}
            ”
          </p>
        </div>
      ) : null}
      {result.observationWindow ? (
        <div className="answer-section">
          <h3>观察窗口</h3>
          <p className="answer-copy">{result.observationWindow}</p>
        </div>
      ) : null}
      {result.stopConditions ? (
        <div className="answer-section">
          <h3>停止条件</h3>
          <AnswerItems values={result.stopConditions} />
        </div>
      ) : null}
    </section>
  );
}

export default function DemoApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [screen, setScreen] = useState<Screen>("home");
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [selectedAnalysis, setSelectedAnalysis] = useState<Analysis | null>(null);
  const [benefit, setBenefit] = useState<Benefit | null>(null);
  const [history, setHistory] = useState<Analysis[]>([]);
  const [error, setError] = useState("");
  const [connectionError, setConnectionError] = useState("");
  const [selectedPackage, setSelectedPackage] = useState("cny_6");
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestion, setSuggestion] = useState("");
  const pollAbort = useRef<AbortController | null>(null);

  const isRunning =
    analysis?.status === "queued" || analysis?.status === "running";
  const canSubmit = Boolean(session) && question.trim().length > 0 && !isRunning;
  const remaining = benefit?.devAnalysisRemaining ?? 0;

  const refreshBenefit = useCallback(async (token: string) => {
    const current = await request<Benefit>("/v1/beta/me", { token });
    setBenefit(current);
    return current;
  }, []);

  const refreshHistory = useCallback(async (token: string) => {
    const payload = await request<{ items: Analysis[] }>("/v1/analyses", { token });
    setHistory(payload.items);
    return payload.items;
  }, []);

  const bootstrap = useCallback(async () => {
    setConnectionError("");
    const stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Session;
        if (parsed.token && parsed.expiresAt > Date.now()) {
          setSession(parsed);
          return;
        }
      } catch {
        // Replace stale local state with a fresh demo session.
      }
      localStorage.removeItem(SESSION_KEY);
    }
    try {
      const payload = await request<{ token: string; expiresIn: number }>(
        "/v1/auth/web-demo",
        { method: "POST", body: {} },
      );
      const nextSession = {
        token: payload.token,
        expiresAt: Date.now() + payload.expiresIn * 1000,
      };
      localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
      setSession(nextSession);
    } catch (reason) {
      setConnectionError(
        reason instanceof Error ? reason.message : "暂时连接不上服务",
      );
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void bootstrap(), 0);
    return () => window.clearTimeout(timer);
  }, [bootstrap]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setTimeout(() => {
      void Promise.all([
        refreshBenefit(session.token),
        refreshHistory(session.token),
      ]).catch((reason: Error & { status?: number }) => {
        if (reason.status === 401) {
          localStorage.removeItem(SESSION_KEY);
          setSession(null);
          void bootstrap();
        } else {
          setConnectionError(reason.message || "暂时连接不上服务");
        }
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bootstrap, refreshBenefit, refreshHistory, session]);

  useEffect(
    () => () => {
      pollAbort.current?.abort();
    },
    [],
  );

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 2600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  async function poll(token: string, analysisId: string) {
    const controller = new AbortController();
    pollAbort.current = controller;
    for (let attempt = 0; attempt < 55; attempt += 1) {
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
        await Promise.all([
          refreshBenefit(token),
          refreshHistory(token),
        ]);
        return;
      }
    }
    throw new Error("分析仍在继续，可稍后在历史判断中查看");
  }

  async function submit() {
    if (!session || !canSubmit) return;
    const cleanQuestion = question.trim();
    setSubmittedQuestion(cleanQuestion);
    setQuestion("");
    setError("");
    setAnalysis({ id: "", status: "queued" });
    try {
      const created = await request<{ analysisId: string; status: "queued" }>(
        "/v1/analyses",
        {
          method: "POST",
          token: session.token,
          idempotencyKey: crypto.randomUUID(),
          body: {
            question: cleanQuestion,
            profile: {
              selfAlias: "我",
              targetAlias: "A",
              relationshipStage: "其他",
              goal: "关系判断",
              emotionIntensity: 5,
            },
          },
        },
      );
      setAnalysis({ id: created.analysisId, status: "queued" });
      await poll(session.token, created.analysisId);
    } catch (reason) {
      const message =
        reason instanceof Error ? reason.message : "分析没有成功，请稍后再试";
      setError(message);
      setAnalysis((current) => ({
        id: current?.id || "",
        status: "failed",
        errorMessage: message,
      }));
      await refreshBenefit(session.token).catch(() => undefined);
    }
  }

  function handleQuestionKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.nativeEvent.isComposing
    ) {
      return;
    }
    event.preventDefault();
    if (canSubmit) void submit();
  }

  function newQuestion() {
    pollAbort.current?.abort();
    setAnalysis(null);
    setSubmittedQuestion("");
    setError("");
    setQuestion("");
    setScreen("home");
  }

  async function goHistory() {
    if (session) await refreshHistory(session.token).catch(() => undefined);
    setScreen("history");
  }

  function openHistoryItem(item: Analysis) {
    setSelectedAnalysis(item);
    setScreen("result");
  }

  async function submitSuggestion() {
    if (!session || !suggestion.trim()) return;
    try {
      await request("/v1/suggestions", {
        method: "POST",
        token: session.token,
        idempotencyKey: crypto.randomUUID(),
        body: { content: suggestion.trim() },
      });
      setSuggestion("");
      setSuggestionOpen(false);
      setNotice("已收到，谢谢");
    } catch {
      setNotice("提交失败，请稍后再试");
    }
  }

  const headerTitle =
    screen === "home"
      ? "狗头军师"
      : screen === "me"
        ? "我的"
        : screen === "pricing"
          ? "充值狗头"
          : screen === "history"
            ? "历史判断"
            : "分析报告";

  function back() {
    if (screen === "me") setScreen("home");
    else if (screen === "pricing" || screen === "history") setScreen("me");
    else if (screen === "result") setScreen("history");
  }

  return (
    <main className="demo-stage">
      <section className="phone-device" aria-label="狗头军师手机 Demo" data-testid="phone-frame">
        <div className="device-statusbar" aria-hidden="true">
          <span>13:34</span>
          <span className="device-island" />
          <span>5G&nbsp;&nbsp;▰</span>
        </div>

        <div className="phone-screen" data-testid="device-screen" data-phone-screen>
          <header className="app-navbar">
            {screen === "home" ? (
              <button
                className="nav-icon-button"
                type="button"
                aria-label="打开我的"
                onClick={() => setScreen("me")}
              >
                <span className="hamburger" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
              </button>
            ) : (
              <button
                className="nav-icon-button back-button"
                type="button"
                aria-label="返回"
                onClick={back}
              >
                ‹
              </button>
            )}
            <h1>{headerTitle}</h1>
            <span className="nav-spacer" />
          </header>

          {screen === "home" ? (
            <div className="home-page">
              <div className="conversation">
                {!submittedQuestion && !analysis ? (
                  <section className="empty-state">
                    <Image
                      className="hero-logo"
                      src="/doghead-logo.png"
                      alt="狗头军师"
                      width={53}
                      height={53}
                      unoptimized
                      priority
                    />
                    <h2>狗头军师，解决你的情感问题</h2>
                  </section>
                ) : null}

                {submittedQuestion ? (
                  <div className="message-row">
                    <div className="user-message">{submittedQuestion}</div>
                  </div>
                ) : null}

                {isRunning ? (
                  <section className="assistant-block loading-block" aria-live="polite">
                    <div className="assistant-head">
                      <Image
                        src="/doghead-logo.png"
                        alt=""
                        width={22}
                        height={22}
                        unoptimized
                      />
                      <span>狗头军师正在判断</span>
                    </div>
                    <div className="loading-dots" aria-label="正在分析">
                      <i />
                      <i />
                      <i />
                    </div>
                  </section>
                ) : null}

                {analysis?.status === "failed" ? (
                  <section className="assistant-block" aria-live="assertive">
                    <div className="assistant-head danger">
                      <Image
                        src="/doghead-logo.png"
                        alt=""
                        width={22}
                        height={22}
                        unoptimized
                      />
                      <span>这次没有分析成功</span>
                    </div>
                    <p className="answer-copy">
                      {error || analysis.errorMessage || "服务暂时不可用，请稍后再试。"}
                    </p>
                    <button className="text-action" type="button" onClick={newQuestion}>
                      重新提问
                    </button>
                  </section>
                ) : null}

                {analysis?.result ? <ResultContent analysis={analysis} /> : null}
              </div>

              <div className="composer-wrap">
                {connectionError ? (
                  <button className="connection-warning" type="button" onClick={bootstrap}>
                    暂时连接不上，点此重试
                  </button>
                ) : null}
                <div className="composer">
                  <label className="sr-only" htmlFor="relationship-question">
                    描述你的情感问题
                  </label>
                  <textarea
                    id="relationship-question"
                    maxLength={4000}
                    value={question}
                    disabled={!session || isRunning}
                    placeholder={
                      "你们是什么关系、发生了什么、你现在想判断什么...\n描述越详细，分析越准确哦～"
                    }
                    onChange={(event) => setQuestion(event.target.value)}
                    onKeyDown={handleQuestionKeyDown}
                  />
                  <div className="composer-bottom">
                    <span>{question.length} / 4000</span>
                    <button
                      className="send-button"
                      type="button"
                      aria-label="发送问题"
                      disabled={!canSubmit}
                      onClick={() => void submit()}
                    >
                      <Image
                        src="/arrow-up-icon.png"
                        alt=""
                        width={33}
                        height={33}
                        unoptimized
                      />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {screen === "me" ? (
            <div className="page-shell me-page">
              <button className="profile-button" type="button">
                <Image
                  className="profile-avatar"
                  src="/person-icon.png"
                  alt=""
                  width={36}
                  height={36}
                  unoptimized
                />
                <span className="profile-copy">
                  <strong>微信用户</strong>
                  <small>点击同步微信昵称</small>
                </span>
                <span className="chevron">›</span>
              </button>

              <div className="menu-list">
                <div className="menu-row">
                  <span>狗头余额</span>
                  <strong>{remaining}</strong>
                </div>
                <div className="menu-row">
                  <span>赠品</span>
                  <span className="row-value">{remaining} 次券</span>
                </div>
                <button
                  className="menu-row"
                  type="button"
                  onClick={() => setScreen("pricing")}
                >
                  <span>充值</span>
                  <span className="row-side green">
                    1 元起 <span className="chevron">›</span>
                  </span>
                </button>
              </div>

              <div className="menu-list utility-list">
                <button className="menu-row" type="button" onClick={goHistory}>
                  <span>历史判断</span>
                  <span className="chevron">›</span>
                </button>
                <button
                  className="menu-row"
                  type="button"
                  onClick={() => setSuggestionOpen(true)}
                >
                  <span>产品建议</span>
                  <span className="chevron">›</span>
                </button>
                <button
                  className="delete-account"
                  type="button"
                  onClick={() => setNotice("演示版不会删除共享账号")}
                >
                  删除账号与历史
                </button>
              </div>
            </div>
          ) : null}

          {screen === "pricing" ? (
            <div className="page-shell pricing-page">
              <div className="balance-summary">
                <span>狗头余额</span>
                <span>
                  <strong>{remaining}</strong> 个
                </span>
              </div>
              <p className="section-label">充值金额</p>
              <div className="package-grid">
                {PACKAGES.map((item) => (
                  <button
                    className={`package-option ${
                      selectedPackage === item.id ? "selected" : ""
                    }`}
                    type="button"
                    key={item.id}
                    onClick={() => setSelectedPackage(item.id)}
                  >
                    <span className={item.id === "cny_1" ? "accent" : ""}>
                      {item.label}
                    </span>
                    <strong>
                      <small>¥</small>
                      {item.price}
                    </strong>
                    <em>{item.coins} 个狗头</em>
                  </button>
                ))}
              </div>
              <button
                className="buy-button"
                type="button"
                onClick={() => setNotice("当前为演示环境，不会产生实际扣款")}
              >
                充值 ¥
                {PACKAGES.find((item) => item.id === selectedPackage)?.price}
              </button>
              <div className="info-list">
                <div className="info-row">
                  <span>赠品</span>
                  <span>{remaining} 次券</span>
                </div>
                <button
                  className="info-row"
                  type="button"
                  onClick={() => setRecordsOpen((open) => !open)}
                >
                  <span>购买记录</span>
                  <span className={`chevron ${recordsOpen ? "open" : ""}`}>›</span>
                </button>
                {recordsOpen ? (
                  <div className="records-panel">
                    {benefit?.purchaseRecords?.length ? (
                      benefit.purchaseRecords.map((record) => (
                        <div className="purchase-record" key={`${record.packageId}-${record.createdAt}`}>
                          <span>¥{(record.displayedPriceFen / 100).toFixed(0)}</span>
                          <span>{record.createdAt.slice(0, 10)} · 未扣款</span>
                        </div>
                      ))
                    ) : (
                      <p>暂无购买记录</p>
                    )}
                  </div>
                ) : null}
              </div>
              <p className="pricing-footnote">分析未成功交付，不扣狗头。</p>
            </div>
          ) : null}

          {screen === "history" ? (
            <div className="page-shell history-page">
              {!history.length ? (
                <div className="history-empty">
                  <strong>还没有历史判断</strong>
                  <span>回到首页，先提交一个具体关系问题。</span>
                </div>
              ) : (
                <div className="archive-list">
                  {history.map((item, index) => (
                    <button
                      className="archive-row"
                      type="button"
                      key={item.id}
                      onClick={() => openHistoryItem(item)}
                    >
                      <span className="archive-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="archive-main">
                        <strong>
                          {item.profile?.targetAlias || "A"} ·{" "}
                          {item.profile?.goal || "关系分析"}
                        </strong>
                        <small>
                          {String(item.createdAt || "").replace("T", " ").slice(0, 16)}
                          {" · "}
                          {item.status === "delivered"
                            ? "已交付"
                            : item.status === "failed"
                              ? "未交付"
                              : item.status === "blocked"
                                ? "安全流程"
                                : "分析中"}
                        </small>
                      </span>
                      <span className="archive-action">查看</span>
                    </button>
                  ))}
                </div>
              )}
              <button className="primary-button" type="button" onClick={newQuestion}>
                回到军师
              </button>
            </div>
          ) : null}

          {screen === "result" && selectedAnalysis ? (
            <div className="page-shell result-page">
              {selectedAnalysis.status === "failed" ? (
                <section className="failed-report">
                  <Image
                    src="/doghead-logo.png"
                    alt=""
                    width={32}
                    height={32}
                    unoptimized
                  />
                  <h2>这次没有分析成功</h2>
                  <p>{selectedAnalysis.errorMessage || "暂时没有生成可用分析。"}</p>
                </section>
              ) : (
                <>
                  <div className="result-head">
                    <Image
                      src="/doghead-logo.png"
                      alt=""
                      width={32}
                      height={32}
                      unoptimized
                    />
                    <h2>狗头军师的判断</h2>
                  </div>
                  <ResultContent analysis={selectedAnalysis} detailed />
                </>
              )}
              <button className="primary-button" type="button" onClick={newQuestion}>
                再问一个问题
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setScreen("history")}
              >
                查看历史判断
              </button>
            </div>
          ) : null}

          {suggestionOpen ? (
            <div className="modal-backdrop">
              <div className="modal-card" role="dialog" aria-modal="true">
                <h2>产品建议</h2>
                <textarea
                  value={suggestion}
                  placeholder="告诉我们哪里可以做得更好"
                  onChange={(event) => setSuggestion(event.target.value)}
                />
                <div className="modal-actions">
                  <button type="button" onClick={() => setSuggestionOpen(false)}>
                    取消
                  </button>
                  <button
                    type="button"
                    disabled={!suggestion.trim()}
                    onClick={() => void submitSuggestion()}
                  >
                    提交
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {notice ? <div className="toast">{notice}</div> : null}
        </div>
        <div className="home-indicator" aria-hidden="true" />
      </section>
    </main>
  );
}
