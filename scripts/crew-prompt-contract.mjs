import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(
  new URL('../public/characters/desk-crew/crew-manifest.json', import.meta.url),
  'utf8',
))

const representativeRequest = 'Review a simple finance worksheet beside one warm teammate.'
const required = [
  /SINGLE-ILLUSTRATOR COHESION LOCK/,
  /same near-black line weight/,
  /physical medium/,
  /muted palette/,
  /imperfect hand-drawn geometry/,
  /readable at 200px/,
  /no thin grey hairlines/,
  /vector-perfect UI/,
  /micro-labels/,
  /dense grids/,
  /more than six large internal compartments/,
  /character and action read first/,
  /second illustrator/,
  /MATERIAL FINGERPRINT LOCK/,
  /stroke granularity/,
  /visible surface tooth/,
  /fill coverage/,
  /pressure variation/,
  /edge roughness/,
  /cross-hatch density/,
  /Do not smooth/,
  /globally polish/,
  /physical mark-making/,
]

for (const character of manifest.characters) {
  const args = ['scripts/crew-studio.mjs', character.id, representativeRequest]
  const first = execFileSync(process.execPath, args, { encoding: 'utf8' })
  const second = execFileSync(process.execPath, args, { encoding: 'utf8' })
  assert.equal(first, second, `${character.name} prompt must be deterministic`)
  for (const pattern of required) assert.match(first, pattern, `${character.name}: ${pattern}`)
  assert.match(first, new RegExp(`IDENTITY LOCK: ${character.identity.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
  assert.match(first, new RegExp(`ANTI-DRIFT: ${character.antiDrift.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
}

const unknown = BunSafeFailure('not-a-character')
assert.match(unknown, /Unknown character/)

console.log(`Crew prompt contract: ${manifest.characters.length}/6 identities deterministic + single-illustrator cohesion locked`)

function BunSafeFailure(characterId) {
  try {
    execFileSync(process.execPath, ['scripts/crew-studio.mjs', characterId], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (error) {
    return String(error.stderr)
  }
  throw new Error(`Expected ${characterId} to be rejected`)
}
