import { mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const outputDir = mkdtempSync(join(tmpdir(), 'star67-coaching-provider-'))
const compiler = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc')
const compile = spawnSync(process.execPath, [
  compiler,
  'scripts/coaching-provider-contract.ts',
  'src/coaching-client.ts',
  'src/kit/coaching-contract.ts',
  'src/kit/local-coach.ts',
  'src/kit/attempt-review.ts',
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
  const run = spawnSync(process.execPath, [join(outputDir, 'scripts', 'coaching-provider-contract.js')], { stdio: 'inherit' })
  status = run.status ?? 1
}

rmSync(outputDir, { recursive: true, force: true })
process.exitCode = status
