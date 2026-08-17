import { mkdir } from 'node:fs/promises'
import { build } from 'esbuild'

const pluginId = '@powerycy/dsh-goutoujunshi-plugin'

await mkdir('lib', { recursive: true })

await build({
  entryPoints: ['src/index.js'],
  outfile: 'lib/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  external: ['@deepseek-ai/cordis', '@deepseek-ai/dsh-tools', '@deepseek-ai/schemastery'],
  sourcemap: true,
})

await build({
  entryPoints: ['src/client.jsx'],
  outfile: 'lib/client.js',
  bundle: true,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['react', 'react/jsx-runtime'],
  loader: {
    '.css': 'text',
    '.png': 'dataurl',
  },
  define: {
    'process.env.NODE_ENV': '"production"',
  },
  banner: {
    js: `window.__ModuleLoader__.load({ id: ${JSON.stringify(pluginId)}, factory: (require) => { var module = { exports: {} }; var exports = module.exports;`,
  },
  footer: {
    js: 'return module.exports; } });',
  },
  sourcemap: true,
})
