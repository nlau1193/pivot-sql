import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const VERSION = 'v1.4.3'
const EXTENSIONS = [
  { platform: 'wasm_eh', sha256: '22765c8f7dc741cda2b571a66ac7bb355295d7d69a6c37e5315b265672984f55' },
  { platform: 'wasm_mvp', sha256: '0785c6c95d003eff4faa7b3b4b660f02c9c92f6d68d135ddf330d42e3a650600' },
]

for (const extension of EXTENSIONS) {
  const name = 'parquet.duckdb_extension.wasm'
  const source = `https://extensions.duckdb.org/${VERSION}/${extension.platform}/${name}`
  const target = resolve(ROOT, 'public', 'duckdb-extensions', VERSION, extension.platform, name)
  const response = await fetch(source)
  if (!response.ok) throw new Error(`${source}: HTTP ${response.status}`)
  const body = Buffer.from(await response.arrayBuffer())
  const actual = createHash('sha256').update(body).digest('hex')
  if (actual !== extension.sha256) throw new Error(`${source}: expected ${extension.sha256}, got ${actual}`)
  await mkdir(dirname(target), { recursive: true })
  await writeFile(target, body)
  console.log(`${extension.platform}: ${body.length} bytes, sha256 ${actual}`)
}
