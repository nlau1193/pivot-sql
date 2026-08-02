import assert from 'node:assert/strict'
import { requestCoach, type CoachTransport } from '../src/coaching-client.ts'
import type { CoachRequestV1 } from '../src/kit/coaching-contract.ts'

const request: CoachRequestV1 = {
  version: 1,
  requestId: 'provider-contract:1',
  mode: 'nudge',
  context: {
    pack: { id: 'parkline-fpa', place: 'Star67', role: 'FP&A' },
    mission: {
      id: 'm01',
      title: 'How big is this place?',
      ask: 'Count the transaction lines.',
      deliverable: 'One number: transaction lines.',
      tables: ['fct_gl_transactions'],
    },
    schema: [{
      name: 'fct_gl_transactions',
      grain: 'one journal line',
      description: 'General-ledger transaction lines.',
      columns: [{ name: 'amount', description: 'Signed amount.' }],
    }],
    relationships: [],
  },
  input: { query: 'SELECT count(*) FROM fct_gl_transactions' },
}

const boundary = {
  authority: 'advisory-only',
  grading: 'deterministic-engine-only',
  progressMutation: 'forbidden',
  answerKeyMaterial: 'withheld',
} as const

const reply = {
  version: 1,
  requestId: request.requestId,
  mode: request.mode,
  source: 'remote',
  message: {
    headline: 'Protect the row grain',
    body: 'Before changing syntax, say what one output row represents.',
    nextMoves: ['Compare the requested row grain with the source table.'],
    reflectionQuestion: 'What should one row represent?',
    references: [{ kind: 'table', label: 'fct_gl_transactions' }],
  },
  boundary,
}

let fetchCalls = 0
const originalFetch = globalThis.fetch
globalThis.fetch = (async () => {
  fetchCalls += 1
  throw new Error('The default path must not fetch')
}) as typeof fetch

const local = await requestCoach(request)
assert.equal(local.source, 'local')
assert.equal(fetchCalls, 0, 'no endpoint must mean no network')

let providerCalls = 0
const provider: CoachTransport = {
  id: 'test-luna-high',
  async ask(received) {
    providerCalls += 1
    assert.equal(received.requestId, request.requestId, 'provider receives the request id')
    assert.equal(received.mode, request.mode, 'provider receives the request mode')
    assert.equal(received.input.query, request.input.query, 'provider receives the visible query')
    assert.equal(received.context.mission.id, request.context.mission.id, 'provider receives authored mission context')
    assert.ok(!('canonical' in received) && !('progress' in received), 'provider receives no authority fields')
    return reply
  },
}
const remote = await requestCoach(request, { transport: provider })
assert.equal(remote.source, 'remote')
assert.equal(providerCalls, 1, 'explicit provider is called once')

const unsafe = await requestCoach(request, {
  transport: {
    id: 'unsafe',
    async ask() {
      return { ...reply, message: { ...reply.message, body: 'SELECT amount FROM fct_gl_transactions' } }
    },
  },
})
assert.equal(unsafe.source, 'local', 'runnable SQL from a provider must fall back locally')

const mismatched = await requestCoach(request, {
  transport: {
    id: 'mismatched',
    async ask() { return { ...reply, requestId: 'some-other-request' } },
  },
})
assert.equal(mismatched.source, 'local', 'mismatched provider replies must fall back locally')

const abort = new AbortController()
const pending = requestCoach(request, {
  signal: abort.signal,
  transport: {
    id: 'abortable',
    async ask(_received, options) {
      await new Promise<never>((_resolve, reject) => {
        options.signal?.addEventListener('abort', () => reject(options.signal?.reason), { once: true })
      })
      throw new Error('unreachable')
    },
  },
})
abort.abort(new Error('learner moved on'))
await assert.rejects(pending, /learner moved on/)

globalThis.fetch = originalFetch
console.log('✓ optional coaching provider — local default, bounded remote validation, fallback, and cancellation')
