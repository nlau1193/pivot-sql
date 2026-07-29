import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'

const manifest = JSON.parse(await readFile(
  new URL('../public/characters/desk-crew/crew-manifest.json', import.meta.url),
  'utf8',
))

const args = process.argv.slice(2)
const id = args.shift()
if (!id || id === '--help') {
  console.log('Usage: npm run crew:prompt -- <character> [scene request] [--slug name] [--write]')
  process.exit(id ? 0 : 1)
}

const character = manifest.characters.find((candidate) => candidate.id === id)
if (!character) throw new Error(`Unknown character "${id}". Choose: ${manifest.characters.map(({ id }) => id).join(', ')}`)

const write = args.includes('--write')
const slugIndex = args.indexOf('--slug')
const requestedSlug = slugIndex >= 0 ? args[slugIndex + 1] : null
if (slugIndex >= 0) args.splice(slugIndex, 2)
const requestWords = args.filter((arg) => arg !== '--write')
const request = requestWords.join(' ').trim()
  || `At a Star67 finance desk, reviewing one clear business question with a calm teammate.`

const prompt = [
  'REFERENCE-EDIT ONLY. Preserve the referenced character exactly; do not redesign or regenerate the identity anchor.',
  '',
  `IDENTITY LOCK: ${character.identity}`,
  `ANTI-DRIFT: ${character.antiDrift}`,
  '',
  `SCENE REQUEST: ${request}`,
  '',
  `STYLE LOCK: ${manifest.styleLock}`,
  'COMPOSITION: single readable focal action; character fills about 70% of the frame; props stay on a clear desk plane; transparent background unless the request names a world scene.',
  'OUTPUT RULES: no words, labels, logos, watermark, UI chrome, duplicate limbs, floating props, or additional characters unless explicitly requested.',
].join('\n')

const promptSha256 = createHash('sha256').update(prompt).digest('hex')
const slug = (requestedSlug || `${character.id}-${promptSha256.slice(0, 10)}`)
  .toLowerCase()
  .replace(/[^a-z0-9-]+/g, '-')
  .replace(/^-+|-+$/g, '')
const metadata = {
  schemaVersion: 1,
  characterId: character.id,
  universe: manifest.universe,
  baseReference: `public/characters/desk-crew/${character.file}`,
  baseSha256: character.sha256,
  promptSha256,
  variantSlug: slug,
  stagedOutput: `output/crew-studio/${slug}.png`,
  immutableBase: true,
  prompt,
}

console.log(prompt)
console.error(`\nReference: ${metadata.baseReference}`)
console.error(`Base SHA-256: ${metadata.baseSha256}`)
console.error(`Prompt SHA-256: ${metadata.promptSha256}`)
console.error(`Variant slug: ${metadata.variantSlug}`)
console.error(`Staged output: ${metadata.stagedOutput}`)
console.error('Base anchors are immutable. Save generated variants outside public/ until visual review passes.')

if (write) {
  const directory = new URL('../output/crew-studio/', import.meta.url)
  await mkdir(directory, { recursive: true })
  const sidecar = new URL(`${slug}.prompt.json`, directory)
  await writeFile(sidecar, `${JSON.stringify(metadata, null, 2)}\n`)
  console.error(`Prompt receipt: ${sidecar.pathname}`)
}
