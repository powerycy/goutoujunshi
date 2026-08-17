import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = resolve(projectRoot, '.runtime/dsh-home')
const executable = process.platform === 'win32'
  ? resolve(projectRoot, 'node_modules/.bin/dsh.cmd')
  : resolve(projectRoot, 'node_modules/.bin/dsh')

const args = ['--profile', 'goutoujunshi', '--host', '127.0.0.1', '--port', process.env.PORT || '3186']
const child = spawn(executable, args, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: { ...process.env, DSH_HOME: dshHome },
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal))
}

child.once('error', error => {
  console.error(error)
  process.exitCode = 1
})
child.once('close', code => { process.exitCode = code ?? 1 })
