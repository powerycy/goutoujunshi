import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const ALLOWED_ACTIONS = new Set(['status', 'show', 'context', 'enable', 'pause', 'resume', 'apply', 'undo'])

export async function callReadonlyMemoryStore({ skillRoot, memoryDirectory, action, payload = {}, confirmed = false }) {
  if (!ALLOWED_ACTIONS.has(action)) throw new Error(`不支持的记忆动作：${action}`)
  const script = resolve(skillRoot, 'scripts/memory_store.py')
  const args = [script, action]
  let stdin = ''
  if (['show', 'context'].includes(action) && payload.subjectId) args.push('--subject-id', payload.subjectId)
  if (action === 'context' && payload.maxChars) args.push('--max-chars', String(payload.maxChars))
  if (action === 'enable' && confirmed) args.push('--confirm')
  if (action === 'undo' && payload.operationId) args.push('--op-id', payload.operationId)
  if (action === 'apply') stdin = JSON.stringify(payload.delta || payload)

  return new Promise((accept, reject) => {
    const child = spawn('python3', args, {
      cwd: skillRoot,
      env: { ...process.env, GOUTOUJUNSHI_MEMORY_DIR: resolve(memoryDirectory) },
      stdio: ['pipe', 'pipe', 'pipe'],
    })
    let stdout = ''
    let stderr = ''
    child.stdout.setEncoding('utf8')
    child.stderr.setEncoding('utf8')
    child.stdout.on('data', chunk => { stdout += chunk })
    child.stderr.on('data', chunk => { stderr += chunk })
    child.once('error', reject)
    child.once('close', code => {
      let parsed
      try {
        parsed = JSON.parse(stdout || '{}')
      } catch {
        reject(new Error(`记忆适配器返回了无效结果：${stderr || stdout}`))
        return
      }
      if (code !== 0) reject(new Error(parsed?.error?.message || stderr || `记忆脚本退出码 ${code}`))
      else accept(parsed)
    })
    child.stdin.end(stdin)
  })
}
