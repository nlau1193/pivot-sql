/**
 * Fail-closed pack-manifest contract.
 * Validates the active Parkline FP&A pack against compiled mission content and
 * kernel path/integration registries — without claiming live GitHub/Slack.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const compiled = JSON.parse(
  await readFile(new URL('../src/missions.compiled.json', import.meta.url), 'utf8'),
)
const pathRegistry = await readFile(new URL('../src/kit/path-registry.ts', import.meta.url), 'utf8')
const packManifestTypes = await readFile(new URL('../src/kit/pack-manifest.ts', import.meta.url), 'utf8')
const parklineManifestSrc = await readFile(new URL('../src/packs/parkline-fpa/manifest.ts', import.meta.url), 'utf8')
const activeSrc = await readFile(new URL('../src/packs/active.ts', import.meta.url), 'utf8')
const integrationTypes = await readFile(new URL('../src/integrations/types.ts', import.meta.url), 'utf8')

let passed = 0
const check = (name, proof) => {
  proof()
  passed += 1
  console.log(`  ✓ ${name}`)
}

check('pack manifest types export PackManifest + ACTIVE_PACK_ID', () => {
  assert.match(packManifestTypes, /export interface PackManifest/)
  assert.match(packManifestTypes, /ACTIVE_PACK_ID = 'parkline-fpa'/)
})

check('Star67 pack declares fpa role and version 1', () => {
  assert.match(parklineManifestSrc, /id: 'parkline-fpa'/)
  assert.match(parklineManifestSrc, /role: 'fpa'/)
  assert.match(parklineManifestSrc, /version: 1/)
  assert.match(parklineManifestSrc, /screenUnlockMissionId: 'm17'/)
  assert.match(parklineManifestSrc, /minMissions: 179/)
  assert.match(parklineManifestSrc, /minCompanyCards: 9/)
})

check('active pack loader resolves parkline-fpa only', () => {
  assert.match(activeSrc, /ACTIVE_PACK_ID/)
  assert.match(activeSrc, /parklineFpaManifest/)
  assert.match(activeSrc, /deskPathsForActivePack/)
  assert.match(activeSrc, /export function installedPacks/)
  assert.match(activeSrc, /export function notInstalledPacks/)
})

check('path registry lists the open-world directions including scenario library', () => {
  for (const id of ['mission-ladder', 'scenario-library', 'free-explore', 'career-dossier', 'screen-practice']) {
    assert.match(pathRegistry, new RegExp(`'${id}'`))
  }
  assert.doesNotMatch(pathRegistry, /\bXP\b|confetti|coins?|lives\b/i)
})

const scenarios = await readFile(new URL('../src/packs/parkline-fpa/scenarios.ts', import.meta.url), 'utf8')
check('Star67 pack owns variable-length scenario content instead of a fixed assignment shape', () => {
  assert.match(scenarios, /PARKLINE_SCENARIOS/)
  const expectedScenarioIds = ['first-week', 'board-sprint', 'planning-close', 'forecast-handoff', 'close-restatement', 'vendor-operating-review', 'quarterly-operating-review', 'customer-retention-council', 'workforce-planning-council', 'regional-revenue-council', 'midyear-plan-checkpoint', 'daily-revenue-cadence', 'org-manager-review', 'seat-book-review', 'arr-subledger-control', 'customer-lifecycle-council', 'customer-ownership-control', 'reforecast-outcome-review', 'shared-services-allocation-review', 'cost-to-serve-review', 'contractor-consulting-cost-review', 'travel-expense-operating-review', 'revenue-close-usage-review', 'h1-pnl-plan-variance-review', 'arr-retention-review', 'monthly-pnl-trend-review', 'payroll-bridge-review', 'revenue-arr-reconciliation', 'cohort-tenure-review', 'payment-terms-review', 'plan-mix-review', 'comp-band-review']
  const authoredScenarios = [...scenarios.matchAll(/\{\s*id:\s*'([^']+)'[\s\S]*?missionIds:\s*\[([^\]]*)\]\s*\}/g)].map((match) => ({
    id: match[1],
    missionIds: [...match[2].matchAll(/'([^']+)'/g)].map((mission) => mission[1]),
  }))
  assert.deepEqual(authoredScenarios.map((scenario) => scenario.id), expectedScenarioIds)
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'seat-book-review')?.missionIds, ['m93', 'm94', 'm95', 'm96', 'm97', 'm98', 'm99'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'arr-subledger-control')?.missionIds, ['m100', 'm101', 'm102', 'm103', 'm104', 'm105', 'm106', 'm107', 'm108'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'customer-lifecycle-council')?.missionIds, ['m109', 'm110', 'm111', 'm112', 'm113', 'm114', 'm115', 'm116', 'm117'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'customer-ownership-control')?.missionIds, ['m118', 'm119', 'm120', 'm121', 'm122', 'm123', 'm124', 'm125', 'm126', 'm127'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'reforecast-outcome-review')?.missionIds, ['m128', 'm129', 'm130', 'm131', 'm132', 'm133', 'm134', 'm135', 'm136'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'shared-services-allocation-review')?.missionIds, ['m137', 'm138', 'm139', 'm140', 'm141', 'm142', 'm143', 'm144', 'm145'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'cost-to-serve-review')?.missionIds, ['m146', 'm147', 'm148', 'm149', 'm150', 'm151', 'm152', 'm153', 'm154', 'm155'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'contractor-consulting-cost-review')?.missionIds, ['m156', 'm157', 'm158', 'm159', 'm160', 'm161', 'm162'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'travel-expense-operating-review')?.missionIds, ['m163', 'm164', 'm165', 'm166', 'm167', 'm168', 'm169', 'm170'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'revenue-close-usage-review')?.missionIds, ['m171', 'm172', 'm173', 'm174', 'm175', 'm176', 'm177', 'm178', 'm179'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'h1-pnl-plan-variance-review')?.missionIds, ['m180', 'm181', 'm182', 'm183', 'm184', 'm185', 'm186', 'm187'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'arr-retention-review')?.missionIds, ['m188', 'm189', 'm190', 'm191', 'm192', 'm193', 'm194', 'm195'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'monthly-pnl-trend-review')?.missionIds, ['m196', 'm197', 'm198', 'm199', 'm200', 'm201', 'm202', 'm203'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'payroll-bridge-review')?.missionIds, ['m204', 'm205', 'm206', 'm207', 'm208', 'm209', 'm210'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'revenue-arr-reconciliation')?.missionIds, ['m211', 'm212', 'm213', 'm214', 'm215', 'm216', 'm217'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'cohort-tenure-review')?.missionIds, ['m218', 'm219', 'm220', 'm221', 'm222', 'm223'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'payment-terms-review')?.missionIds, ['m224', 'm225', 'm226', 'm227', 'm228', 'm229', 'm230'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'plan-mix-review')?.missionIds, ['m231', 'm232', 'm233', 'm234', 'm235', 'm236'])
  assert.deepEqual(authoredScenarios.find((scenario) => scenario.id === 'comp-band-review')?.missionIds, ['m237', 'm238', 'm239', 'm240', 'm241', 'm242'])
  for (const id of expectedScenarioIds) assert.match(scenarios, new RegExp(id))
  for (const missionList of [
    "'m01', 'm02', 'm03', 'm04', 'm05'",
    "'m06', 'm07', 'm08', 'm09', 'm10', 'm11', 'm12', 'm13', 'm14'",
    "'m09', 'm10', 'm11', 'm12', 'm13', 'm14', 'm15', 'm16', 'm17', 'm18', 'm19', 'm20'",
    "'m21', 'm22', 'm23', 'm24'",
    "'m25', 'm26', 'm27', 'm28', 'm29'",
    "'m30', 'm31', 'm32', 'm33', 'm34', 'm35', 'm36'",
    "'m37', 'm38', 'm39', 'm40', 'm41', 'm42'",
    "'m43', 'm44', 'm45', 'm46', 'm47', 'm48', 'm49'",
    "'m50', 'm51', 'm52', 'm53', 'm54', 'm55', 'm56', 'm57', 'm58'",
    "'m59', 'm60', 'm61', 'm62', 'm63', 'm64', 'm65', 'm66', 'm67'",
    "'m68', 'm69', 'm70', 'm71', 'm72', 'm73', 'm74', 'm75', 'm76', 'm77'",
    "'m78', 'm79', 'm80', 'm81', 'm82', 'm83', 'm84', 'm85'",
    "'m86', 'm87', 'm88', 'm89', 'm90', 'm91', 'm92'",
    "'m93', 'm94', 'm95', 'm96', 'm97', 'm98', 'm99'",
    "'m100', 'm101', 'm102', 'm103', 'm104', 'm105', 'm106', 'm107', 'm108'",
    "'m109', 'm110', 'm111', 'm112', 'm113', 'm114', 'm115', 'm116', 'm117'",
    "'m118', 'm119', 'm120', 'm121', 'm122', 'm123', 'm124', 'm125', 'm126', 'm127'",
    "'m128', 'm129', 'm130', 'm131', 'm132', 'm133', 'm134', 'm135', 'm136'",
    "'m137', 'm138', 'm139', 'm140', 'm141', 'm142', 'm143', 'm144', 'm145'",
    "'m146', 'm147', 'm148', 'm149', 'm150', 'm151', 'm152', 'm153', 'm154', 'm155'",
    "'m156', 'm157', 'm158', 'm159', 'm160', 'm161', 'm162'",
    "'m163', 'm164', 'm165', 'm166', 'm167', 'm168', 'm169', 'm170'",
    "'m171', 'm172', 'm173', 'm174', 'm175', 'm176', 'm177', 'm178', 'm179'",
  ]) assert.match(scenarios, new RegExp(missionList))
  assert.doesNotMatch(pathRegistry, /m01|m02|m03|m04|m05/)
})

const pathSession = await readFile(new URL('../src/kit/path-session.ts', import.meta.url), 'utf8')
check('path session persists last direction outside ProgressV2', () => {
  assert.match(pathSession, /pivot\.pathSession\.v1\./)
  assert.match(pathSession, /export function loadPathSession/)
  assert.match(pathSession, /export function savePathSession/)
  assert.doesNotMatch(pathSession, /from ['"].*progress-store['"]|solveReceipt|\bXP\b|confetti/)
})

check('path session carries optional scenario identity with legacy fallback', () => {
  assert.match(pathSession, /lastScenarioId: string \| null/)
  assert.match(pathSession, /typeof record\.lastScenarioId === 'string'[\s\S]*?\? record\.lastScenarioId : null/)
  assert.match(pathSession, /scenarioId\?: string \| null/)
  assert.match(pathSession, /scenarioId === undefined \? priorScenarioId : scenarioId/)
})

check('integration adapters default to disconnected honesty', () => {
  assert.match(integrationTypes, /state: 'disconnected'/)
  assert.match(integrationTypes, /Not connected/)
  assert.doesNotMatch(integrationTypes, /state: 'live'/)
})

check('compiled Star67 content meets pack floors', () => {
  assert.equal(compiled.company, 'Star67')
  assert.ok(compiled.missions.length >= 179, `missions=${compiled.missions.length}`)
  const compiledMissionIds = new Set(compiled.missions.map((mission) => mission.id))
  for (let number = 1; number <= 179; number += 1) {
    const missionId = `m${String(number).padStart(2, '0')}`
    assert.ok(compiledMissionIds.has(missionId), `${missionId} missing`)
  }
  assert.ok(compiled.sims.length >= 3, `sims=${compiled.sims.length}`)
  assert.ok(compiled.progression.stages.length >= 6, `stages=${compiled.progression.stages.length}`)
  assert.ok(compiled.progression.badges.length >= 8, `badges=${compiled.progression.badges.length}`)
  assert.ok(compiled.progression.companyCards.length >= 9, `cards=${compiled.progression.companyCards.length}`)
  assert.ok(compiled.missions.some((m) => m.id === 'm17'), 'capstone m17 missing')
})

check('badge and stage ids are non-empty derived contracts', () => {
  for (const badge of compiled.progression.badges) {
    assert.ok(badge.id && badge.title && Array.isArray(badge.missionIds))
  }
  for (const stage of compiled.progression.stages) {
    assert.ok(stage.id && stage.title && Array.isArray(stage.requiredBadgeIds))
  }
})

check('no personal secrets baked into pack/kit sources', () => {
  const blob = [pathRegistry, packManifestTypes, parklineManifestSrc, activeSrc, integrationTypes].join('\n')
  assert.doesNotMatch(blob, /\/Users\/|connections\.csv|[A-Z][A-Z0-9_]+_API_KEY|(?:^|\/)\.env(?:$|\/)/i)
})

const progressContracts = await readFile(new URL('../src/kit/progress-contracts.ts', import.meta.url), 'utf8')
check('progress contracts are pack-agnostic and derive-only', () => {
  assert.match(progressContracts, /export interface WorkReceipt/)
  assert.match(progressContracts, /packId: string/)
  assert.match(progressContracts, /export interface ScreenAttempt/)
  assert.match(progressContracts, /export interface EvidenceProjector/)
  // Hard rail: no awarded/invented status — evidence is derived only.
  assert.match(progressContracts, /never persist .awarded./i)
  assert.doesNotMatch(progressContracts, /\bXP\b|confetti|coins?|lives\b/i)
})

const screenRunner = await readFile(new URL('../src/kit/screen-runner.ts', import.meta.url), 'utf8')
check('screen runner keeps per-question evidence immutable and completion derived', () => {
  assert.match(screenRunner, /export function startScreenAttempt/)
  assert.match(screenRunner, /export function recordScreenSolve/)
  assert.match(screenRunner, /export function screenComplete/)
  // A retake is a fresh attempt; existing solves may not be overwritten.
  assert.match(screenRunner, /already has immutable evidence/)
  // Completion is derived from the policy, never stored by the caller.
  assert.match(screenRunner, /derived, never stored/i)
  assert.doesNotMatch(screenRunner, /\bXP\b|confetti|coins?|lives\b/i)
})

const engineerSrc = await readFile(new URL('../src/packs/engineer-desk/manifest.ts', import.meta.url), 'utf8')
const designerSrc = await readFile(new URL('../src/packs/designer-desk/manifest.ts', import.meta.url), 'utf8')

check('engineer and designer packs are registered stubs, not active', () => {
  assert.match(engineerSrc, /id: 'engineer-desk'/)
  assert.match(engineerSrc, /role: 'engineer'/)
  assert.match(designerSrc, /id: 'designer-desk'/)
  assert.match(designerSrc, /role: 'designer'/)
  assert.match(activeSrc, /engineerDeskManifest/)
  assert.match(activeSrc, /designerDeskManifest/)
  assert.match(activeSrc, /ACTIVE_PACK_ID/)
  assert.match(activeSrc, /parkline-fpa/)
  // Active playable pack remains Parkline — stubs must not become ACTIVE_PACK_ID.
  assert.doesNotMatch(activeSrc, /ACTIVE_PACK_ID = 'engineer-desk'/)
  assert.doesNotMatch(activeSrc, /ACTIVE_PACK_ID = 'designer-desk'/)
})

const totalChecks = passed
console.log(`PACK MANIFEST CONTRACT GREEN — ${passed}/${totalChecks} checks`)
