import { mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// Keep the contract authored in TypeScript while running it on every supported
// Node version. Node 20 cannot load `.ts` directly, and newer runners disagree
// about the experimental strip flag, so compile this tiny contract to a private
// temp directory with the repo's own TypeScript compiler first.
const outputDir = mkdtempSync(join(tmpdir(), 'star67-coaching-'))
const compiler = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc')
const compile = spawnSync(process.execPath, [
  compiler,
  'scripts/coaching-routing-contract.ts',
  'src/kit/coaching-routing.ts',
  'src/kit/coaching-contract.ts',
  '--target', 'ES2022',
  '--module', 'ESNext',
  '--moduleResolution', 'bundler',
  '--rewriteRelativeImportExtensions',
  '--outDir', outputDir,
  '--skipLibCheck',
  '--noCheck',
], { stdio: 'inherit' })

let status = compile.status ?? 1
if (status === 0) {
  const run = spawnSync(process.execPath, [join(outputDir, 'scripts', 'coaching-routing-contract.js')], { stdio: 'inherit' })
  status = run.status ?? 1
}

rmSync(outputDir, { recursive: true, force: true })
process.exitCode = status
