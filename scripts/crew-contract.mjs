import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

const ROOT = new URL('../public/characters/desk-crew/', import.meta.url)
const manifest = JSON.parse(await readFile(new URL('crew-manifest.json', ROOT), 'utf8'))
const registry = await readFile(new URL('../src/characters/desk-crew.ts', import.meta.url), 'utf8')
const component = await readFile(new URL('../src/characters/DeskCrew.tsx', import.meta.url), 'utf8')
const app = await readFile(new URL('../src/App.tsx', import.meta.url), 'utf8')
const studio = await readFile(new URL('crew-studio.mjs', import.meta.url), 'utf8')
const assetLicense = await readFile(new URL('ASSET_LICENSE.md', ROOT), 'utf8')
const rootLicense = await readFile(new URL('../LICENSE', import.meta.url), 'utf8')

function pngInfo(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature')
  assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR', 'IHDR must be first')
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
    bitDepth: bytes[24],
    colorType: bytes[25] === 6 ? 'RGBA' : bytes[25] === 2 ? 'RGB' : `PNG-${bytes[25]}`,
  }
}

const expectedOrder = ['riff', 'rex', 'coco', 'zi', 'fin', 'frosty']
assert.equal(manifest.universe, 'Animina')
assert.equal(manifest.productWorld, 'Star67')
assert.deepEqual(manifest.characters.map(({ id }) => id), expectedOrder)
assert.equal(new Set(manifest.characters.map(({ sha256 }) => sha256)).size, 6)
assert.match(manifest.identityPolicy, /immutable/i)

for (const character of manifest.characters) {
  const bytes = await readFile(new URL(character.file, ROOT))
  const info = pngInfo(bytes)
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  assert.equal(sha256, character.sha256, `${character.name} canonical hash`)
  assert.equal(info.width, character.width, `${character.name} width`)
  assert.equal(info.height, character.height, `${character.name} height`)
  assert.equal(info.bitDepth, 8, `${character.name} bit depth`)
  assert.equal(info.colorType, 'RGBA', `${character.name} transparent portrait`)
  assert.match(character.identity, character.species === 'dog' ? /dog/i : new RegExp(character.species, 'i'))
  assert.match(registry, new RegExp(`id: '${character.id}'[\\s\\S]*?origin: 'Animina'[\\s\\S]*?/${character.file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`))
}

const worldBytes = await readFile(new URL(manifest.world.file, ROOT))
const worldInfo = pngInfo(worldBytes)
assert.equal(createHash('sha256').update(worldBytes).digest('hex'), manifest.world.sha256)
assert.equal(worldInfo.width, manifest.world.width)
assert.equal(worldInfo.height, manifest.world.height)
assert.equal(worldInfo.colorType, 'RGB')
assert.match(manifest.world.usage, /Never crop.*portrait/i)

assert.doesNotMatch(registry, /publicPortrait|data:image|emoji/i)
assert.match(registry, /DESK_CREW_ORDER[^\n]*\['riff', 'rex', 'coco', 'zi', 'fin', 'frosty'\]/)
assert.match(component, /Meet the Star67 crew at your desk/)
assert.match(app, /Meet the crew at your desk/)
assert.doesNotMatch(app, /From Animina to Star67/)
assert.match(app, /DeskCrew presentation="welcome"/)
assert.match(studio, /SINGLE-ILLUSTRATOR COHESION LOCK/)
assert.match(studio, /same near-black line weight/)
assert.match(studio, /readable at 200px/)
assert.match(studio, /more than six large internal compartments/)
assert.match(studio, /second illustrator/)
assert.match(studio, /MATERIAL FINGERPRINT LOCK/)
assert.match(studio, /stroke granularity/)
assert.match(studio, /visible surface tooth/)
assert.match(studio, /globally polish/)
assert.match(assetLicense, /not.*licensed under Star67's MIT License/is)
assert.match(rootLicense, /does not cover the Animina artwork/)

console.log('Animina crew contract: 6/6 canonical anchors + world + UI wiring verified')
