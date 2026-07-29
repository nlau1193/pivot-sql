import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [pngArg, receiptArg] = process.argv.slice(2)
if (!pngArg || !receiptArg) {
  console.error('Usage: npm run crew:verify -- output/crew-studio/<variant>.png output/crew-studio/<variant>.prompt.json')
  process.exit(1)
}

const pngPath = resolve(pngArg)
const receiptPath = resolve(receiptArg)
const publicBase = resolve('public/characters/desk-crew/base')
assert.ok(!pngPath.startsWith(`${publicBase}/`), 'REFUSED: generated output may not target an immutable base anchor')

const [bytes, receiptText] = await Promise.all([readFile(pngPath), readFile(receiptPath, 'utf8')])
const receipt = JSON.parse(receiptText)
assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature')
assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR', 'IHDR must be first')
const info = {
  width: bytes.readUInt32BE(16),
  height: bytes.readUInt32BE(20),
  bitDepth: bytes[24],
  colorType: bytes[25],
}
assert.deepEqual(info, { width: 1024, height: 1024, bitDepth: 8, colorType: 6 }, 'variant must be 1024×1024 8-bit RGBA')

const promptHash = createHash('sha256').update(receipt.prompt).digest('hex')
assert.equal(promptHash, receipt.promptSha256, 'prompt receipt hash')
assert.match(receipt.baseReference, /^public\/characters\/desk-crew\/base\/.+\.png$/)
assert.match(receipt.baseSha256, /^[a-f0-9]{64}$/)
assert.equal(receipt.immutableBase, true)
assert.notEqual(createHash('sha256').update(bytes).digest('hex'), receipt.baseSha256, 'variant may not overwrite the base pixels')

console.log(`Crew variant contract: ${receipt.variantSlug} is staged, traceable, 1024×1024 RGBA, and distinct from its immutable base`)
