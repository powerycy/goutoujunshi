export const MAX_OBJECTS = 5
export const MEMORY_SCOPES = Object.freeze(['user', 'object', 'relationship', 'event', 'hypothesis'])

const POSITIVE_WORDS = ['主动', '兑现', '具体', '确认', '修复', '回应', '投入']
const NEGATIVE_WORDS = ['取消', '失约', '冲突', '冷淡', '回避', '下降', '拒绝']

export function stableObjectId(seed, occupied = []) {
  const normalized = String(seed || 'object')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '') || 'object'
  let suffix = 1
  let candidate = `obj_${normalized}`
  while (occupied.includes(candidate)) candidate = `obj_${normalized}_${++suffix}`
  return candidate
}

export function createRelationshipObject(displayName, occupied = []) {
  const name = String(displayName || '').trim()
  if (!name) throw new Error('显示代号不能为空')
  return {
    id: stableObjectId(name, occupied),
    displayName: name.slice(0, 18),
    createdAt: new Date().toISOString(),
    memoryEnabled: true,
    memoryPaused: false,
    identity: { status: 'unmapped', senders: {} },
    messages: [],
    memories: [],
    evidence: [],
    tasks: [],
    operations: [],
  }
}

export function addObject(objects, displayName, maximum = MAX_OBJECTS) {
  if (objects.length >= maximum) throw new Error(`最多只能建立 ${maximum} 个对象档案`)
  return [...objects, createRelationshipObject(displayName, objects.map(item => item.id))]
}

export function archiveRelationshipObject(objects, archivedObjects, objectId, archivedAt = new Date().toISOString()) {
  const object = objects.find(item => item.id === objectId)
  if (!object) throw new Error('找不到要归档的关系对象')
  return {
    objects: objects.filter(item => item.id !== objectId),
    archivedObjects: [...archivedObjects, { ...object, archivedAt }],
  }
}

export function restoreRelationshipObject(objects, archivedObjects, objectId, maximum = MAX_OBJECTS) {
  if (objects.length >= maximum) throw new Error(`最多只能建立 ${maximum} 个对象档案`)
  const object = archivedObjects.find(item => item.id === objectId)
  if (!object) throw new Error('找不到要恢复的关系对象')
  const { archivedAt: _archivedAt, ...restored } = object
  return {
    objects: [...objects, restored],
    archivedObjects: archivedObjects.filter(item => item.id !== objectId),
  }
}

export function lockIdentityMapping({ previous = {}, proposed = {}, events = [] }) {
  for (const [senderId, role] of Object.entries(proposed)) {
    if (!['user', 'object'].includes(role)) {
      return { status: 'conflict', reason: `发送者 ${senderId} 的角色无效`, senders: previous }
    }
    if (previous[senderId] && previous[senderId] !== role) {
      return {
        status: 'conflict',
        reason: `发送者 ${senderId} 已锁定为 ${previous[senderId]}，新批次却标成 ${role}`,
        senderId,
        senders: previous,
      }
    }
  }
  const senders = { ...previous, ...proposed }
  const unknown = [...new Set(events.map(event => event.senderId).filter(senderId => !senders[senderId]))]
  if (unknown.length) {
    return {
      status: 'needs_confirmation',
      reason: '缺少发送者元数据，请先确认一条锚点消息',
      unknown,
      senders,
    }
  }
  if (!Object.values(senders).includes('user') || !Object.values(senders).includes('object')) {
    return {
      status: 'needs_confirmation',
      reason: '需要同时锁定“用户”和“对象”两种身份',
      unknown: [],
      senders,
    }
  }
  return { status: 'locked', senders }
}

export function scoreEvidence(event) {
  if ((event.completeness ?? 0) < 0.5) return 0
  if (typeof event.score === 'number') return Math.max(-2, Math.min(2, event.score))
  const text = `${event.reason || ''} ${event.observableFact || ''}`
  const positive = POSITIVE_WORDS.filter(word => text.includes(word)).length
  const negative = NEGATIVE_WORDS.filter(word => text.includes(word)).length
  return Math.max(-2, Math.min(2, positive - negative))
}

export function classifyEvidence(event) {
  const score = scoreEvidence(event)
  if (score > 0) return 'positive'
  if (score < 0) return 'negative'
  return 'insufficient'
}

export function buildEvidenceCandles(events) {
  let baseline = 50
  const movement = events.length >= 10 ? 3.7 : 8
  return [...events]
    .sort((a, b) => String(a.at).localeCompare(String(b.at)))
    .map(event => {
      const open = baseline
      const score = scoreEvidence(event)
      const close = Math.max(8, Math.min(92, open + score * movement))
      const spread = score === 0 ? 2 : Math.abs(score) * 3 + 2
      const candle = {
        ...event,
        open,
        close,
        high: Math.min(96, Math.max(open, close) + spread),
        low: Math.max(4, Math.min(open, close) - spread),
        direction: classifyEvidence(event),
      }
      baseline = close
      return candle
    })
}

export function appendMemory(object, memory) {
  if (!MEMORY_SCOPES.includes(memory.scope)) throw new Error(`不支持的记忆类型：${memory.scope}`)
  if (memory.subjectId !== object.id && memory.subjectId !== 'user') throw new Error('记忆对象与当前档案不一致')
  const before = object.memories
  const nextMemory = {
    id: memory.id || `mem_${object.id}_${before.length + 1}`,
    createdAt: memory.createdAt || new Date().toISOString(),
    confidence: memory.confidence || 'medium',
    ...memory,
  }
  return {
    ...object,
    memories: [...before, nextMemory],
    operations: [...object.operations, { type: 'memory.append', before, after: [...before, nextMemory] }],
  }
}

export function undoLastMemoryOperation(object) {
  const operation = object.operations.at(-1)
  if (!operation) return object
  return {
    ...object,
    memories: operation.before,
    operations: object.operations.slice(0, -1),
  }
}

export function compressMemories(memories, now = new Date(), detailDays = 90) {
  const cutoff = now.getTime() - detailDays * 86400000
  const recent = []
  const phases = new Map()
  for (const memory of memories) {
    const timestamp = new Date(memory.occurredAt || memory.createdAt || 0).getTime()
    if (!Number.isFinite(timestamp) || timestamp >= cutoff || memory.scope !== 'event') {
      recent.push(memory)
      continue
    }
    const date = new Date(timestamp)
    const phase = `${date.getUTCFullYear()}-Q${Math.floor(date.getUTCMonth() / 3) + 1}`
    const bucket = phases.get(phase) || []
    bucket.push(memory)
    phases.set(phase, bucket)
  }
  const summaries = [...phases.entries()].map(([phase, items]) => ({
    id: `summary_${phase}`,
    scope: 'event',
    subjectId: items[0].subjectId,
    field: 'stage_summary',
    value: `${phase} 阶段共 ${items.length} 条精简事件：${items.map(item => item.value).slice(0, 3).join('；')}`.slice(0, 200),
    occurredAt: `${phase.slice(0, 4)}-01-01T00:00:00.000Z`,
    confidence: 'medium',
    compressedFrom: items.map(item => item.id),
  }))
  return [...recent, ...summaries]
}

export function recallForObject(memories, objectId, question = '') {
  const terms = [...new Set(String(question).match(/[\u4e00-\u9fff]{2,}|[a-z0-9]+/gi) || [])]
  return memories
    .filter(memory => memory.subjectId === objectId || memory.subjectId === 'user')
    .map(memory => ({
      memory,
      score: terms.reduce((score, term) => score + (String(memory.value).includes(term) ? 2 : 0), 0)
        + (memory.scope === 'relationship' ? 1 : 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)
    .map(item => item.memory)
}

export function inferDecisionIntent(text) {
  if (/算了|退出|放下|不联系|结束/.test(text)) return '退出'
  if (/吵|道歉|修复|误会|冲突/.test(text)) return '修复'
  if (/确认|关系|表白|我们算/.test(text)) return '确认'
  return '推进'
}

export function analyzeTurn({ text, object }) {
  const intent = inferDecisionIntent(text)
  const evidence = object.evidence || []
  const positives = evidence.filter(item => classifyEvidence(item) === 'positive')
  const negatives = evidence.filter(item => classifyEvidence(item) === 'negative')
  const name = object.displayName
  const base = {
    emotion: `你在意的不是一句回复本身，而是自己认真投入后，${name} 是否也愿意把关系往前放一点。悬着不确定，很容易让人反复复盘。`,
    facts: [
      ...positives.slice(-2).map(item => item.observableFact),
      ...negatives.slice(-1).map(item => item.observableFact),
    ].filter(Boolean),
    inferences: positives.length > negatives.length
      ? ['目前更像是有回应、但节奏仍需用一次低压力行动验证。']
      : ['目前投入信号不稳定，建议先降低动作成本，再看是否有对等回应。'],
    unknowns: ['无法仅凭记录判断对方的内心、爱意或长期承诺。', '线下状态与未记录的现实安排仍未知。'],
    decision: intent,
    observationWindow: intent === '退出' ? '7 天内不主动补救，观察自己是否恢复稳定。' : '发出后观察 48 小时；只看是否有具体回应或替代安排。',
    stopConditions: ['明确拒绝或要求不要继续联系', '连续两次回避具体安排且不给替代时间', '你需要持续牺牲边界才能维持互动'],
  }
  const scripts = {
    推进: `这周我想去试试那家新开的店。周六下午你有空的话一起？不方便也没关系。`,
    确认: `我挺喜欢我们最近的相处，也想认真往前走。你现在怎么看我们？不用马上给标准答案，我更想听真实想法。`,
    修复: `刚才那段我有点急，表达方式让你不舒服的话我愿意负责。我的重点不是逼你认同，而是想把误会讲清楚。你方便时我们聊十分钟？`,
    退出: `我很珍惜这段相处，但现在的投入方式让我不太舒服。我会先退回自己的生活，不再继续推动；也祝你顺利。`,
  }
  return { ...base, script: scripts[intent] }
}

export function publicSyntheticCase() {
  const object = createRelationshipObject('小北')
  object.identity = { status: 'locked', senders: { user_01: 'user', contact_17: 'object' } }
  object.evidence = [
    {
      id: 'ev_pre01', at: '2026-07-01T12:10:00+08:00', senderId: 'contact_17', score: 1,
      reason: '对方主动延续前一天的话题。', observableFact: '小北午休时主动问起用户提到的电影。',
      summary: '“你昨天说的那部片叫什么？”', source: '公开合成聊天 / batch-pre / msg-01', completeness: 0.93,
    },
    {
      id: 'ev_pre02', at: '2026-07-02T20:30:00+08:00', senderId: 'contact_17', score: 1,
      reason: '对方主动分享近况，并留下继续交流的问题。', observableFact: '小北发来一张晚饭照片并询问用户口味。',
      summary: '“这家辣得有点狠，你能吃辣吗？”', source: '公开合成聊天 / batch-pre / msg-06', completeness: 0.91,
    },
    {
      id: 'ev_pre03', at: '2026-07-03T22:12:00+08:00', senderId: 'contact_17', score: -1,
      reason: '话题在具体邀约出现后中断，没有回应安排。', observableFact: '用户询问周末是否见面后，当晚没有得到回复。',
      summary: '用户：“周末要不要一起看展？”', source: '公开合成聊天 / batch-pre / msg-09', completeness: 0.86,
    },
    {
      id: 'ev_pre04', at: '2026-07-04T19:05:00+08:00', senderId: 'contact_17', score: -1,
      reason: '对方只说明忙，没有回应邀约或提供替代时间。', observableFact: '小北次日回复“昨天太忙了”，随后转移话题。',
      summary: '“昨天太忙了，今天总算下班。”', source: '公开合成聊天 / batch-pre / msg-12', completeness: 0.92,
    },
    {
      id: 'ev_pre05', at: '2026-07-05T11:30:00+08:00', senderId: 'contact_17', score: 2,
      reason: '对方主动修复遗漏，并提出具体替代安排。', observableFact: '小北主动提出下周三晚饭并给出两个地点选项。',
      summary: '“昨天没接住，周三晚饭可以吗？你选东边还是南门？”', source: '公开合成聊天 / batch-pre / msg-16', completeness: 1,
    },
    {
      id: 'ev_pre06', at: '2026-07-07T09:18:00+08:00', senderId: 'contact_17', score: 0,
      reason: '只有表情回应，信息不足。', observableFact: '对方对用户发来的照片点了表情，没有继续文字交流。',
      summary: '“👍”', source: '公开合成聊天 / batch-pre / msg-21', completeness: 0.38,
    },
    {
      id: 'ev_pre07', at: '2026-07-08T23:06:00+08:00', senderId: 'contact_17', score: -1,
      reason: '具体时间临近仍未确认，投入出现下降。', observableFact: '约定前一天，小北没有回应确认时间的信息。',
      summary: '用户：“明天还是七点吗？”', source: '公开合成聊天 / batch-pre / msg-25', completeness: 0.84,
    },
    {
      id: 'ev_pre08', at: '2026-07-09T10:20:00+08:00', senderId: 'contact_17', score: 1,
      reason: '对方补充确认，并承担具体安排。', observableFact: '小北上午确认七点并主动订位。',
      summary: '“七点没问题，我来订位。”', source: '公开合成聊天 / batch-pre / msg-27', completeness: 0.98,
    },
    {
      id: 'ev_pre09', at: '2026-07-10T22:40:00+08:00', senderId: 'contact_17', score: 1,
      reason: '见面后主动延续交流。', observableFact: '分别后小北主动报平安并提到下次想去的地方。',
      summary: '“到家了。下次那家书店也可以去看看。”', source: '公开合成聊天 / batch-pre / msg-33', completeness: 0.96,
    },
    {
      id: 'ev_pre10', at: '2026-07-12T18:45:00+08:00', senderId: 'contact_17', score: -1,
      reason: '对方连续结束话题，没有给出可继续的信息。', observableFact: '两次对话都以“先忙了”结束，未回应用户的问题。',
      summary: '“我先忙了，回头说。”', source: '公开合成聊天 / batch-pre / msg-39', completeness: 0.9,
    },
    {
      id: 'ev_pre11', at: '2026-07-16T21:08:00+08:00', senderId: 'contact_17', score: -1,
      reason: '对方回避具体邀约，也没有提供替代安排。', observableFact: '小北回复最近忙，但没有回答是否见面。',
      summary: '“这几天有点忙，之后再看吧。”', source: '公开合成聊天 / batch-pre / msg-45', completeness: 0.94,
    },
    {
      id: 'ev_001',
      at: '2026-07-18T12:10:00+08:00',
      senderId: 'contact_17',
      score: 1,
      reason: '对方主动延续话题，并提出具体问题。',
      observableFact: '小北在当天午休主动询问用户周末安排。',
      summary: '“你上次说的展还去吗？”',
      source: '公开合成聊天 / batch-a / msg-04',
      completeness: 0.96,
    },
    {
      id: 'ev_002',
      at: '2026-07-20T17:40:00+08:00',
      senderId: 'contact_17',
      score: 2,
      reason: '对方兑现约定，并主动补充见面细节。',
      observableFact: '小北确认了周日 15:00，并发来地点。',
      summary: '“那就三点，地铁口见，我订票。”',
      source: '公开合成聊天 / batch-a / msg-11',
      completeness: 1,
    },
    {
      id: 'ev_003',
      at: '2026-07-27T10:02:00+08:00',
      senderId: 'contact_17',
      score: -1,
      reason: '临时取消且当下没有给替代安排，属于短期退缩证据。',
      observableFact: '见面前五小时取消，未提供新时间。',
      summary: '“今天可能不行了，最近有点乱。”',
      source: '公开合成聊天 / batch-b / msg-03',
      completeness: 0.88,
    },
    {
      id: 'ev_004',
      at: '2026-07-29T21:25:00+08:00',
      senderId: 'contact_17',
      score: 1,
      reason: '两天后主动修复，并给出具体替代时间。',
      observableFact: '小北主动道歉，提出周四晚饭并询问地点偏好。',
      summary: '“前天放你鸽子对不起，周四我请你吃饭补上？”',
      source: '公开合成聊天 / batch-b / msg-08',
      completeness: 1,
    },
    {
      id: 'ev_005',
      at: '2026-08-03T09:15:00+08:00',
      senderId: 'contact_17',
      score: 0,
      reason: '只有表情回应，证据不足，不能据此判断关系进展。',
      observableFact: '对方对照片回复了一个表情，没有继续文字交流。',
      summary: '“🙂”',
      source: '公开合成聊天 / batch-c / msg-02',
      completeness: 0.42,
    },
  ]
  object.memories = [
    { id: 'mem_1', scope: 'object', subjectId: object.id, field: 'schedule', value: '近期工作日较忙，周末更容易见面', confidence: 'high', createdAt: '2026-07-18T12:20:00Z' },
    { id: 'mem_2', scope: 'relationship', subjectId: object.id, field: 'stage', value: '认识约六周，完成两次线下见面', confidence: 'high', createdAt: '2026-07-29T14:00:00Z' },
    { id: 'mem_3', scope: 'hypothesis', subjectId: object.id, field: 'pace', value: '可能更偏好低频但具体的邀约', confidence: 'low', createdAt: '2026-07-30T14:00:00Z' },
  ]
  const demoAnalysis = analyzeTurn({ text: '要不要再约', object })
  object.messages = [
    { id: 'm1', role: 'user', text: '她最近忽冷忽热，我有点拿不准要不要再约。', at: '2026-08-03T10:00:00+08:00' },
    {
      id: 'm2',
      role: 'assistant',
      text: `先别急着把一次表情回复解释成降温。你在意的是：前面已经有过具体投入，现在又出现含糊信号，怕自己继续推进会显得一厢情愿。\n\n从记录看，小北确认过具体见面时间，也在取消后主动道歉并给了替代安排；这两件事比单独一个表情更有分量。现在更像是有回应，但还需要一次低压力行动验证。\n\n你可以发：“${demoAnalysis.script}”\n\n发出后看 48 小时，只看有没有具体回应或替代安排。明确拒绝，或者连续两次回避具体安排又不给替代时间，就停下来。`,
      analysis: demoAnalysis,
      at: '2026-08-03T10:00:08+08:00',
    },
  ]

  const second = createRelationshipObject('阿岚', [object.id])
  second.identity = { status: 'locked', senders: { user_01: 'user', contact_29: 'object' } }
  second.memories = [
    { id: 'mem_a1', scope: 'relationship', subjectId: second.id, field: 'stage', value: '普通朋友，最近一个月未单独见面', confidence: 'high', createdAt: '2026-08-01T10:00:00Z' },
  ]
  second.evidence = [{
    id: 'ev_a1', at: '2026-08-02T19:20:00+08:00', senderId: 'contact_29', score: -1,
    reason: '连续两次回避具体邀约，且没有替代安排。', observableFact: '阿岚回复“最近都忙”后结束话题。',
    summary: '“最近都挺忙的，之后再说吧。”', source: '公开合成聊天 / alan / msg-05', completeness: 0.91,
  }]
  return { objects: [object, second], activeObjectId: object.id }
}
