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
import { buildEvidenceCandles } from './domain.js'
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

function findExactButton(root, label) {
  return [...root.querySelectorAll('button')].find(button => button.textContent?.trim() === label)
}

function openModelSettings() {
  const officialSettings = findExactButton(document, '设置')
  officialSettings?.click()
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const dialog = document.querySelector('[role="dialog"][aria-modal="true"]')
    if (!dialog) return
    dialog.dataset.gjModelSettings = 'true'
    findExactButton(dialog, '模型')?.click()
    requestAnimationFrame(() => {
      const openConfig = findExactButton(dialog, '打开配置文件')
      if (openConfig) openConfig.dataset.gjSettingsHide = 'true'
    })
  }))
}

function useCompactModelSettings() {
  useEffect(() => {
    const mark = () => {
      const settings = findExactButton(document, '设置')
      if (settings) settings.dataset.gjOfficialSettings = 'true'
    }
    mark()
    const observer = new MutationObserver(mark)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => {
      observer.disconnect()
      document.querySelectorAll('[data-gj-official-settings]').forEach(node => node.removeAttribute('data-gj-official-settings'))
    }
  }, [])
}

function ObjectSidebar({ wide = true, expandSidebar }) {
  useCompactModelSettings()
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
      {!collapsed && <button className="model-connect-link" onClick={openModelSettings}><KeyRound size={14} /><span><strong>模型连接</strong><small>DeepSeek · API Key</small></span></button>}
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
  const latest = candles.at(-1)
  const selectedIndex = Math.max(0, candles.findIndex(item => item.id === selected?.id))
  const adviceMessage = [...object.messages].reverse().find(message => message.analysis)
  const advice = adviceMessage?.analysis
  const confirmed = Boolean(adviceMessage?.confirmed)
  const width = 900
  const height = 520
  const left = 0
  const right = 72
  const chartTop = 18
  const chartBottom = 350
  const volumeTop = 382
  const volumeBottom = 476
  const values = candles.flatMap(item => [item.low, item.high])
  const min = Math.max(0, Math.floor(((values.length ? Math.min(...values) : 40) - 3) / 4) * 4)
  const max = Math.min(100, Math.ceil(((values.length ? Math.max(...values) : 70) + 3) / 4) * 4)
  const range = Math.max(20, max - min)
  const topValue = min + range
  const plotWidth = width - left - right
  const xFor = index => left + plotWidth * (index + .5) / Math.max(1, candles.length)
  const yFor = value => chartTop + (topValue - value) * (chartBottom - chartTop) / range
  const ticks = Array.from({ length: 12 }, (_, index) => min + range * index / 11).reverse()
  const verticals = Array.from({ length: 9 }, (_, index) => left + plotWidth * index / 8)
  const latestAt = latest ? new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(latest.at)) : '—'
  const directionLabel = selected?.direction === 'positive' ? '正向进展' : selected?.direction === 'negative' ? '退缩 / 冲突' : '证据不足'
  return <div className="market-terminal">
    <header className="market-terminal-head">
      <div><h2>狗头军师 · 关系决策实验室</h2><em>Evidence → Decision → Observation</em></div>
      <div className="market-terminal-actions"><span>对象&nbsp; {object.displayName}</span><button onClick={() => workspaceStore.setView('chat')}><ArrowLeft size={13} />回到对话</button></div>
    </header>
    <div className="market-timebar">
      <div className="market-timeframes">{['5m', '15m', '30m', '1H', '2H', '4H', '日', '周', '月', '季', '年'].map(value => <button key={value} className={value === '日' ? 'is-active' : ''}>{value}</button>)}</div>
      <span>1d · {candles.length} bars · 最新 {latestAt} · close {latest?.close.toFixed(2) || '—'}</span>
    </div>
    <div className="market-indicators">
      {[['均线', '5,10,20'], ['布林带', '20,2'], ['MACD', '12,26,9'], ['RSI', '14'], ['KDJ', '9,3,3']].map(([name, value]) => <label key={name}><input type="checkbox" />{name}<b>{value}</b></label>)}
      <button>应用</button>
    </div>
    <div className="kline-workspace">
      <section className="kline-chart-card">
        {selected && <div className="market-ohlc"><span>{formatTime(selected.at, true)}</span><span>开 <b>{selected.open.toFixed(2)}</b></span><span>高 <b>{selected.high.toFixed(2)}</b></span><span>低 <b>{selected.low.toFixed(2)}</b></span><span>收 <b>{selected.close.toFixed(2)}</b></span></div>}
        <div className="kline-chart">
          {candles.length ? <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`${object.displayName} 的关系证据 K 线，不预测爱意或成功率`}>
            {ticks.map(value => <g key={value}><line className="k-grid" x1={left} x2={width - right} y1={yFor(value)} y2={yFor(value)} /><text className="k-axis" x={width - right + 12} y={yFor(value) + 4}>{value.toFixed(2)}</text></g>)}
            {verticals.map(value => <line key={value} className="k-grid is-vertical" x1={value} x2={value} y1={chartTop} y2={volumeBottom} />)}
            <line className="volume-rule" x1={left} x2={width - right} y1={volumeTop - 12} y2={volumeTop - 12} />
            {candles.map((item, index) => {
              const x = xFor(index)
              const bodyWidth = Math.min(42, Math.max(20, plotWidth / 18))
              const color = item.direction === 'positive' ? '#d04841' : item.direction === 'negative' ? '#4a8a6e' : '#8a8175'
              const bodyTop = Math.min(yFor(item.open), yFor(item.close))
              const bodyHeight = Math.max(3, Math.abs(yFor(item.open) - yFor(item.close)))
              const volumeHeight = Math.max(12, item.completeness * 64 + Math.abs(item.close - item.open) * 1.4)
              return <g key={item.id} className="k-candle" tabIndex="0" onMouseEnter={() => setSelectedId(item.id)} onFocus={() => setSelectedId(item.id)}>
                <line x1={x} x2={x} y1={yFor(item.high)} y2={yFor(item.low)} stroke={color} strokeWidth="2" />
                <rect x={x - bodyWidth / 2} y={bodyTop} width={bodyWidth} height={bodyHeight} fill={color} />
                <rect x={x - bodyWidth / 2} y={volumeBottom - volumeHeight} width={bodyWidth} height={volumeHeight} fill={color} opacity=".66" />
                {index % 2 === 0 && <text className="k-date" x={x} y={height - 15} textAnchor="middle">{new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(item.at))}</text>}
              </g>
            })}
            {selected && <>
              <line className="k-crosshair" x1={xFor(selectedIndex)} x2={xFor(selectedIndex)} y1={chartTop} y2={volumeBottom} />
              <line className="k-current-line" x1={left} x2={width - right} y1={yFor(selected.close)} y2={yFor(selected.close)} />
              <rect className="k-current-label" x={width - right} y={yFor(selected.close) - 11} width={right - 7} height="22" />
              <text className="k-current-text" x={width - right + 7} y={yFor(selected.close) + 4}>{selected.close.toFixed(2)}</text>
            </>}
            <text className="volume-label" x={left + 6} y={volumeTop}>证据量</text>
            <rect className="k-volume-label" x={width - right} y={volumeBottom - 21} width={right - 7} height="21" />
            <text className="k-current-text" x={width - right + 7} y={volumeBottom - 6}>{selected ? (selected.completeness * 3.1).toFixed(1) : '0.0'}</text>
          </svg> : <div className="kline-empty">还没有足够证据。回到对话，把具体互动讲给军师。</div>}
        </div>
      </section>
      <aside className="kline-inspector">
        <div className="inspector-step"><small>当前一步</small><h2>步</h2></div>
        {selected ? <>
          <div className={`direction-block is-${selected.direction}`}><span>{directionLabel} · {formatTime(selected.at, true)}</span><strong>{selected.reason}</strong></div>
          <ul className="evidence-points"><li>{selected.observableFact}</li><li>{selected.summary}</li><li>{selected.source} · 完整度 {Math.round(selected.completeness * 100)}%</li></ul>
          <div className="decision-box is-window"><strong>观察窗口</strong><p>{advice?.observationWindow || '先观察下一次具体回应，不用急着定义关系。'}</p></div>
          <div className="decision-box is-stop"><strong>停止条件</strong><p>{advice?.stopConditions?.slice(0, 2).join('；') || '明确拒绝，或持续回避具体安排。'}</p></div>
          <button className="decision-confirm" disabled={!adviceMessage || confirmed} onClick={() => adviceMessage && workspaceStore.confirmDecision(adviceMessage.id)}>{confirmed ? '已由你确认' : '确认采用这一步'}</button>
          <p className="inspector-foot">每根 K 线都来自可回看的证据引用。图表不预测爱意、忠诚或成功率。</p>
        </> : <p className="inspector-empty">悬停任意 K 线查看证据。</p>}
      </aside>
    </div>
  </div>
}

function ProgressView({ object }) {
  return <main className="progress-view"><EvidenceKline object={object} /><p className="kline-caveat"><CircleAlert size={14} />红色正向、绿色退缩、灰色证据不足；它是证据图，不是感情预测。</p></main>
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
  useEffect(() => {
    if (!state.notice) return undefined
    const timer = window.setTimeout(() => workspaceStore.clearNotice(), 1800)
    return () => window.clearTimeout(timer)
  }, [state.notice])
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
