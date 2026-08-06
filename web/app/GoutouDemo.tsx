"use client";

import { useMemo, useState } from "react";

type Result = {
  emotion: string;
  facts: string[];
  inferences: string[];
  unknowns: string[];
  scores: { label: string; value: number; note: string }[];
  risks: { level: "low" | "watch" | "high"; label: string; detail: string }[];
  recommendation: string;
  reasons: string[];
  action: string;
  stop: string;
  reply: string;
};

const scenarios = [
  {
    label: "暧昧降温",
    text: "我们认识两个月，前几周几乎每天聊天。最近一周都是我先联系，他会回复但很少接着问，也没有再主动约见面。上周他说这周忙，等忙完再说。",
  },
  {
    label: "投入失衡",
    text: "在一起半年，周末见面和旅行几乎都是我安排。临时取消过三次，他会道歉，但很少主动补约。我一提需求，他就说我想太多。",
  },
  {
    label: "边界预警",
    text: "对象要求我随时共享定位、交出手机密码，还说不照做就是不够爱。吵架时会连续打很多电话，并威胁把我们的私密聊天发给朋友。",
  },
];

const positiveWords = ["主动", "补约", "兑现", "道歉", "商量", "尊重", "支持", "关心"];
const negativeWords = ["取消", "失联", "敷衍", "冷暴力", "贬低", "想太多", "威胁", "强迫"];
const dangerWords = ["威胁", "跟踪", "堵门", "打我", "伤害", "曝光", "私密", "强迫", "下药"];
const consentWords = ["不愿意", "拒绝", "喝醉", "僵住", "不同意", "强迫"];
const controlWords = ["定位", "密码", "查手机", "不够爱", "服从", "不许", "断绝联系"];

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function clamp(value: number) {
  return Math.max(8, Math.min(92, value));
}

function analyze(text: string): Result {
  const compact = text.trim();
  const sentences = compact
    .split(/[。！？\n]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const danger = includesAny(compact, dangerWords);
  const consent = includesAny(compact, consentWords);
  const control = includesAny(compact, controlWords);
  const unreliable = includesAny(compact, ["取消", "失联", "没有再主动", "很少主动", "说我想太多"]);
  const responsive = includesAny(compact, ["回复", "道歉", "解释", "补约"]);
  const positive = positiveWords.filter((word) => compact.includes(word)).length;
  const negative = negativeWords.filter((word) => compact.includes(word)).length;

  const emotion = danger
    ? "这不是你“太敏感”。被威胁、逼迫或暴露隐私，会让人害怕又混乱。先把安全和选择权拿回来，关系分析可以稍后。"
    : unreliable
      ? "你难受的可能不只是一次回复，而是自己持续用力，却不知道对方会不会接住。悬着、反复猜，很消耗人。"
      : "你在意这段关系，也在努力避免误判。先不用急着给对方定性，我们把能确认的行为和仍未知的部分分开。";

  const facts = sentences.length
    ? sentences.map((sentence) => `你提供的信息：${sentence}`)
    : ["尚未提供足够的可观察行为。"];
  const inferences = [
    responsive
      ? "对方仍有回应或修复动作，但回应不等于稳定投入。"
      : "目前没有看到稳定的双向推进，关系可能处在降温或低投入状态。",
    control
      ? "这些要求更像控制与边界侵蚀，不宜包装成“在乎”。"
      : "单段文字不足以判断对方的动机、人格或是否还喜欢你。",
  ];
  const unknowns = danger
    ? ["你现在是否处于安全地点？", "对方是否掌握住址、账号或私密材料？", "是否有可信的人可以马上联系？"]
    : ["对方是否给过具体、可兑现的下一次安排？", "这种投入差异持续了多久？", "你表达需求后，对方有没有实际调整？"];

  const scores = [
    { label: "主动互惠", value: clamp(52 + positive * 6 - negative * 10 - (unreliable ? 18 : 0)), note: "看双方是否都发起联系和安排" },
    { label: "兑现可靠", value: clamp(58 + (compact.includes("补约") ? 18 : 0) - (compact.includes("取消") ? 28 : 0)), note: "看承诺是否落到具体行动" },
    { label: "边界尊重", value: clamp(78 - (control ? 52 : 0) - (consent ? 36 : 0)), note: "沉默、关系身份和礼物都不是同意" },
    { label: "修复能力", value: clamp(50 + (compact.includes("道歉") ? 12 : 0) + (compact.includes("补约") ? 18 : 0) - (compact.includes("想太多") ? 28 : 0)), note: "道歉之后是否调整，比分辩更重要" },
  ];

  const risks: Result["risks"] = [];
  if (danger) risks.push({ level: "high", label: "安全与隐私高风险", detail: "出现威胁、跟踪、强迫或暴露隐私信号。先保全证据、联系可信支持；有现实危险时联系当地紧急服务。" });
  if (control) risks.push({ level: "high", label: "控制不是边界", detail: "索要密码、强制定位或用爱施压，会削弱你的选择权。" });
  if (consent) risks.push({ level: "high", label: "同意边界", detail: "拒绝、犹豫、僵住或不清醒时都应立即停止推进。" });
  if (unreliable) risks.push({ level: "watch", label: "持续投入失衡", detail: "一次忙碌不是结论；多次不兑现且不补约，才是需要降级投入的证据。" });
  if (!risks.length) risks.push({ level: "low", label: "暂未见明显高危信号", detail: "仍要继续观察主动、兑现、边界和冲突修复。" });

  if (danger) {
    return {
      emotion,
      facts,
      inferences,
      unknowns,
      scores,
      risks,
      recommendation: "首选：暂停关系博弈，先做安全与隐私处置。",
      reasons: ["威胁和隐私曝光会快速升级", "单独沟通可能增加风险", "保留证据和支持网络能保留选择权"],
      action: "现在：截图保留威胁内容，关闭不必要的定位和共享权限，把情况告诉一位可信的人。",
      stop: "停止条件：对方继续威胁、跟踪、堵门或尝试控制账号时，不再单独见面或争辩；有即时危险就联系当地紧急服务。",
      reply: "我不同意你查看我的账号、定位或公开我们的私密内容。请停止联系和威胁；后续我会保留记录并寻求帮助。",
    };
  }

  const recommendation = unreliable
    ? "首选：把猜测换成一次具体邀约或需求，然后只看行动。"
    : "首选：表达一个清楚、可退出的需求，再给对方一次回应窗口。";
  return {
    emotion,
    facts,
    inferences,
    unknowns,
    scores,
    risks,
    recommendation,
    reasons: ["给双方一次清楚表达的机会", "具体行动比聊天温度更可验证", "限定窗口能保护你的时间和自尊"],
    action: "现在：只发一条消息，提出一个具体时间或明确需求，不连发、不解释一大段。观察 72 小时。",
    stop: "停止条件：再次回避具体安排、只道歉不调整，或把你的合理需求说成“矫情”时，降低投入并停止追问。",
    reply: unreliable
      ? "我愿意继续了解你，但最近主要是我在主动，我有点累。你如果也想推进，可以在这周选个具体时间见面；如果最近没这个打算，也可以直接告诉我。"
      : "这件事对我有点重要。我想听听你的真实想法，不需要马上给完美答案；你愿意的话，我们这两天找半小时聊清楚。",
  };
}

export default function GoutouDemo() {
  const [text, setText] = useState(scenarios[0].text);
  const [result, setResult] = useState<Result | null>(() => analyze(scenarios[0].text));
  const [copied, setCopied] = useState(false);
  const characters = useMemo(() => text.length, [text]);

  function runAnalysis() {
    if (!text.trim()) return;
    setResult(analyze(text));
    setCopied(false);
    requestAnimationFrame(() => document.querySelector("#result")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }

  function clearAll() {
    setText("");
    setResult(null);
    setCopied(false);
  }

  async function copyReply() {
    if (!result) return;
    await navigator.clipboard.writeText(result.reply);
    setCopied(true);
  }

  return (
    <main>
      <nav className="nav shell" aria-label="主导航">
        <a className="brand" href="#top" aria-label="狗头军师首页">
          <span className="brand-mark" aria-hidden="true">狗</span>
          <span>狗头军师</span>
        </a>
        <div className="nav-links">
          <a href="#method">判断框架</a>
          <a href="/guide">使用手册</a>
          <a href="https://github.com/powerycy/goutoujunshi" target="_blank" rel="noreferrer">开源仓库</a>
        </div>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span className="live-dot" /> 2026 外滩黑客松评委体验版</div>
          <h1>先接住，<br /><span>再判断。</span></h1>
          <p className="hero-lede">亲密关系最难的，不是缺一句“高情商回复”，而是情绪、事实和猜测混在一起。狗头军师把局面拆开，再给你一个不伤害自己、也不操控别人的下一步。</p>
          <div className="hero-actions">
            <a className="primary-button" href="#demo">直接体验 <span aria-hidden="true">↘</span></a>
            <a className="text-link" href="/guide">先看 1 分钟手册</a>
          </div>
          <div className="proof-row" aria-label="项目事实">
            <div><strong>13万</strong><span>核心 Markdown 字符</span></div>
            <div><strong>43</strong><span>关系知识文件</span></div>
            <div><strong>0</strong><span>聊天持久化</span></div>
          </div>
        </div>
        <div className="hero-card" aria-label="分析方法预览">
          <div className="paper-tab">判断，不读心</div>
          <p className="quote">“他回复慢，<br />是不是不爱我了？”</p>
          <div className="mini-separator" />
          <div className="mini-row"><span className="mini-index">01</span><div><b>事实</b><p>这次回复间隔变长</p></div></div>
          <div className="mini-row"><span className="mini-index coral">02</span><div><b>推测</b><p>他不爱了，证据不足</p></div></div>
          <div className="mini-row"><span className="mini-index ink">03</span><div><b>下一步</b><p>看持续主动与兑现</p></div></div>
          <div className="stamp">保留选择权</div>
        </div>
      </section>

      <section className="principles" id="method">
        <div className="shell">
          <div className="section-heading">
            <span>不是“拿下谁”的套路</span>
            <h2>四层判断，把混乱变成选择</h2>
          </div>
          <div className="principle-grid">
            <article><span>01</span><h3>情绪落地</h3><p>先承认你正在经历什么，不替未经证实的解释背书。</p></article>
            <article><span>02</span><h3>证据分层</h3><p>可见行为是事实；动机只是推测；缺失的信息保持未知。</p></article>
            <article><span>03</span><h3>互惠与风险</h3><p>看主动、兑现、边界和修复；识别控制、PUA、胁迫与隐私风险。</p></article>
            <article><span>04</span><h3>行动收束</h3><p>只给现在能做的一步、观察窗口，以及清楚的停止条件。</p></article>
          </div>
        </div>
      </section>

      <section className="demo-section shell" id="demo">
        <div className="section-heading left">
          <span>匿名演示 · 无需登录</span>
          <h2>把一段关系困惑，拆成可执行判断</h2>
          <p>请选择匿名示例，或粘贴已经去掉姓名、住址、联系方式的文字。页面不会发送或保存你的输入。</p>
        </div>
        <div className="demo-grid">
          <div className="input-panel">
            <div className="panel-topline"><b>01 / 输入有限证据</b><span>仅当前页面内存</span></div>
            <div className="scenario-row" aria-label="匿名示例">
              {scenarios.map((scenario) => (
                <button
                  key={scenario.label}
                  className={text === scenario.text ? "scenario active" : "scenario"}
                  onClick={() => { setText(scenario.text); setResult(analyze(scenario.text)); setCopied(false); }}
                >
                  {scenario.label}
                </button>
              ))}
            </div>
            <label htmlFor="story">发生了什么？</label>
            <textarea
              id="story"
              value={text}
              maxLength={1200}
              onChange={(event) => setText(event.target.value)}
              placeholder="例：最近三次见面都是我约，对方会回复，但从不主动补约……"
            />
            <div className="textarea-meta"><span>请勿输入真实姓名、电话、住址或账号</span><span>{characters}/1200</span></div>
            <div className="input-actions">
              <button className="primary-button dark" onClick={runAnalysis} disabled={!text.trim()}>开始拆解</button>
              <button className="clear-button" onClick={clearAll}>清除全部</button>
            </div>
            <div className="privacy-note"><span aria-hidden="true">◎</span><p><b>隐私设计：</b>不需要账号，不写入浏览器存储，不上传服务器；刷新页面或点击“清除全部”即可清空。</p></div>
          </div>

          <div className="result-panel" id="result" aria-live="polite">
            {!result ? (
              <div className="empty-result"><span>↳</span><h3>等待你的有限证据</h3><p>我们不会为了给出完整答案而补齐不存在的情节。</p></div>
            ) : (
              <>
                <div className="panel-topline"><b>02 / 结构化判断</b><span>不诊断 · 不读心</span></div>
                <section className="emotion-card"><span>先接住情绪</span><p>{result.emotion}</p></section>
                <div className="evidence-columns">
                  <section><h3><i className="dot fact" />事实</h3>{result.facts.slice(0, 3).map((item) => <p key={item}>{item}</p>)}</section>
                  <section><h3><i className="dot infer" />合理推测</h3>{result.inferences.map((item) => <p key={item}>{item}</p>)}</section>
                  <section><h3><i className="dot unknown" />关键未知</h3>{result.unknowns.map((item) => <p key={item}>{item}</p>)}</section>
                </div>
                <section className="score-card">
                  <h3>互惠雷达 <span>用于比较行为，不给人打总分</span></h3>
                  {result.scores.map((score) => (
                    <div className="score-row" key={score.label}>
                      <div className="score-label"><b>{score.label}</b><span>{score.note}</span></div>
                      <div className="meter"><i style={{ width: `${score.value}%` }} /></div>
                      <strong>{score.value}</strong>
                    </div>
                  ))}
                </section>
                <section className="risk-card">
                  <h3>边界与风险检查</h3>
                  {result.risks.map((risk) => (
                    <div className={`risk-row ${risk.level}`} key={risk.label}><span>{risk.level === "high" ? "!" : risk.level === "watch" ? "△" : "✓"}</span><div><b>{risk.label}</b><p>{risk.detail}</p></div></div>
                  ))}
                </section>
                <section className="decision-card">
                  <div className="decision-kicker">明确建议</div>
                  <h3>{result.recommendation}</h3>
                  <ul>{result.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
                  <div className="action-box"><b>现在做什么</b><p>{result.action}</p></div>
                  <div className="stop-box"><b>什么时候停</b><p>{result.stop}</p></div>
                </section>
                <section className="reply-card">
                  <div><span>可直接发送</span><button onClick={copyReply}>{copied ? "已复制" : "复制文字"}</button></div>
                  <p>{result.reply}</p>
                </section>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="boundary-section">
        <div className="shell boundary-grid">
          <div><span className="eyebrow pale">产品底线</span><h2>帮你更清醒，<br />不是帮你控制谁。</h2></div>
          <div className="boundary-list">
            <p><b>反 PUA</b><span>不提供贬低、推拉、嫉妒操控、煤气灯或服从测试。</span></p>
            <p><b>同意优先</b><span>沉默、僵住、过去同意和关系身份都不是永久通行证。</span></p>
            <p><b>安全升级</b><span>出现暴力、跟踪、胁迫或隐私威胁时，优先安全支持而非沟通技巧。</span></p>
          </div>
        </div>
      </section>

      <footer className="shell footer">
        <div><b>狗头军师</b><p>用专业知识，解决现实世界里的亲密关系难题。</p></div>
        <div><a href="/guide">公开使用手册</a><a href="https://github.com/powerycy/goutoujunshi" target="_blank" rel="noreferrer">GitHub</a><a href="#top">回到顶部 ↑</a></div>
        <p className="disclaimer">这是关系决策辅助工具，不替代心理、医疗或法律专业服务。遇到即时人身危险，请联系当地紧急服务。</p>
      </footer>
    </main>
  );
}
