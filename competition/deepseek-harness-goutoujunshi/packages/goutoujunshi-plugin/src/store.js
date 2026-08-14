import {
  addObject,
  analyzeTurn,
  appendMemory,
  lockIdentityMapping,
  publicSyntheticCase,
  undoLastMemoryOperation,
} from './domain.js'

const STORAGE_KEY = 'goai:goutoujunshi:workspace:v1'
const EMPTY_STATE = Object.freeze({
  version: 1,
  objects: [],
  activeObjectId: null,
  view: 'chat',
  overlay: null,
  notice: null,
})

function parseStoredState() {
  if (typeof window === 'undefined') return { ...EMPTY_STATE }
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || 'null')
    if (!saved || saved.version !== 1 || !Array.isArray(saved.objects)) return { ...EMPTY_STATE }
    return { ...EMPTY_STATE, ...saved, overlay: null, notice: null }
  } catch {
    return { ...EMPTY_STATE }
  }
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
      const { overlay: _overlay, notice: _notice, ...durable } = next
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(durable))
    }
    for (const listener of this.listeners) listener()
  }

  patch(delta, persist = true) {
    this.emit({ ...this.state, ...delta }, persist)
  }

  loadDemo() {
    const demo = publicSyntheticCase()
    this.emit({ ...EMPTY_STATE, ...demo, view: 'chat', notice: '已载入完全公开的合成案例；不含任何真实聊天。' })
  }

  reset() {
    if (typeof window !== 'undefined') window.localStorage.removeItem(STORAGE_KEY)
    this.emit({ ...EMPTY_STATE })
  }

  createObject(displayName) {
    const objects = addObject(this.state.objects, displayName)
    const activeObjectId = objects.at(-1).id
    this.emit({ ...this.state, objects, activeObjectId, overlay: null, view: 'chat', notice: `已为“${displayName}”建立独立档案。` })
  }

  selectObject(activeObjectId) {
    this.patch({ activeObjectId, view: 'chat', overlay: null })
  }

  renameObject(id, displayName) {
    const value = String(displayName).trim().slice(0, 18)
    if (!value) return
    this.patch({ objects: this.state.objects.map(item => item.id === id ? { ...item, displayName: value } : item) })
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
    if (!this.state.activeObjectId) {
      const candidate = /(?:叫|是|对象|喜欢)([\u4e00-\u9fffA-Za-z0-9·_-]{1,8})/.exec(value)?.[1]
      this.patch({ overlay: { type: 'create', suggestedName: candidate || '' }, notice: '这像是在说一个稳定对象。是否为 TA 建立独立档案？' }, false)
      return
    }
    this.mutateActive(object => {
      const userMessage = { id: `msg_${Date.now()}_u`, role: 'user', text: value, at: new Date().toISOString() }
      const analysis = analyzeTurn({ text: value, object })
      const assistantMessage = {
        id: `msg_${Date.now()}_a`,
        role: 'assistant',
        text: analysis.emotion,
        analysis,
        at: new Date().toISOString(),
      }
      return { ...object, messages: [...object.messages, userMessage, assistantMessage] }
    })
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
      messages: object.messages.map(message => message.id === messageId
        ? { ...message, confirmed: true }
        : message),
      tasks: [...object.tasks, { id: `task_${Date.now()}`, sourceMessageId: messageId, status: 'confirmed' }],
    }), { notice: '行动方案已由你确认；军师不会替你发送消息。' })
  }

  copyScript(text) {
    if (typeof navigator !== 'undefined') void navigator.clipboard?.writeText(text)
    this.patch({ notice: '话术已复制；发送前仍由你最终确认。' }, false)
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
      notice: identity.status === 'locked' ? '身份映射已锁定，证据引用已写入当前对象。' : '检测到身份冲突，已暂停导入。',
    })
  }

  addDemoMemory() {
    this.mutateActive(object => appendMemory(object, {
      scope: 'event', subjectId: object.id, field: 'followup_window',
      value: '用户选择在 48 小时观察窗口内只看具体回应', confidence: 'high',
    }), { notice: '已保存一条精简事件记忆；原始聊天未进入长期记忆。' })
  }

  undoMemory() {
    this.mutateActive(undoLastMemoryOperation, { notice: '已撤销上一条记忆变更。' })
  }

  toggleMemoryPause() {
    this.mutateActive(object => ({ ...object, memoryPaused: !object.memoryPaused }), { notice: '记忆状态已更新。' })
  }
}

export const workspaceStore = new WorkspaceStore()
