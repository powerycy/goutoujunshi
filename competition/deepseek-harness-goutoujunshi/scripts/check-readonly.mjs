import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const repositoryRoot = resolve(projectRoot, '../..')
const protectedPaths = ['SKILL.md', 'references', 'agents', 'scripts/memory_store.py']
const result = spawnSync('git', ['diff', '--name-only', 'origin/main', '--', ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: 'utf8',
})
if (result.status !== 0) throw new Error(result.stderr || '无法核对只读边界')
const changed = result.stdout.trim().split('\n').filter(Boolean)
if (changed.length) {
  console.error(`只读 Skill 文件发生变化：\n${changed.join('\n')}`)
  process.exit(1)
}
console.log('Readonly boundary verified: existing Skill, references, agents, and memory_store.py are unchanged.')
