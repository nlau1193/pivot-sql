import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

function dataRevision(): string {
  const dataDir = resolve(process.cwd(), 'public/data')
  const manifestPath = resolve(dataDir, 'manifest.json')
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { tables: Record<string, unknown> }
  const files = ['manifest.json', ...Object.keys(manifest.tables).sort().map((table) => `${table}.parquet`)]
  const hash = createHash('sha256')
  for (const file of files) {
    hash.update(file)
    hash.update('\0')
    hash.update(readFileSync(resolve(dataDir, file)))
    hash.update('\0')
  }
  return hash.digest('hex')
}

const revision = dataRevision()

export default defineConfig({
  plugins: [react()],
  // Stable public filenames stay cacheable forever, while this content-derived
  // query key prevents a new grading oracle from reading an old immutable dataset.
  define: {
    __PIVOT_DATA_REVISION__: JSON.stringify(revision),
  },
  optimizeDeps: {
    exclude: ['@duckdb/duckdb-wasm'],
  },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 4096,
  },
})
