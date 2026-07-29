import assert from 'node:assert/strict'
import { BADGES, COMPANY_CARDS, COMPETENCIES, STAGES } from './progression-source.mjs'
import { MISSIONS } from './missions-source.mjs'

const MIN_COMPANY_CARDS = 9
const auditionCards = COMPANY_CARDS.filter((card) => card.auditionId !== null)
const evidenceOnlyCards = COMPANY_CARDS.filter((card) => card.auditionId === null)

assert.equal(STAGES.length, 6, 'Career Casebook must define exactly six capability stages')
assert.ok(COMPANY_CARDS.length >= MIN_COMPANY_CARDS, `Career dossier must define at least ${MIN_COMPANY_CARDS} target-company cards`)
assert.equal(new Set(COMPANY_CARDS.map((card) => card.company)).size, COMPANY_CARDS.length, 'Career dossier company names must be unique')
assert.equal(new Set(auditionCards.map((card) => card.auditionId)).size, auditionCards.length, 'Each authored audition must have one company owner')
const legacyBadges = [
  ['warehouse-navigator', 'Warehouse Navigator', ['m01', 'm02', 'm03', 'm04', 'm05'], []],
  ['join-guardian', 'Join Guardian', ['m06', 'm07', 'm08'], []],
  ['plan-owner', 'Plan Owner', ['m09', 'm10'], []],
  ['spend-margin-partner', 'Spend & Margin Partner', ['m11', 'm12'], []],
  ['time-series-operator', 'Time-Series Operator', ['m13', 'm14'], []],
  ['workforce-planner', 'Workforce Planner', ['m15'], ['sim02']],
  ['close-detective', 'Close Detective', ['m16', 'm19'], []],
  ['saas-retention-modeler', 'SaaS Retention Modeler', ['m17', 'm18', 'm20'], ['sim01']],
]
assert.deepEqual(
  BADGES.slice(0, legacyBadges.length).map((badge) => [badge.id, badge.title, badge.missionIds, badge.auditionIds]),
  legacyBadges,
  'The original eight evidence rules are a compatibility contract',
)
assert.equal(new Set(BADGES.map((badge) => badge.competencyId)).size, COMPETENCIES.length, 'Every competency needs one evidence seal')
assert.deepEqual(
  [...new Set(BADGES.flatMap((badge) => badge.missionIds))].sort(),
  MISSIONS.map((mission) => mission.id).sort(),
  'Every authored mission must contribute to the evidence-seal catalog',
)
assert.equal(BADGES.flatMap((badge) => badge.missionIds).length, MISSIONS.length, 'A mission must not be counted by multiple evidence seals')
for (const badge of BADGES) {
  const competency = COMPETENCIES.find((candidate) => candidate.id === badge.competencyId)
  assert.ok(competency, `${badge.id} must reference a real competency`)
  assert.deepEqual(badge.missionIds, competency.missionIds, `${badge.id} mission evidence must follow its competency`)
  assert.deepEqual(badge.auditionIds, competency.auditionIds ?? [], `${badge.id} audition evidence must follow its competency`)
  assert.match(badge.description, /\S/, `${badge.id} needs a capability story`)
  assert.ok(['riff', 'rex', 'coco', 'zi', 'fin', 'frosty'].includes(badge.guideId), `${badge.id} needs a Star67 desk-crew guide`)
}
assert.deepEqual(STAGES.map((stage) => stage.title), [
  'New desk', 'Self-serve operator', 'Finance business partner',
  'Forecast & close owner', 'Screen ready', 'Target ready',
])
assert.equal(COMPANY_CARDS.find((card) => card.company === 'Hightouch')?.auditionId, 'sim01')
assert.equal(COMPANY_CARDS.find((card) => card.company === 'Datadog')?.auditionId, 'sim02')
assert.equal(COMPANY_CARDS.find((card) => card.company === '1Password')?.auditionId, 'sim03')
assert.equal(COMPANY_CARDS.find((card) => card.company === 'Figma')?.auditionId, 'sim04')
assert.equal(COMPANY_CARDS.find((card) => card.company === 'Affirm')?.auditionId, 'sim05')
assert.equal(COMPANY_CARDS.find((card) => card.company === 'Navan')?.auditionId, null)
assert.deepEqual(COMPANY_CARDS.find((card) => card.company === 'Navan')?.evidenceMissionIds, ['m13', 'm17', 'm18'])
assert.deepEqual(STAGES.find((stage) => stage.id === 'target-ready')?.requiredAuditionIds, ['sim01', 'sim02', 'sim03'])
assert.deepEqual(
  COMPETENCIES.find((competency) => competency.id === 'customer-lifecycle-council')?.missionIds,
  ['m109', 'm110', 'm111', 'm112', 'm113', 'm114', 'm115', 'm116', 'm117'],
)
assert.deepEqual(
  COMPETENCIES.find((competency) => competency.id === 'reforecast-outcome-review')?.missionIds,
  ['m128', 'm129', 'm130', 'm131', 'm132', 'm133', 'm134', 'm135', 'm136'],
)
assert.deepEqual(
  BADGES.find((badge) => badge.id === 'reforecast-outcome-reviewer')?.missionIds,
  ['m128', 'm129', 'm130', 'm131', 'm132', 'm133', 'm134', 'm135', 'm136'],
)
assert.deepEqual(
  COMPETENCIES.find((competency) => competency.id === 'shared-services-allocation-review')?.missionIds,
  ['m137', 'm138', 'm139', 'm140', 'm141', 'm142', 'm143', 'm144', 'm145'],
)
assert.deepEqual(
  BADGES.find((badge) => badge.id === 'shared-services-allocation-steward')?.missionIds,
  ['m137', 'm138', 'm139', 'm140', 'm141', 'm142', 'm143', 'm144', 'm145'],
)
assert.deepEqual(
  COMPETENCIES.find((competency) => competency.id === 'cost-to-serve-review')?.missionIds,
  ['m146', 'm147', 'm148', 'm149', 'm150', 'm151', 'm152', 'm153', 'm154', 'm155'],
)
assert.deepEqual(
  BADGES.find((badge) => badge.id === 'cost-to-serve-modeler')?.missionIds,
  ['m146', 'm147', 'm148', 'm149', 'm150', 'm151', 'm152', 'm153', 'm154', 'm155'],
)
assert.deepEqual(
  COMPETENCIES.find((competency) => competency.id === 'contractor-consulting-cost-review')?.missionIds,
  ['m156', 'm157', 'm158', 'm159', 'm160', 'm161', 'm162'],
)
assert.deepEqual(
  BADGES.find((badge) => badge.id === 'external-labor-cost-steward')?.missionIds,
  ['m156', 'm157', 'm158', 'm159', 'm160', 'm161', 'm162'],
)
assert.deepEqual(
  COMPETENCIES.find((competency) => competency.id === 'travel-expense-operating-review')?.missionIds,
  ['m163', 'm164', 'm165', 'm166', 'm167', 'm168', 'm169', 'm170'],
)
assert.deepEqual(
  BADGES.find((badge) => badge.id === 'travel-expense-steward')?.missionIds,
  ['m163', 'm164', 'm165', 'm166', 'm167', 'm168', 'm169', 'm170'],
)
assert.deepEqual(
  COMPETENCIES.find((competency) => competency.id === 'revenue-close-usage-review')?.missionIds,
  ['m171', 'm172', 'm173', 'm174', 'm175', 'm176', 'm177', 'm178', 'm179'],
)
assert.deepEqual(
  BADGES.find((badge) => badge.id === 'usage-revenue-steward')?.missionIds,
  ['m171', 'm172', 'm173', 'm174', 'm175', 'm176', 'm177', 'm178', 'm179'],
)
console.log(`PROGRESSION CONTRACT GREEN: ${BADGES.length} evidence seals cover ${MISSIONS.length}/${MISSIONS.length} missions across ${COMPETENCIES.length} competency arcs; original 8 rules and 6 stages remain compatible; ${COMPANY_CARDS.length} companies, ${auditionCards.length} distinct auditions, ${evidenceOnlyCards.length} evidence-only cards.`)
