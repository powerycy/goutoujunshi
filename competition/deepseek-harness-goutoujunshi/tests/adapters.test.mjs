import assert from 'node:assert/strict'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import test from 'node:test'
import { callReadonlyMemoryStore } from '../packages/goutoujunshi-plugin/src/memory-adapter.js'
import { selectReferences } from '../packages/goutoujunshi-plugin/src/reference-router.js'

const skillRoot = resolve(import.meta.dirname, '../../../')

test('reference router selects one to three existing skill references', () => {
  const selected = selectReferences('分析聊天截图的身份映射、证据趋势和记忆', 3)
  assert.ok(selected.length >= 1 && selected.length <= 3)
  assert.ok(selected.every(path => path.startsWith('references/')))
})

test('readonly memory adapter preserves object isolation and supports undo', async () => {
  const memoryDirectory = await mkdtemp(resolve(tmpdir(), 'goutoujunshi-memory-test-'))
  try {
    await callReadonlyMemoryStore({ skillRoot, memoryDirectory, action: 'enable', confirmed: true })
    const applied = await callReadonlyMemoryStore({
      skillRoot, memoryDirectory, action: 'apply', payload: {
        delta: { scope: 'event', subject_id: 'obj_a', field: 'window', value: '48 小时', source_type: 'user_report', confidence: 'high' },
      },
    })
    await callReadonlyMemoryStore({
      skillRoot, memoryDirectory, action: 'apply', payload: {
        delta: { scope: 'event', subject_id: 'obj_b', field: 'stage', value: '普通朋友', source_type: 'user_report', confidence: 'high' },
      },
    })
    const context = await callReadonlyMemoryStore({ skillRoot, memoryDirectory, action: 'context', payload: { subjectId: 'obj_a' } })
    assert.deepEqual(context.memories.map(item => item.subject_id), ['obj_a'])
    await callReadonlyMemoryStore({ skillRoot, memoryDirectory, action: 'undo', payload: { operationId: applied.op_id } })
    const shown = await callReadonlyMemoryStore({ skillRoot, memoryDirectory, action: 'show', payload: { subjectId: 'obj_a' } })
    assert.equal(shown.count, 0)
  } finally {
    await rm(memoryDirectory, { recursive: true, force: true })
  }
})
