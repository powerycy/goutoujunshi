import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import {
  Archive,
  ArrowLeft,
  Bot,
  Check,
  CircleAlert,
  Clipboard,
  Database,
  FileUp,
  ImagePlus,
  KeyRound,
  LockKeyhole,
  MessageCircle,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  UserRoundCheck,
  X,
} from 'lucide-react'
import dogLogo from '../assets/doghead-logo.png'
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
    ? { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' }).format(date)
}

function Brand({ collapsed }) {
  return <div className={`sidebar-brand ${collapsed ? 'is-compact' : ''}`}>
    <img src={dogLogo} alt="狗头军师 Logo" />
    {!collapsed && <div><strong>狗头军师</strong><span>DeepSeek Harness Agent</span></div>}
  </div>
}

function ObjectSidebar({ wide = true, expandSidebar }) {
  const state = useWorkspace()
  const active = useActiveObject(state)
  const temporary = state.sessionMode === 'temporary' || !active
  const collapsed = !wide
  const select = action => {
    if (collapsed) expandSidebar?.()
    action()
  }
  return <aside className={`object-sidebar ${collapsed ? 'is-collapsed' : ''}`} aria-label="关系对象">
    <Brand collapsed={collapsed} />

    <button className={`temporary-entry ${temporary ? 'is-active' : ''}`} onClick={() => select(() => workspaceStore.startTemporary())} title="临时问问">
      <MessageCircle size={18} />
      {!collapsed && <span><strong>临时问问</strong><small>不建档 · 不写长期记忆</small></span>}
    </button>

    {!collapsed && <div className="sidebar-heading"><span>关系档案</span><small>{state.objects.length}/5</small></div>}
    <nav className="object-list" aria-label="关系档案列表">
      {state.objects.map((object, index) => <button
        key={object.id}
        className={`object-row ${object.id === active?.id && !temporary ? 'is-active' : ''}`}
        onClick={() => select(() => workspaceStore.selectObject(object.id))}
        title={collapsed ? object.displayName : undefined}
      >
        <span className="object-avatar">{object.displayName.slice(0, 1) || index + 1}</span>
        {!collapsed && <span className="object-row-copy"><strong>{object.displayName}</strong><small>{object.messages.length} 条对话 · {object.evidence.length} 条证据</small></span>}
      </button>)}
      {!state.objects.length && !collapsed && <p className="sidebar-empty">持续聊到同一个人时，再建立档案。</p>}
    </nav>

    <button className="new-object-link" onClick={() => workspaceStore.setOverlay({ type: 'create', suggestedName: '' })}>
      <Plus size={16} /> {!collapsed && '建立关系档案'}
    </button>

    {!collapsed && state.archivedObjects.length > 0 && <details className="archive-list">
      <summary>已归档 · {state.archivedObjects.length}</summary>
      {state.archivedObjects.map(object => <button key={object.id} onClick={() => workspaceStore.restoreObject(object.id)}><RotateCcw size={13} />恢复 {object.displayName}</button>)}
    </details>}

    <div className="sidebar-foot">
      {!collapsed && <button className="demo-link" onClick={() => workspaceStore.loadDemo()}><Sparkles size={14} />载入公开案例</button>}
      {!collapsed && <div className="model-hint"><KeyRound size={14} /><span><strong>模型与 API Key</strong><small>在下方设置中连接</small></span></div>}
    </div>
  </aside>
}

function WorkspaceHeader({ object, temporary, state }) {
  const [renaming, setRenaming] = useState(false)
  const [name, setName] = useState(object.displayName)
  const saveName = () => {
    workspaceStore.renameObject(object.id, name)
    setRenaming(false)
  }
  return <header className="workspace-header">
    <div className="session-identity">
      <img src={dogLogo} alt="" />
      <div>
        {temporary ? <h1>临时问问</h1> : renaming ? <span className="rename-inline"><input value={name} onChange={event => setName(event.target.value)} onKeyDown={event => event.key === 'Enter' && saveName()} autoFocus /><button onClick={saveName}><Check size={14} /></button></span> : <h1>{object.displayName}</h1>}
        <p>{temporary ? '本次对话不建档，也不写长期记忆' : <><button onClick={() => setRenaming(true)}>改名</button><span>·</span><button className="archive-link" onClick={() => workspaceStore.setOverlay({ type: 'archive' })}>归档这段关系</button></>}</p>
      </div>
    </div>
    {!temporary && <div className="view-switch" role="tablist" aria-label="对象视图">
      <button className={state.view === 'chat' ? 'is-active' : ''} onClick={() => workspaceStore.setView('chat')}><MessageCircle size={15} />对话</button>
      <button className={state.view === 'progress' ? 'is-active' : ''} onClick={() => workspaceStore.setView('progress')}><TrendingUp size={15} />关系进展</button>
    </div>}
    {temporary && state.temporaryMessages.length > 0 && <button className="clear-temporary" onClick={() => workspaceStore.clearTemporary()}>清空本次对话</button>}
  </header>
}

function ChatMessage({ message, temporary }) {
  const assistant = message.role === 'assistant'
  return <article className={`chat-message is-${message.role}`}>
    {assistant && <img src={dogLogo} alt="狗头军师" />}
    <div className="message-content">
      {assistant && <strong>狗头军师</strong>}
      <p>{message.text}</p>
      <time>{formatTime(message.at)}</time>
      {assistant && message.analysis?.facts?.length > 0 && !temporary && <div className="message-actions">
        <button onClick={() => workspaceStore.copyScript(message.analysis.script)}><Clipboard size={13} />复制话术</button>
        <button disabled={message.confirmed} onClick={() => workspaceStore.confirmDecision(message.id)}>{message.confirmed ? <><Check size={13} />已采用</> : '采用这一步'}</button>
      </div>}
    </div>
  </article>
}

function ConversationStarter({ temporary, name }) {
  return <div className="conversation-starter">
    <img src={dogLogo} alt="狗头军师" />
    <h2>{temporary ? '这次只聊，不留长期记忆。' : `聊聊你和${name}最近怎么了。`}</h2>
    <p>像平时聊天一样说就行。我会先听你讲，再问必要的信息，不急着给关系下结论。</p>
    <div>
      <button onClick={() => workspaceStore.send('我有点拿不准对方最近的态度。')}>TA 最近忽冷忽热</button>
      <button onClick={() => workspaceStore.send('我们刚发生了冲突，我不知道怎么开口。')}>冲突后怎么开口</button>
      <button onClick={() => workspaceStore.send('我觉得自己一直在投入，想知道是不是该放弃。')}>我是不是该放弃</button>
    </div>
  </div>
}

function Composer({ object, temporary }) {
  const [text, setText] = useState('')
  const submit = () => {
    workspaceStore.send(text)
    setText('')
  }
  return <div className="composer-wrap">
    <div className="composer">
      <button className="composer-plus" onClick={() => workspaceStore.setOverlay(temporary ? { type: 'temporary-help' } : { type: 'evidence', tab: 'paste' })} aria-label="添加聊天内容"><Plus size={19} /></button>
      <textarea value={text} onChange={event => setText(event.target.value)} onKeyDown={event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() }
      }} placeholder={temporary ? '直接跟军师说说，或粘贴一段聊天…' : `跟军师说说你和${object.displayName}怎么了…`} rows={2} />
      <button className="send-button" onClick={submit} disabled={!text.trim()} aria-label="发送"><Send size={18} /></button>
    </div>
    <p>{temporary ? '临时模式：刷新后清空，不写长期记忆。' : '档案模式：只召回当前对象；消息发送始终由你确认。'}</p>
  </div>
}

function ChatView({ object, temporary, messages }) {
  return <div className="chat-view">
    <div className="chat-scroll">
      {!messages.length ? <ConversationStarter temporary={temporary} name={object.displayName} /> : messages.map(message => <ChatMessage key={message.id} message={message} temporary={temporary} />)}
    </div>
    <Composer object={object} temporary={temporary} />
  </div>
}

function EvidenceKline({ object }) {
  const candles = useMemo(() => buildEvidenceCandles(object.evidence), [object.evidence])
  const [selectedId, setSelectedId] = useState(null)
  const selected = candles.find(item => item.id === selectedId) || candles.at(-1)
  const width = 900
  const height = 470
  const left = 26
  const right = 72
  const chartTop = 32
  const chartBottom = 330
  const volumeTop = 358
  const volumeBottom = 430
  const values = candles.flatMap(item => [item.low, item.high])
  const min = Math.max(0, Math.floor(((values.length ? Math.min(...values) : 40) - 3) / 4) * 4)
  const max = Math.min(100, Math.ceil(((values.length ? Math.max(...values) : 70) + 3) / 4) * 4)
  const range = Math.max(20, max - min)
  const topValue = min + range
  const plotWidth = width - left - right
  const xFor = index => left + plotWidth * (index + .5) / Math.max(1, candles.length)
  const yFor = value => chartTop + (topValue - value) * (chartBottom - chartTop) / range
  const ticks = Array.from({ length: 6 }, (_, index) => min + range * index / 5).reverse()
  return <div className="kline-workspace">
    <section className="kline-chart-card">
      <div className="kline-toolbar">
        <div className="timeframes"><button className="is-active">日</button><button>周</button><button>月</button></div>
        <span>1D · {candles.length} bars · 证据指数</span>
      </div>
      <div className="kline-chart">
        {candles.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${object.displayName} 的关系证据 K 线，不预测爱意或成功率`}>
          {ticks.map(value => <g key={value}><line className="k-grid" x1={left} x2={width - right} y1={yFor(value)} y2={yFor(value)} /><text className="k-axis" x={width - right + 12} y={yFor(value) + 4}>{value.toFixed(1)}</text></g>)}
          <line className="volume-rule" x1={left} x2={width - right} y1={volumeTop - 12} y2={volumeTop - 12} />
          {candles.map((item, index) => {
            const x = xFor(index)
            const spacing = plotWidth / Math.max(1, candles.length)
            const bodyWidth = Math.min(58, Math.max(12, spacing * .46))
            const color = item.direction === 'positive' ? '#d04841' : item.direction === 'negative' ? '#4a8a6e' : '#8a8175'
            const bodyTop = Math.min(yFor(item.open), yFor(item.close))
            const bodyHeight = Math.max(3, Math.abs(yFor(item.open) - yFor(item.close)))
            const volumeHeight = Math.max(10, item.completeness * 52 + Math.abs(item.close - item.open) * 2)
            return <g key={item.id} className="k-candle" tabIndex="0" onMouseEnter={() => setSelectedId(item.id)} onFocus={() => setSelectedId(item.id)}>
              <line x1={x} x2={x} y1={yFor(item.high)} y2={yFor(item.low)} stroke={color} strokeWidth="2" />
              <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
              <rect x={x - bodyWidth / 2} y={volumeBottom - volumeHeight} width={bodyWidth} height={volumeHeight} fill={color} opacity=".58" />
              <text className="k-date" x={x} y={height - 16} textAnchor="middle">{new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit' }).format(new Date(item.at))}</text>
            </g>
          })}
          <text className="volume-label" x={left} y={volumeTop}>证据量</text>
        </svg> : <div className="kline-empty">还没有足够证据。回到对话，把具体互动讲给军师。</div>}
      </div>
    </section>
    <aside className="kline-inspector">
      <div><small>狗头军师 · 证据解释</small><h2>{object.displayName} 的关系进展</h2><p>只回看事实，不预测爱意、忠诚或成功率。</p></div>
      {selected ? <>
        <div className={`direction-block is-${selected.direction}`}><span>{selected.direction === 'positive' ? '正向进展' : selected.direction === 'negative' ? '退缩 / 冲突' : '证据不足'}</span><strong>{selected.reason}</strong></div>
        <dl><dt>时间</dt><dd>{formatTime(selected.at, true)}</dd><dt>可观察事实</dt><dd>{selected.observableFact}</dd><dt>代表消息</dt><dd>{selected.summary}</dd><dt>来源</dt><dd>{selected.source}</dd><dt>完整度</dt><dd>{Math.round(selected.completeness * 100)}%</dd></dl>
      </> : <p className="inspector-empty">悬停任意 K 线查看证据。</p>}
      <button onClick={() => workspaceStore.setView('chat')}><ArrowLeft size={14} />回到军师对话</button>
    </aside>
  </div>
}

function ProgressView({ object }) {
  return <main className="progress-view"><EvidenceKline object={object} /><p className="kline-caveat"><CircleAlert size={14} />红色代表正向进展，绿色代表退缩或冲突，灰色代表证据不足。每根 K 线都保留来源引用。</p></main>
}

function CreateObjectDialog({ suggestedName = '' }) {
  const state = useWorkspace()
  const [name, setName] = useState(suggestedName)
  const limitReached = state.objects.length >= 5
  return <div className="modal-card"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><small>关系档案</small><h2>要持续聊这个人吗？</h2><p>只有需要跨会话记住同一个人时才建档。只是问一次，请留在“临时问问”。</p><label>显示代号<input value={name} onChange={event => setName(event.target.value)} placeholder="例如：小北" maxLength={18} autoFocus /></label><button className="primary-button" disabled={!name.trim() || limitReached} onClick={() => workspaceStore.createObject(name)}>{limitReached ? '已达到 5 个档案上限' : '建立档案'}</button></div>
}

function TemporaryHelpDialog() {
  return <div className="modal-card"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><small>临时模式</small><h2>直接粘贴就可以</h2><p>把聊天片段、事情经过或你最卡的一句话直接贴进输入框。军师会在对话里继续问必要信息；刷新后本次内容清空，不写长期记忆。</p><button className="secondary-button" onClick={() => { workspaceStore.setOverlay(null); workspaceStore.send('公开样例：我约 TA 周末吃饭，TA 说最近有点忙，没有给新的时间。') }}>用一段公开样例试试</button></div>
}

function EvidenceDialog({ object, initialTab = 'paste' }) {
  const [tab, setTab] = useState(initialTab)
  return <div className="modal-card evidence-dialog"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><small>按需提供</small><h2>添加关系证据</h2><div className="intake-tabs"><button className={tab === 'paste' ? 'is-active' : ''} onClick={() => setTab('paste')}><Clipboard size={14} />粘贴</button><button className={tab === 'image' ? 'is-active' : ''} onClick={() => setTab('image')}><ImagePlus size={14} />截图 / 文件</button><button className={tab === 'chatlab' ? 'is-active' : ''} onClick={() => setTab('chatlab')}><Database size={14} />ChatLab</button><button className={tab === 'readonly' ? 'is-active' : ''} onClick={() => setTab('readonly')}><LockKeyhole size={14} />电脑只读</button></div>
    {tab === 'paste' && <div className="intake-panel"><textarea defaultValue={'sender_id: user_01 | 周末有空吗？\nsender_id: contact_17 | 周日三点可以，我订票。'} rows={6} /><p><ShieldCheck size={14} />优先 sender/member ID；缺少元数据时先确认一条锚点。</p></div>}
    {tab === 'image' && <div className="drop-zone"><FileUp /><strong>选择截图或导出文件</strong><span>只在你主动选择时读取，不扫描聊天数据库。</span></div>}
    {tab === 'chatlab' && <div className="drop-zone"><Database /><strong>连接用户提供的 ChatLab 数据</strong><span>只读已有内容，不直接读取微信或 QQ。</span></div>}
    {tab === 'readonly' && <div className="drop-zone"><LockKeyhole /><strong>显式授权、只读、可撤销</strong><span>不解密数据库，不后台监控，不自动发送。</span></div>}
    <div className="identity-row"><UserRoundCheck size={17} /><span><strong>身份映射</strong><small>{object.identity.status === 'locked' ? 'user_01 = 用户，contact_17 = 对象' : '分析前需要确认锚点'}</small></span><button onClick={() => workspaceStore.importSyntheticEvidence(false)}>确认并分析样例</button></div>
    <button className="conflict-link" onClick={() => workspaceStore.importSyntheticEvidence(true)}>演示身份冲突停止</button>
  </div>
}

function ArchiveDialog({ object }) {
  return <div className="modal-card archive-dialog"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><div className="archive-icon"><Archive /></div><small>结束当前关注</small><h2>归档“{object.displayName}”？</h2><p>TA 会从关系对象列表移走。会话、证据和记忆不会删除，之后仍可恢复；归档后自动回到“临时问问”。</p><button className="archive-confirm" onClick={() => workspaceStore.archiveObject(object.id)}>归档这段关系</button><button className="secondary-button" onClick={() => workspaceStore.setOverlay(null)}>继续保留</button></div>
}

function ConflictDialog({ identity }) {
  return <div className="modal-card conflict-dialog"><button className="modal-close" onClick={() => workspaceStore.setOverlay(null)}><X size={18} /></button><CircleAlert className="conflict-icon" /><small>IDENTITY CONFLICT · STOPPED</small><h2>可能认反人，已停止分析。</h2><p>{identity.reason}</p><button className="primary-button" onClick={() => workspaceStore.setOverlay({ type: 'evidence' })}>重新确认锚点</button></div>
}

function Overlay({ state, object }) {
  if (!state.overlay) return null
  return <div className="modal-backdrop" role="dialog" aria-modal="true">
    {state.overlay.type === 'create' && <CreateObjectDialog suggestedName={state.overlay.suggestedName} />}
    {state.overlay.type === 'temporary-help' && <TemporaryHelpDialog />}
    {state.overlay.type === 'evidence' && object && <EvidenceDialog object={object} initialTab={state.overlay.tab} />}
    {state.overlay.type === 'archive' && object && <ArchiveDialog object={object} />}
    {state.overlay.type === 'conflict' && <ConflictDialog identity={state.overlay.identity} />}
  </div>
}

function ConversationWorkspace({ sessionId }) {
  const state = useWorkspace()
  const previousSession = useRef(sessionId)
  useEffect(() => {
    if (previousSession.current !== sessionId) {
      previousSession.current = sessionId
      workspaceStore.clearTemporary()
      workspaceStore.startTemporary()
    }
  }, [sessionId])
  const active = useActiveObject(state)
  const temporary = state.sessionMode === 'temporary' || !active
  const object = temporary ? { id: 'temporary', displayName: '临时问问', messages: state.temporaryMessages, memories: [], evidence: [] } : active
  const messages = temporary ? state.temporaryMessages : object.messages
  return <section className="conversation-workspace">
    <WorkspaceHeader object={object} temporary={temporary} state={state} />
    {!temporary && state.view === 'progress' ? <ProgressView object={object} /> : <ChatView object={object} temporary={temporary} messages={messages} />}
    <Overlay state={state} object={active} />
    {state.notice && <div className="notice-toast"><Check size={14} />{state.notice}</div>}
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

  ctx.effect(() => ctx.slots.register({ name: 'sidebar.workspaces', priority: -100 }, ObjectSidebar), 'goutoujunshi: object drawer')
  ctx.effect(() => ctx.slots.register({ name: 'conversation', priority: -100 }, ConversationWorkspace), 'goutoujunshi: conversation workspace')
}
