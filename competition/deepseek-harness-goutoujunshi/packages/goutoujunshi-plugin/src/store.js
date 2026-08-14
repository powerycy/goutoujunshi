import {
  addObject,
  analyzeTurn,
  appendMemory,
  archiveRelationshipObject,
  lockIdentityMapping,
  publicSyntheticCase,
  restoreRelationshipObject,
  undoLastMemoryOperation,
} from './domain.js'

const STORAGE_KEY = 'goai:goutoujunshi:workspace:v2'
const EMPTY_STATE = Object.freeze({
  version: 2,
  objects: [],
  archivedObjects: [],
  activeObjectId: null,
  sessionMode: 'temporary',
  temporaryMessages: [],
  view: 'chat',
  overlay: null,
  notice: null,
})

function parseStoredState() {
  if (typeof window === 'undefined') return { ...EMPTY_STATE }
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved || saved.version !== 2 || !Array.isArray(saved.objects)) return { ...EMPTY_STATE }
    return { ...EMPTY_STATE, ...saved, temporaryMessages: [], overlay: null, notice: null }
  } catch {
    return { ...EMPTY_STATE }
  }
}

function assistantText(analysis, object, temporary) {
  if (!object.evidence.length) {
    return `${analysis.emotion}\n\n我先不急着替你下结论。你能告诉我最近一次让你卡住的具体互动吗？当时对方说了什么、做了什么，你原本希望发生什么？\n\n${temporary ? '这次只是临时聊聊，我不会把内容写进长期记忆。' : '如果有聊天原句，也可以直接贴在这里；不需要先上传完整记录。'}`
  }
  const facts = analysis.facts.slice(0, 3).join('；') || '现在还没有足够的可观察事实'
  return `${analysis.emotion}\n\n目前能确认的是：${facts}。我的判断是${analysis.inferences[0]}但对方真实的内心和未记录的现实安排，我们还不知道。\n\n如果你想${analysis.decision}，可以先发：\n“${analysis.script}”\n\n发出后${analysis.observationWindow}${analysis.stopConditions.slice(0, 2).join('；')}时就停下来。你要不要我把这句话改得更像你的语气？`
}

function nextMessages(text, object, temporary = false) {
  const now = Date.now()
  const analysis = analyzeTurn({ text, object })
  return [
    { id: `msg_${now}_u`, role: 'user', text, at: new Date().toISOString() },
    {
      id: `msg_${now}_a`,
      role: 'assistant',
      text: assistantText(analysis, object, temporary),
      analysis,
      at: new Date().toISOString(),
    },
  ]
}

class WorkspaceStore {
  state = parseStoredState()
  listeners = new Set()

  subscribe = listener => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  getSnapshot = () => this.state

  emit(next, persist = true) {
    this.state = next
    if (persist && typeof window !== 'undefined') {
      const { overlay: _overlay, notice: _notice, temporaryMessages: _temporary, ...durable } = next
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(durable))
    }
    for (const listener of this.listeners) listener()
  }

  patch(delta, persist = true) {
    this.emit({ ...this.state, ...delta }, persist)
  }

  loadDemo() {
    const demo = publicSyntheticCase()
    this.emit({
      ...EMPTY_STATE,
      ...demo,
      archivedObjects: [],
      sessionMode: 'profile',
      view: 'chat',
      notice: '已载入公开合成案例。',
    })
  }

  reset() {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
    this.emit({ ...EMPTY_STATE })
  }

  startTemporary() {
    this.patch({ sessionMode: 'temporary', activeObjectId: null, view: 'chat', overlay: null })
  }

  clearTemporary() {
    this.patch({ temporaryMessages: [], notice: '临时对话已清空。' }, false)
  }

  createObject(displayName) {
    const objects = addObject(this.state.objects, displayName)
    const activeObjectId = objects.at(-1).id
    this.emit({ ...this.state, objects, activeObjectId, sessionMode: 'profile', overlay: null, view: 'chat', notice: `已为“${displayName}”建立档案。` })
  }

  selectObject(activeObjectId) {
    this.patch({ activeObjectId, sessionMode: 'profile', view: 'chat', overlay: null })
  }

  renameObject(id, displayName) {
    const value = String(displayName).trim().slice(0, 18)
    if (!value) return
    this.patch({ objects: this.state.objects.map(item => item.id === id ? { ...item, displayName: value } : item) })
  }

  archiveObject(id) {
    const object = this.state.objects.find(item => item.id === id)
    if (!object) return
    const archived = archiveRelationshipObject(this.state.objects, this.state.archivedObjects, id)
    this.emit({
      ...this.state,
      ...archived,
      activeObjectId: null,
      sessionMode: 'temporary',
      view: 'chat',
      overlay: null,
      notice: `已归档“${object.displayName}”。资料没有删除，随时可以恢复。`,
    })
  }

  restoreObject(id) {
    const object = this.state.archivedObjects.find(item => item.id === id)
    if (!object || this.state.objects.length >= 5) return
    const restored = restoreRelationshipObject(this.state.objects, this.state.archivedObjects, id)
    this.emit({
      ...this.state,
      ...restored,
      activeObjectId: id,
      sessionMode: 'profile',
      view: 'chat',
      notice: `已恢复“${object.displayName}”。`,
    })
  }

  mutateActive(mutator, extras = {}) {
    const id = this.state.activeObjectId
    if (!id) return
    const objects = this.state.objects.map(item => item.id === id ? mutator(item) : item)
    this.emit({ ...this.state, objects, ...extras })
  }

  send(text) {
    const value = String(text).trim()
    if (!value) return
    if (this.state.sessionMode === 'temporary' || !this.state.activeObjectId) {
      const temporaryObject = { displayName: '这个人', evidence: [], memories: [] }
      this.patch({ temporaryMessages: [...this.state.temporaryMessages, ...nextMessages(value, temporaryObject, true)] }, false)
      return
    }
    this.mutateActive(object => ({ ...object, messages: [...object.messages, ...nextMessages(value, object)] }))
  }

  setView(view) {
    this.patch({ view })
  }

  setOverlay(overlay) {
    this.patch({ overlay }, false)
  }

  confirmDecision(messageId) {
    this.mutateActive(object => ({
      ...object,
      messages: object.messages.map(message => message.id === messageId ? { ...message, confirmed: true } : message),
      tasks: [...object.tasks, { id: `task_${Date.now()}`, sourceMessageId: messageId, status: 'confirmed' }],
    }), { notice: '已记录你的选择；不会自动发送消息。' })
  }

  copyScript(text) {
    if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(text)
    this.patch({ notice: '话术已复制。发送前仍由你决定。' }, false)
  }

  importSyntheticEvidence(conflict = false) {
    const object = this.state.objects.find(item => item.id === this.state.activeObjectId)
    if (!object) return
    const proposed = conflict
      ? { contact_17: 'user' }
      : Object.keys(object.identity.senders).length
        ? object.identity.senders
        : { user_01: 'user', contact_17: 'object' }
    const events = object.evidence.length ? object.evidence : publicSyntheticCase().objects[0].evidence
    const identity = lockIdentityMapping({ previous: object.identity.senders, proposed, events })
    this.mutateActive(current => ({
      ...current,
      identity,
      evidence: identity.status === 'locked' ? events : current.evidence,
    }), {
      overlay: identity.status === 'conflict' ? { type: 'conflict', identity } : null,
      notice: identity.status === 'locked' ? '身份已确认，证据只写入当前档案。' : '身份冲突，已暂停导入。',
    })
  }

  addDemoMemory() {
    this.mutateActive(object => appendMemory(object, {
      scope: 'event', subjectId: object.id, field: 'followup_window',
      value: '用户选择在 48 小时观察窗口内只看具体回应', confidence: 'high',
    }), { notice: '已保存一条精简记忆。' })
  }

  undoMemory() {
    this.mutateActive(undoLastMemoryOperation, { notice: '已撤销上一条记忆变更。' })
  }

  toggleMemoryPause() {
    this.mutateActive(object => ({ ...object, memoryPaused: !object.memoryPaused }), { notice: '记忆状态已更新。' })
  }
}

export const workspaceStore = new WorkspaceStore()
