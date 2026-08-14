import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addObject,
  analyzeTurn,
  archiveRelationshipObject,
  appendMemory,
  buildEvidenceCandles,
  compressMemories,
  createRelationshipObject,
  lockIdentityMapping,
  publicSyntheticCase,
  recallForObject,
  restoreRelationshipObject,
  undoLastMemoryOperation,
} from '../packages/goutoujunshi-plugin/src/domain.js'

test('creates at most five isolated relationship objects', () => {
  let objects = []
  for (const name of ['A', 'B', 'C', 'D', 'E']) objects = addObject(objects, name)
  assert.equal(objects.length, 5)
  assert.equal(new Set(objects.map(item => item.id)).size, 5)
  assert.throws(() => addObject(objects, 'F'), /最多/)
})

test('archives a relationship object without deleting it and can restore it', () => {
  const objects = addObject([], '小北')
  objects[0].messages.push({ id: 'msg-1', role: 'user', text: '公开测试', at: '2026-08-14T00:00:00Z' })
  const archived = archiveRelationshipObject(objects, [], objects[0].id, '2026-08-14T01:00:00Z')
  assert.equal(archived.objects.length, 0)
  assert.equal(archived.archivedObjects[0].messages[0].text, '公开测试')
  assert.equal(archived.archivedObjects[0].archivedAt, '2026-08-14T01:00:00Z')
  const restored = restoreRelationshipObject(archived.objects, archived.archivedObjects, objects[0].id)
  assert.equal(restored.objects[0].id, objects[0].id)
  assert.equal(restored.objects[0].archivedAt, undefined)
  assert.equal(restored.archivedObjects.length, 0)
})

test('recalls only the active object and shared user memory', () => {
  const memories = [
    { id: 'u', subjectId: 'user', scope: 'user', value: '用户希望慢一点确认关系' },
    { id: 'a', subjectId: 'obj_a', scope: 'relationship', value: '见面两次' },
    { id: 'b', subjectId: 'obj_b', scope: 'relationship', value: '普通朋友' },
  ]
  assert.deepEqual(recallForObject(memories, 'obj_a', '确认关系').map(item => item.id).sort(), ['a', 'u'])
})

test('identity mapping requires anchors and stops on cross-batch conflict', () => {
  const events = [{ senderId: 'u1' }, { senderId: 'p1' }]
  assert.equal(lockIdentityMapping({ proposed: { u1: 'user' }, events }).status, 'needs_confirmation')
  assert.equal(lockIdentityMapping({ proposed: { u1: 'user', p1: 'object' }, events }).status, 'locked')
  const conflict = lockIdentityMapping({ previous: { p1: 'object' }, proposed: { p1: 'user' }, events })
  assert.equal(conflict.status, 'conflict')
  assert.match(conflict.reason, /已锁定/)
})

test('evidence chart uses red-positive, green-negative, gray-insufficient semantics', () => {
  const events = publicSyntheticCase().objects[0].evidence
  const candles = buildEvidenceCandles(events)
  assert.deepEqual(candles.map(item => item.direction), ['positive', 'positive', 'negative', 'positive', 'insufficient'])
})

test('compresses old event details into stage summaries while keeping recent memory', () => {
  const memories = [
    { id: 'old-1', scope: 'event', subjectId: 'obj_a', value: '第一次见面', occurredAt: '2024-01-10T00:00:00Z' },
    { id: 'old-2', scope: 'event', subjectId: 'obj_a', value: '第二次见面', occurredAt: '2024-02-10T00:00:00Z' },
    { id: 'recent', scope: 'event', subjectId: 'obj_a', value: '最近主动邀约', occurredAt: '2026-08-01T00:00:00Z' },
  ]
  const compact = compressMemories(memories, new Date('2026-08-14T00:00:00Z'))
  assert.ok(compact.some(item => item.id === 'recent'))
  const summary = compact.find(item => item.id.startsWith('summary_'))
  assert.equal(summary.compressedFrom.length, 2)
  assert.ok(!compact.some(item => item.id === 'old-1'))
})

test('memory update is reversible per object', () => {
  const object = createRelationshipObject('A')
  const updated = appendMemory(object, { scope: 'event', subjectId: object.id, field: 'window', value: '48 小时' })
  assert.equal(updated.memories.length, 1)
  assert.equal(undoLastMemoryOperation(updated).memories.length, 0)
})

test('public case completes emotion-fact-unknown-decision-script-confirmation contract', () => {
  const object = publicSyntheticCase().objects[0]
  const result = analyzeTurn({ text: '我想推进但怕太急', object })
  assert.match(result.emotion, /不确定|悬着/)
  assert.ok(result.facts.length >= 1)
  assert.ok(result.unknowns.some(item => item.includes('内心')))
  assert.equal(result.decision, '推进')
  assert.ok(result.script.length > 10)
  assert.match(result.observationWindow, /48/)
  assert.ok(result.stopConditions.length >= 2)
})
