// Small cross-process lock for the deterministic warehouse generator.
// `npm test` and `npm run build` can both invoke `generate-data.mjs`; without
// one shared lock DuckDB races on the same ignored public/data output files.
import { randomUUID } from 'node:crypto'
import { closeSync, mkdirSync, openSync, readFileSync, statSync, unlinkSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

const DEFAULT_POLL_MS = 100
const DEFAULT_STALE_MS = 15 * 60 * 1000

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function processIsAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

function readOwner(lockPath) {
  try {
    const owner = JSON.parse(readFileSync(lockPath, 'utf8'))
    return {
      pid: Number(owner?.pid),
      token: typeof owner?.token === 'string' ? owner.token : '',
    }
  } catch {
    return { pid: 0, token: '' }
  }
}

function isStale(lockPath, staleMs) {
  try {
    const age = Date.now() - statSync(lockPath).mtimeMs
    const owner = readOwner(lockPath)
    // A live owner always wins. An incomplete/new lock gets time to finish its
    // first write before a waiter considers it stale.
    return age > staleMs && !processIsAlive(owner.pid)
  } catch {
    return false
  }
}

/**
 * Acquire a lock file and return an idempotent release function.
 * The lock is dependency-free, works across Node processes, and removes a
 * dead owner after a generous timeout so a killed build cannot wedge a clone.
 */
export async function acquireGenerationLock(
  lockPath,
  { pollMs = DEFAULT_POLL_MS, staleMs = DEFAULT_STALE_MS } = {},
) {
  const path = String(lockPath)
  const token = randomUUID()
  const owner = JSON.stringify({ pid: process.pid, token })
  let acquired = false

  // The output directory is ignored but may not exist on a fresh clone.
  mkdirSync(dirname(path), { recursive: true })

  while (!acquired) {
    let fd
    let created = false
    try {
      fd = openSync(path, 'wx')
      created = true
      try {
        writeFileSync(fd, owner, 'utf8')
      } finally {
        closeSync(fd)
        fd = undefined
      }
      acquired = true
    } catch (error) {
      if (fd !== undefined) {
        try { closeSync(fd) } catch { /* preserve the original failure */ }
      }
      // If creating or writing our own lock failed, do not strand it for the
      // stale-lock timeout. A competing process cannot own a path opened by
      // this process with `wx`.
      if (created) {
        try { unlinkSync(path) } catch (removeError) {
          if (removeError?.code !== 'ENOENT') throw removeError
        }
      }
      if (error?.code !== 'EEXIST') throw error
      if (isStale(path, staleMs)) {
        try { unlinkSync(path) } catch (removeError) {
          if (removeError?.code !== 'ENOENT') throw removeError
        }
        continue
      }
      await sleep(pollMs)
    }
  }

  let released = false
  return () => {
    if (released) return
    released = true
    const current = readOwner(path)
    if (current.token !== token) return
    try { unlinkSync(path) } catch (error) {
      if (error?.code !== 'ENOENT') throw error
    }
  }
}
