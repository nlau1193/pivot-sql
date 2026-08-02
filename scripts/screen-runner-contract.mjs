import { mkdtempSync, rmSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const outputDir = mkdtempSync(join(tmpdir(), 'star67-screen-runner-'))
const compiler = join(process.cwd(), 'node_modules', 'typescript', 'bin', 'tsc')
const compile = spawnSync(process.execPath, [
  compiler,
  'scripts/screen-runner-contract.ts',
  'src/kit/screen-runner.ts',
  'src/kit/progress-contracts.ts',
  'src/kit/path-registry.ts',
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
  const run = spawnSync(process.execPath, [join(outputDir, 'scripts', 'screen-runner-contract.js')], { stdio: 'inherit' })
  status = run.status ?? 1
}

rmSync(outputDir, { recursive: true, force: true })
process.exitCode = status
