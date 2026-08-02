import assert from 'node:assert/strict'
import { recordScreenSolve, runnerState, screenComplete, startScreenAttempt } from '../src/kit/screen-runner.ts'
import type { ScreenPolicy } from '../src/kit/screen-runner.ts'

const policy: ScreenPolicy = { packId: 'parkline-fpa', screenId: 'screen-contract', questionIds: ['q1', 'q2', 'q3'] }
const attempt = startScreenAttempt(policy, '2026-08-02T00:00:00.000Z', (screenId) => `attempt:${screenId}:1`)

assert.equal(attempt.completedAt, null)
assert.equal(screenComplete(attempt, policy), false)
assert.equal(runnerState(attempt, policy).status, 'running')

const q1 = recordScreenSolve(attempt, policy, 'q1', 'graded:q1')
assert.equal(screenComplete(q1, policy), false)
assert.throws(() => recordScreenSolve(q1, policy, 'q1', 'replacement'), /immutable evidence/)
assert.throws(() => recordScreenSolve(q1, policy, 'not-in-policy', 'graded'), /not part of screen/)
assert.throws(() => recordScreenSolve(q1, policy, 'q2', ''), /graded artifact is required/)

const q2 = recordScreenSolve(q1, policy, 'q2', 'graded:q2')
const complete = recordScreenSolve(q2, policy, 'q3', 'graded:q3')
assert.equal(screenComplete(complete, policy), true)
assert.equal(complete.completedAt, null, 'completion stays derived instead of becoming an awarded field')
assert.equal(runnerState(complete, policy).status, 'completed')
assert.equal(runnerState(complete, policy, { abandoned: true }).status, 'abandoned')

console.log('✓ screen runner derives completion from one immutable solve per policy question')
