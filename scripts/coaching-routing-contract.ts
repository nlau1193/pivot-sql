import assert from 'node:assert/strict'
import { chooseCoachRoute, type CoachRouteMoment } from '../src/kit/coaching-routing.ts'

const cases: Array<{ name: string; moment: CoachRouteMoment; current: boolean; mode: string }> = [
  { name: 'empty draft', moment: { kind: 'idle' }, current: false, mode: 'nudge' },
  { name: 'draft after edits', moment: { kind: 'idle' }, current: false, mode: 'nudge' },
  { name: 'parser error', moment: { kind: 'engine-error' }, current: false, mode: 'explain_error' },
  { name: 'missing column error', moment: { kind: 'engine-error' }, current: false, mode: 'explain_error' },
  { name: 'current incorrect attempt', moment: { kind: 'verdict', status: 'incorrect' }, current: true, mode: 'review_attempt' },
  { name: 'current close attempt', moment: { kind: 'verdict', status: 'close' }, current: true, mode: 'review_attempt' },
  { name: 'current correct attempt', moment: { kind: 'verdict', status: 'correct' }, current: true, mode: 'review_attempt' },
  { name: 'stale incorrect result', moment: { kind: 'verdict', status: 'incorrect' }, current: false, mode: 'explain_verdict' },
  { name: 'stale correct result', moment: { kind: 'verdict', status: 'correct' }, current: false, mode: 'rehearse' },
  { name: 'exploration result without verdict', moment: { kind: 'idle' }, current: true, mode: 'review_attempt' },
]

for (const example of cases) {
  const route = chooseCoachRoute(example.moment, example.current)
  assert.equal(route.mode, example.mode, `${example.name} should use ${example.mode}`)
  assert.ok(route.reason.length > 10, `${example.name} should explain the evidence used`)
}

assert.equal(new Set(cases.map((example) => chooseCoachRoute(example.moment, example.current).mode)).size, 5)
console.log(`✓ adaptive coaching routing — ${cases.length} evidence examples`)
