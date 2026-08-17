import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dshHome = resolve(projectRoot, '.runtime/dsh-home')
const profileRoot = resolve(dshHome, 'profiles/goutoujunshi')
const bundleRoot = resolve(projectRoot, 'packages/goutoujunshi-bundle')
const pluginRoot = resolve(projectRoot, 'packages/goutoujunshi-plugin')

await mkdir(profileRoot, { recursive: true })

const manifest = {
  name: 'dsh-profile-goutoujunshi',
  private: true,
  version: '0.1.0',
  packageManager: 'pnpm@10.15.1',
  dependencies: {
    '@powerycy/dsh-goutoujunshi-bundle': `link:${bundleRoot}`,
    '@powerycy/dsh-goutoujunshi-plugin': `link:${pluginRoot}`,
  },
  dsh: {
    profile: {
      bundles: [
        '@deepseek-ai/dsh-base',
        '@deepseek-ai/dsh-web-app',
        '@powerycy/dsh-goutoujunshi-bundle',
      ],
    },
  },
}

const manifestPath = resolve(profileRoot, 'package.json')
const expected = `${JSON.stringify(manifest, null, 2)}\n`
let current = ''
try { current = await readFile(manifestPath, 'utf8') } catch {}
if (current !== expected) await writeFile(manifestPath, expected)

const patchPath = resolve(profileRoot, 'cordis.patch.yml')
try { await readFile(patchPath, 'utf8') } catch { await writeFile(patchPath, '[]\n') }

await new Promise((accept, reject) => {
  const child = spawn('pnpm', ['install', '--ignore-workspace'], {
    cwd: profileRoot,
    stdio: 'inherit',
    env: process.env,
  })
  child.once('error', reject)
  child.once('close', code => code === 0 ? accept() : reject(new Error(`profile install exited with ${code}`)))
})

console.log(`Profile ready: ${profileRoot}`)
