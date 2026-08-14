import { resolve } from 'node:path'
import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { buildEvidenceCandles, lockIdentityMapping } from './domain.js'
import { callReadonlyMemoryStore } from './memory-adapter.js'
import { loadSelectedReferences } from './reference-router.js'

export const name = 'goutoujunshi-harness-adapter'
export const inject = ['tools', 'systemPrompt']

export const Config = Schema.object({
  skillRoot: Schema.string().default('../..'),
  memoryDirectory: Schema.string().default('./.runtime/memory'),
  maximumObjects: Schema.number().min(1).max(5).default(5),
})

const CORE_GUIDANCE = `你是运行在 DeepSeek Harness 中的“狗头军师”垂直关系 Agent。先承接情绪，再区分事实、合理推测和未知；不读心，不预测爱意、忠诚或成功率。给出推进、确认、修复或退出中的明确建议，以及可复制话术、观察窗口、停止条件，最后让用户人工确认。每次只为当前对象召回资料；身份不明时先锁定 sender/member ID 或用户确认的锚点，映射冲突立即停止。聊天原文留在证据库，不写入长期记忆。按问题调用 goutoujunshi_route_references，每次加载 1–3 份只读 Skill 参考。`

function renderString(value) {
  return [{ type: 'text', text: value }]
}

export function apply(ctx, config) {
  const skillRoot = resolve(process.cwd(), config.skillRoot)
  const memoryDirectory = resolve(process.cwd(), config.memoryDirectory)

  ctx.systemPrompt.section({
    name: 'goutoujunshi:persona',
    order: 40,
    text: CORE_GUIDANCE,
  })

  ctx.tools.register(defineTool({
    name: 'goutoujunshi_route_references',
    description: '按现有狗头军师 Skill 路由规则，只读加载当前问题需要的 1–3 份参考。',
    parameters: {
      question: { type: 'string', required: true, description: '当前关系问题或分析任务。' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => renderString(value) },
    async execute({ question }) {
      return JSON.stringify({ references: await loadSelectedReferences(skillRoot, question, 3) }, null, 2)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'goutoujunshi_identity_and_evidence',
    description: '校验发送者身份映射；冲突时停止；成功后将事件转换为仅解释证据的关系进展蜡烛数据。',
    parameters: {
      batchJson: { type: 'string', required: true, description: 'JSON：{previous, proposed, events}。事件必须带 senderId。' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => renderString(value) },
    async execute({ batchJson }) {
      const batch = JSON.parse(batchJson)
      const identity = lockIdentityMapping(batch)
      if (identity.status !== 'locked') return JSON.stringify({ identity, stopped: true }, null, 2)
      return JSON.stringify({ identity, stopped: false, candles: buildEvidenceCandles(batch.events || []) }, null, 2)
    },
  }))

  ctx.tools.register(defineTool({
    name: 'goutoujunshi_memory',
    description: '通过只读适配层调用既有 memory_store.py；支持同意、状态、当前对象召回、写入精简记忆、暂停与撤销。',
    parameters: {
      action: { type: 'string', required: true, description: 'status/show/context/enable/pause/resume/apply/undo' },
      payloadJson: { type: 'string', description: '动作参数 JSON；apply 时只接受精简记忆，不接受原始聊天。' },
      confirmed: { type: 'boolean', description: '只有用户明确同意启用记忆时为 true。' },
    },
    output: { schema: { type: 'string' }, render: (_args, value) => renderString(value) },
    async execute({ action, payloadJson = '{}', confirmed = false }) {
      const payload = JSON.parse(payloadJson)
      const result = await callReadonlyMemoryStore({ skillRoot, memoryDirectory, action, payload, confirmed })
      return JSON.stringify(result, null, 2)
    },
  }))
}
