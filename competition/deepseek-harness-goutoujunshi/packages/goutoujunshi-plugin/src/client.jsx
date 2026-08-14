import React, { useMemo, useState, useSyncExternalStore } from 'react'
import {
  ArchiveRestore,
  Bot,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clipboard,
  Database,
  FileUp,
  HeartHandshake,
  ImagePlus,
  LockKeyhole,
  MemoryStick,
  MessageCircleHeart,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Undo2,
  UserRoundCheck,
  X,
} from 'lucide-react'
import dogLogo from '../assets/goutoujunshi-dog-logo.png'
import styles from './styles.css'
import { buildEvidenceCandles, classifyEvidence } from './domain.js'
import { workspaceStore } from './store.js'

const PLUGIN_ID = '@powerycy/dsh-goutoujunshi-plugin'

function useWorkspace() {
  return useSyncExternalStore(workspaceStore.subscribe, workspaceStore.getSnapshot, workspaceStore.getSnapshot)
}

function useActiveObject(state) {
  return state.objects.find(item => item.id === state.activeObjectId) || null
}

function formatTime(value, includeDate = false) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat('zh-CN', includeDate
    ? { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' }).format(date)
}

function DeepSeekBrand({ compact = false }) {
  return (
    <div className={`dsh-brand ${compact ? 'is-compact' : ''}`}>
      <img className="dsh-logo" src="/favicon.svg" alt="DeepSeek Harness" />
      {!compact && <div><strong>DeepSeek Harness</strong><span>official workspace</span></div>}
    </div>
  )
}

function DogBrand({ compact = false }) {
  return (
    <div className={`goutou-brand ${compact ? 'is-compact' : ''}`}>
      <img src={dogLogo} alt="狗头军师绿色狗头标识" />
      {!compact && <div><strong>狗头军师</strong><span>关系证据工作区</span></div>}
    </div>
  )
}

function ObjectSidebar({ collapsed = false }) {
  const state = useWorkspace()
  const active = useActiveObject(state)
  return (
    <aside className={`object-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="关系对象抽屉">
      <div className="sidebar-brand-stack">
        <DeepSeekBrand compact={collapsed} />
        <div className="brand-join" aria-hidden="true" />
        <DogBrand compact={collapsed} />
      </div>

      <button className="new-object-button" onClick={() => workspaceStore.setOverlay({ type: 'create', suggestedName: '' })}>
        <Plus size={18} /> {!collapsed && <span>建立对象档案</span>}
      </button>

      {!collapsed && (
        <div className="sidebar-section-heading">
          <span>关系对象</span><small>{state.objects.length}/5</small>
        </div>
      )}
      <nav className="object-list" aria-label="对象列表">
        {state.objects.map((object, index) => {
          const positive = object.evidence.filter(item => classifyEvidence(item) === 'positive').length
          return (
            <button
              key={object.id}
              className={`object-row ${object.id === active?.id ? 'is-active' : ''}`}
              onClick={() => workspaceStore.selectObject(object.id)}
              title={collapsed ? object.displayName : undefined}
            >
              <span className="object-avatar">{object.displayName.slice(0, 1) || index + 1}</span>
              {!collapsed && <>
                <span className="object-row-copy"><strong>{object.displayName}</strong><small>{object.evidence.length ? `${positive} 条正向 · ${object.evidence.length} 条证据` : '等待证据'}</small></span>
                <span className={`isolation-dot ${object.id === active?.id ? 'is-live' : ''}`} />
              </>}
            </button>
          )
        })}
        {!state.objects.length && !collapsed && (
          <div className="sidebar-empty">对象之间的会话、记忆与证据严格隔离。</div>
        )}
      </nav>

      <div className="sidebar-foot">
        {!collapsed && (
          <button className="load-demo-link" onClick={() => workspaceStore.loadDemo()}><Sparkles size={15} />载入公开案例</button>
        )}
        <div className="local-only-badge" title="原始证据默认只留在本地">
          <ShieldCheck size={16} /> {!collapsed && <span>本地优先 · 不自动发消息</span>}
        </div>
      </div>
    </aside>
  )
}

function EmptyWorkspace() {
  return (
    <main className="empty-workspace">
      <div className="empty-orbit" aria-hidden="true"><img src={dogLogo} alt="" /></div>
      <div className="eyebrow"><span /> DeepSeek Harness × 狗头军师</div>
      <h1>先接住情绪，再把关系看清。</h1>
      <p>围绕一个稳定对象，分开保存会话、精简记忆与证据。聊天记录不是必选，军师也不会替你发送任何消息。</p>
      <div className="hero-actions">
        <button className="primary-action" onClick={() => workspaceStore.setOverlay({ type: 'create', suggestedName: '' })}><Plus size={18} />建立对象档案</button>
        <button className="secondary-action" onClick={() => workspaceStore.loadDemo()}><Sparkles size={18} />体验公开合成案例</button>
      </div>
      <div className="promise-grid">
        <div><HeartHandshake /><strong>情绪先落地</strong><span>不替未经证实的解释背书</span></div>
        <div><UserRoundCheck /><strong>身份先锁定</strong><span>不用左右气泡、性别或语气猜人</span></div>
        <div><LockKeyhole /><strong>对象不串档</strong><span>稳定 ID 隔离会话、记忆与证据</span></div>
      </div>
    </main>
  )
}

function WorkspaceHeader({ object, state }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(object.displayName)
  const saveName = () => {
    workspaceStore.renameObject(object.id, name)
    setRenaming(false)
  }
  return (
    <header className="workspace-header">
      <div className="current-object">
        <span className="current-avatar">{object.displayName.slice(0, 1)}</span>
        <div>
          <small>当前关系对象 · {object.id}</small>
          {renaming ? (
            <span className="rename-inline"><input value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === 'Enter' && saveName()} autoFocus /><button onClick={saveName}><Check size={14} /></button></span>
          ) : (
            <button className="object-name-button" onClick={() => setRenaming(true)}>{object.displayName}<Pencil size={13} /></button>
          )}
        </div>
      </div>
      <div className="view-switch" role="tablist" aria-label="对象工作区视图">
        <button className={state.view === 'chat' ? 'is-active' : ''} onClick={() => workspaceStore.setView('chat')}><MessageCircleHeart size={16} />军师对话</button>
        <button className={state.view === 'progress' ? 'is-active' : ''} onClick={() => workspaceStore.setView('progress')}><TrendingUp size={16} />关系进展</button>
      </div>
      <div className="header-actions">
        <button onClick={() => workspaceStore.setOverlay({ type: 'memory' })} title="查看对象记忆"><MemoryStick size={18} /></button>
        <button onClick={() => workspaceStore.setOverlay({ type: 'evidence' })} title="添加关系证据"><FileUp size={18} /></button>
        <button title="更多"><MoreHorizontal size={18} /></button>
      </div>
    </header>
  )
}

function AnalysisBlock({ message }) {
  const { analysis } = message
  return (
    <article className="analysis-card">
      <div className="analysis-intro"><img src={dogLogo} alt="" /><div><span>狗头军师</span><p>{message.text}</p></div></div>
      <div className="evidence-split">
        <section><h3><span className="fact-dot" />可观察事实</h3>{analysis.facts.length ? <ul>{analysis.facts.map(item => <li key={item}>{item}</li>)}</ul> : <p>当前没有足以改变判断的记录。</p>}</section>
        <section><h3><span className="inference-dot" />合理推测</h3><ul>{analysis.inferences.map(item => <li key={item}>{item}</li>)}</ul></section>
        <section><h3><span className="unknown-dot" />仍然未知</h3><ul>{analysis.unknowns.map(item => <li key={item}>{item}</li>)}</ul></section>
      </div>
      <div className="recommendation-band">
        <div><small>军师建议</small><strong>{analysis.decision}</strong></div>
        <p>{analysis.decision === '推进' ? '做一次低压力、可退出的具体行动，用真实反馈结束猜测。' : '按当前目标收束动作，同时保留边界与选择权。'}</p>
      </div>
      <div className="script-box">
        <div><span>可复制话术</span><button onClick={() => workspaceStore.copyScript(analysis.script)}><Clipboard size={14} />复制</button></div>
        <blockquote>{analysis.script}</blockquote>
      </div>
      <div className="observation-grid">
        <div><small>观察窗口</small><p>{analysis.observationWindow}</p></div>
        <div><small>停止条件</small><p>{analysis.stopConditions.slice(0, 2).join('；')}</p></div>
      </div>
      <div className="human-gate">
        <div><LockKeyhole size={16} /><span>{message.confirmed ? '已由你确认。军师仍不会自动发送。' : '这是建议，不是自动动作；由你决定是否采用。'}</span></div>
        <button disabled={message.confirmed} onClick={() => workspaceStore.confirmDecision(message.id)}>{message.confirmed ? <><Check size={15} />已确认</> : '确认这个行动'}</button>
      </div>
    </article>
  )
}

function ChatMessage({ message }) {
  if (message.role === 'assistant' && message.analysis) return <AnalysisBlock message={message} />
  return <div className={`chat-message is-${message.role}`}><p>{message.text}</p><time>{formatTime(message.at)}</time></div>
}

function Composer({ object }) {
  const [text, setText] = useState('')
  const submit = () => {
    workspaceStore.send(text)
    setText('')
  }
  return (
    <div className="composer-wrap">
      <div className="composer-tools">
        <button onClick={() => workspaceStore.setOverlay({ type: 'evidence', tab: 'paste' })}><Clipboard size={15} />粘贴记录</button>
        <button onClick={() => workspaceStore.setOverlay({ type: 'evidence', tab: 'image' })}><ImagePlus size={15} />截图/文件</button>
        <button onClick={() => workspaceStore.setOverlay({ type: 'evidence', tab: 'chatlab' })}><Database size={15} />ChatLab</button>
      </div>
      <div className="composer">
        <textarea value={text} onChange={event => setText(event.target.value)} onKeyDown={event => {
          if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
        }} placeholder={`跟军师说说你和${object.displayName}现在最卡的地方…`} rows={2} />
        <button className="send-button" onClick={submit} disabled={!text.trim()} aria-label="发送给军师"><Send size={18} /></button>
      </div>
      <p className="composer-disclaimer">AI 建议可能出错。关系决定与消息发送始终由你确认。</p>
    </div>
  )
}

function ChatView({ object }) {
  return (
    <div className="chat-view">
      <div className="chat-scroll">
        <div className="session-context-strip"><Bot size={15} /><span>已只召回 <strong>{object.displayName}</strong> 的相关上下文</span><small>{object.memories.length} 条精简记忆 · {object.evidence.length} 条证据</small></div>
        {!object.messages.length ? (
          <div className="conversation-starter">
            <img src={dogLogo} alt="狗头军师" />
            <h2>现在最让你拿不准的是什么？</h2>
            <p>可以直接讲故事，不必先上传聊天记录。我会先承接感受，再拆事实、推测与未知。</p>
            <div>
              <button onClick={() => workspaceStore.send('我想推进，但怕显得太着急。')}>我想推进，但怕太着急</button>
              <button onClick={() => workspaceStore.send('我们刚吵完，我想知道怎么修复。')}>冲突后怎么修复</button>
              <button onClick={() => workspaceStore.send('投入一直不对等，我在考虑退出。')}>我在考虑退出</button>
            </div>
          </div>
        ) : object.messages.map(message => <ChatMessage key={message.id} message={message} />)}
      </div>
      <Composer object={object} />
    </div>
  )
}

function EvidenceChart({ object }) {
  const candles = useMemo(() => buildEvidenceCandles(object.evidence), [object.evidence])
  const [hovered, setHovered] = useState(null)
  const width = 720
  const height = 280
  const left = 48
  const top = 24
  const plotWidth = 640
  const plotHeight = 210
  const xFor = index => left + (candles.length <= 1 ? plotWidth / 2 : index * (plotWidth / (candles.length - 1)))
  const yFor = value => top + (100 - value) * plotHeight / 100
  const path = candles.map((item, index) => `${index ? 'L' : 'M'} ${xFor(index)} ${yFor(item.close)}`).join(' ')
  return (
    <div className="chart-shell">
      <div className="chart-title-row"><div><small>Evidence-only trend</small><h2>关系进展证据</h2></div><div className="chart-legend"><span className="legend-red">正向进展</span><span className="legend-green">退缩 / 冲突</span><span className="legend-gray">证据不足</span></div></div>
      <div className="chart-area">
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${object.displayName} 的关系进展证据图，不预测爱意或成功率`}>
          {[20, 40, 60, 80].map(value => <g key={value}><line className="grid-line" x1={left} x2={left + plotWidth} y1={yFor(value)} y2={yFor(value)} /><text className="axis-label" x={left - 12} y={yFor(value) + 4} textAnchor="end">{value}</text></g>)}
          {candles.length > 1 && <path d={path} className="trend-line" />}
          {candles.map((item, index) => {
            const x = xFor(index)
            const color = item.direction === 'positive' ? '#e2486a' : item.direction === 'negative' ? '#36a56c' : '#9a96a2'
            const bodyTop = Math.min(yFor(item.open), yFor(item.close))
            const bodyHeight = Math.max(5, Math.abs(yFor(item.open) - yFor(item.close)))
            return <g key={item.id} className="candle" onMouseEnter={() => setHovered({ item, index })} onMouseLeave={() => setHovered(null)} onFocus={() => setHovered({ item, index })} onBlur={() => setHovered(null)} tabIndex="0">
              <line x1={x} x2={x} y1={yFor(item.high)} y2={yFor(item.low)} stroke={color} strokeWidth="2" />
              <rect x={x - 8} y={bodyTop} width="16" height={bodyHeight} rx="3" fill={color} />
              <circle cx={x} cy={yFor(item.close)} r="14" fill="transparent" />
              <text className="date-label" x={x} y={height - 16} textAnchor="middle">{new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric' }).format(new Date(item.at))}</text>
            </g>
          })}
        </svg>
        {hovered && <div className="chart-tooltip" style={{ left: `${Math.max(3, Math.min(72, 6 + hovered.index * (66 / Math.max(1, candles.length - 1))))}%` }}>
          <div><time>{formatTime(hovered.item.at, true)}</time><span className={`direction-tag is-${hovered.item.direction}`}>{hovered.item.direction === 'positive' ? '为什么是红色' : hovered.item.direction === 'negative' ? '为什么是绿色' : '为什么是灰色'}</span></div>
          <strong>{hovered.item.reason}</strong>
          <dl><dt>可观察事实</dt><dd>{hovered.item.observableFact}</dd><dt>代表性摘要</dt><dd>{hovered.item.summary}</dd><dt>来源</dt><dd>{hovered.item.source}</dd><dt>证据完整度</dt><dd>{Math.round(hovered.item.completeness * 100)}%</dd></dl>
        </div>}
      </div>
      <p className="chart-caveat"><CircleAlert size={15} />图表只解释已记录证据；不预测爱意、忠诚、人格或成功率。灰色表示记录不足。</p>
    </div>
  )
}

function EvidenceTimeline({ object }) {
  return <div className="evidence-timeline"><div className="section-title"><div><small>Evidence ledger</small><h3>证据引用</h3></div><span>{object.evidence.length} 条</span></div>{object.evidence.map(item => <article key={item.id}>
    <span className={`timeline-dot is-${classifyEvidence(item)}`} />
    <div><div><time>{formatTime(item.at, true)}</time><span>{Math.round(item.completeness * 100)}% 完整</span></div><strong>{item.observableFact}</strong><p>{item.reason}</p><small>{item.source}</small></div>
  </article>)}</div>
}

function ProgressView({ object }) {
  return <div className="progress-view"><EvidenceChart object={object} /><EvidenceTimeline object={object} /></div>
}

function CreateObjectDialog({ suggestedName = '' }) {
  const state = useWorkspace()
  const [name, setName] = useState(suggestedName)
  const limitReached = state.objects.length >= 5
  return <div className="modal-card create-dialog"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><div className="modal-icon"><UserRoundCheck /></div><small>独立关系对象</small><h2>{suggestedName ? `要为“${suggestedName}”建立档案吗？` : '建立一个对象档案'}</h2><p>只有当你会持续聊到同一个人时才需要建档。显示代号随时能改，内部 ID 不变。</p><label>显示代号<input value={name} onChange={event => setName(event.target.value)} placeholder="例如：小北（不必填真实姓名）" maxLength={18} autoFocus /></label><div className="object-limit"><span>{state.objects.length}/5 已使用</span><span>会话 · 记忆 · 证据 · 任务全部隔离</span></div><button className="primary-action wide" disabled={!name.trim() || limitReached} onClick={() => workspaceStore.createObject(name)}>{limitReached ? '已达到 5 个对象上限' : '建立独立档案'}</button></div>
}

function EvidenceDialog({ object, initialTab = 'paste' }) {
  const [tab, setTab] = useState(initialTab)
  return <div className="modal-card evidence-dialog"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><div className="modal-heading"><div className="modal-icon"><FileUp /></div><div><small>按需提供，不是必选</small><h2>为 {object.displayName} 添加关系证据</h2></div></div><div className="intake-tabs"><button className={tab === 'paste' ? 'is-active' : ''} onClick={() => setTab('paste')}><Clipboard size={15} />粘贴</button><button className={tab === 'image' ? 'is-active' : ''} onClick={() => setTab('image')}><ImagePlus size={15} />截图 / 文件</button><button className={tab === 'chatlab' ? 'is-active' : ''} onClick={() => setTab('chatlab')}><Database size={15} />ChatLab</button><button className={tab === 'readonly' ? 'is-active' : ''} onClick={() => setTab('readonly')}><LockKeyhole size={15} />电脑只读</button></div>
    {tab === 'paste' && <div className="intake-panel"><textarea defaultValue={'sender_id: user_01 | 周末有空吗？\nsender_id: contact_17 | 周日三点可以，我订票。'} rows={6} /><p><ShieldCheck size={14} />优先使用 sender/member ID；看不出身份时必须先确认一条锚点。</p></div>}
    {tab === 'image' && <div className="drop-zone"><ImagePlus /><strong>选择截图或导出文件</strong><span>只在你主动选择时读取；不会扫描聊天数据库。</span><button>选择公开示例文件</button></div>}
    {tab === 'chatlab' && <div className="permission-copy"><Database /><h3>接入用户已提供的 ChatLab 数据</h3><p>只分析 ChatLab 已有或用户导出的内容，不声称能直接读取微信、QQ 等平台。</p></div>}
    {tab === 'readonly' && <div className="permission-copy"><LockKeyhole /><h3>显式授权、只读、可撤销</h3><p>可以由用户选择任意聊天平台窗口或导出文件；不得解密数据库、绕过权限、后台监控或自动发送。</p></div>}
    <div className="identity-preview"><div><UserRoundCheck size={18} /><span><strong>身份映射</strong><small>{object.identity.status === 'locked' ? '已锁定：user_01 = 用户，contact_17 = 对象' : '导入前需要确认锚点'}</small></span></div><button onClick={() => workspaceStore.importSyntheticEvidence(false)}>确认映射并分析公开样例</button></div>
    <button className="conflict-test" onClick={() => workspaceStore.importSyntheticEvidence(true)}><CircleAlert size={14} />演示跨批次身份冲突停止</button>
  </div>
}

function MemoryDialog({ object }) {
  const grouped = Object.groupBy ? Object.groupBy(object.memories, item => item.scope) : object.memories.reduce((all, item) => ({ ...all, [item.scope]: [...(all[item.scope] || []), item] }), {})
  return <div className="modal-card memory-dialog"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><div className="modal-heading"><div className="modal-icon"><MemoryStick /></div><div><small>只召回当前对象</small><h2>{object.displayName} 的长期记忆</h2></div></div><div className="memory-controls"><span className={object.memoryPaused ? 'is-paused' : ''}><span />{object.memoryPaused ? '记忆已暂停' : '记忆已启用'}</span><button onClick={() => workspaceStore.toggleMemoryPause()}>{object.memoryPaused ? <><ArchiveRestore size={14} />恢复</> : <><Pause size={14} />暂停</>}</button><button onClick={() => workspaceStore.undoMemory()}><Undo2 size={14} />撤销</button></div><p className="memory-policy">原始聊天留在本地证据库；这里只保存 user / object / relationship / event / hypothesis 五类精简记忆。</p><div className="memory-groups">{Object.entries(grouped).map(([scope, items]) => <section key={scope}><h3>{scope}<span>{items.length}</span></h3>{items.map(item => <div key={item.id}><strong>{item.field}</strong><p>{item.value}</p><small>{item.confidence} confidence</small></div>)}</section>)}</div><button className="secondary-action wide" onClick={() => workspaceStore.addDemoMemory()}><Plus size={15} />添加一条公开演示记忆</button></div>
}

function ConflictDialog({ identity }) {
  return <div className="modal-card conflict-dialog"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><div className="conflict-mark"><CircleAlert /></div><small>IDENTITY CONFLICT · IMPORT PAUSED</small><h2>检测到“认反人”风险，已停止分析。</h2><p>{identity.reason}</p><div className="conflict-rule"><strong>已有映射保持不变</strong><span>不会根据左右气泡、性别或语气覆盖 sender ID。</span></div><button className="primary-action wide" onClick={() => workspaceStore.setOverlay({ type: 'evidence' })}>返回并重新确认锚点</button></div>
}

function Overlay({ state, object }) {
  if (!state.overlay) return null
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    {state.overlay.type === 'create' && <CreateObjectDialog suggestedName={state.overlay.suggestedName} />}
    {state.overlay.type === 'evidence' && object && <EvidenceDialog object={object} initialTab={state.overlay.tab} />}
    {state.overlay.type === 'memory' && object && <MemoryDialog object={object} />}
    {state.overlay.type === 'conflict' && <ConflictDialog identity={state.overlay.identity} />}
  </div>
}

function Notice({ text }) {
  if (!text) return null
  return <div className="notice-toast"><Check size={15} />{text}</div>
}

function ConversationWorkspace() {
  const state = useWorkspace()
  const object = useActiveObject(state)
  return <section className="conversation-workspace">
    {object ? <><WorkspaceHeader object={object} state={state} />{state.view === 'progress' ? <ProgressView object={object} /> : <ChatView object={object} />}</> : <EmptyWorkspace />}
    <Overlay state={state} object={object} />
    <Notice text={state.notice} />
  </section>
}

export const inject = ['slots']

export function apply(ctx) {
  ctx.effect(() => {
    const style = document.createElement('style')
    style.dataset.plugin = PLUGIN_ID
    style.textContent = styles
    document.head.appendChild(style)
    return () => style.remove()
  }, 'goutoujunshi: visual system')

  ctx.effect(() => ctx.slots.register({ name: 'sidebar', priority: -100 }, ObjectSidebar), 'goutoujunshi: object drawer')
  ctx.effect(() => ctx.slots.register({ name: 'conversation', priority: -100 }, ConversationWorkspace), 'goutoujunshi: conversation workspace')
}
