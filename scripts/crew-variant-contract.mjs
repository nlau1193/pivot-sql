import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { inflateSync } from 'node:zlib'

const COHESION_POLICY = {
  version: 1,
  required: true,
  auditWidthPx: 200,
  maximumSupportingCompartments: 6,
  rejectSecondIllustratorSeam: true,
  preserveMaterialFingerprint: true,
}

const REQUIRED_PROMPT_PATTERNS = [
  /SINGLE-ILLUSTRATOR COHESION LOCK/,
  /same near-black line weight/,
  /readable at 200px/,
  /no thin grey hairlines/,
  /vector-perfect UI/,
  /more than six large internal compartments/,
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

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex')
}

function paeth(a, b, c) {
  const prediction = a + b - c
  const pa = Math.abs(prediction - a)
  const pb = Math.abs(prediction - b)
  const pc = Math.abs(prediction - c)
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c
}

export function decodeRgbaPng(bytes) {
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG signature')
  const idat = []
  let info = null
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii')
    const dataStart = offset + 8
    const dataEnd = dataStart + length
    assert.ok(dataEnd + 4 <= bytes.length, `truncated PNG chunk ${type}`)
    const data = bytes.subarray(dataStart, dataEnd)
    if (type === 'IHDR') {
      info = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      }
    } else if (type === 'IDAT') {
      idat.push(data)
    }
    offset = dataEnd + 4
    if (type === 'IEND') break
  }
  assert.ok(info, 'PNG must contain IHDR')
  assert.deepEqual(info, {
    width: 1024,
    height: 1024,
    bitDepth: 8,
    colorType: 6,
    compression: 0,
    filter: 0,
    interlace: 0,
  }, 'variant must be non-interlaced 1024×1024 8-bit RGBA')
  assert.ok(idat.length, 'PNG must contain pixel data')

  const bytesPerPixel = 4
  const rowBytes = info.width * bytesPerPixel
  const filtered = inflateSync(Buffer.concat(idat))
  assert.equal(filtered.length, info.height * (rowBytes + 1), 'inflated PNG scanline length')
  const pixels = Buffer.alloc(info.height * rowBytes)
  for (let y = 0; y < info.height; y += 1) {
    const filterType = filtered[y * (rowBytes + 1)]
    assert.ok(filterType >= 0 && filterType <= 4, `unsupported PNG filter ${filterType}`)
    const sourceStart = y * (rowBytes + 1) + 1
    const targetStart = y * rowBytes
    for (let x = 0; x < rowBytes; x += 1) {
      const raw = filtered[sourceStart + x]
      const left = x >= bytesPerPixel ? pixels[targetStart + x - bytesPerPixel] : 0
      const up = y > 0 ? pixels[targetStart + x - rowBytes] : 0
      const upLeft = y > 0 && x >= bytesPerPixel ? pixels[targetStart + x - rowBytes - bytesPerPixel] : 0
      const predictor = filterType === 0 ? 0
        : filterType === 1 ? left
          : filterType === 2 ? up
            : filterType === 3 ? Math.floor((left + up) / 2)
              : paeth(left, up, upLeft)
      pixels[targetStart + x] = (raw + predictor) & 0xff
    }
  }
  return { ...info, pixels }
}

export function validateVariant(bytes, receipt, baseBytes, pngPath) {
  const publicBase = resolve('public/characters/desk-crew/base')
  assert.ok(!pngPath.startsWith(`${publicBase}/`), 'REFUSED: generated output may not target an immutable base anchor')
  assert.equal(receipt.schemaVersion, 2, 'current prompt receipt schema')

  const variant = decodeRgbaPng(bytes)
  const base = decodeRgbaPng(baseBytes)
  assert.equal(sha256(baseBytes), receipt.baseSha256, 'receipt must name the current immutable base bytes')
  assert.notEqual(sha256(variant.pixels), sha256(base.pixels), 'variant must differ from the base decoded pixel identity')

  let transparentPixels = 0
  let opaquePixels = 0
  for (let offset = 0; offset < variant.pixels.length; offset += 4) {
    const alpha = variant.pixels[offset + 3]
    assert.ok(alpha === 0 || alpha === 255, `variant alpha must be binary; found ${alpha}`)
    if (alpha === 0) {
      transparentPixels += 1
      assert.equal(
        variant.pixels[offset] | variant.pixels[offset + 1] | variant.pixels[offset + 2],
        0,
        'transparent pixels must have zero RGB to prevent halos',
      )
    } else {
      opaquePixels += 1
    }
  }
  assert.ok(transparentPixels > 0, 'variant must have a real transparent background')
  assert.ok(opaquePixels > 0, 'variant must contain visible artwork')
  assert.deepEqual([...variant.pixels.subarray(0, 4)], [0, 0, 0, 0], 'top-left corner must be transparent')

  const promptHash = sha256(receipt.prompt)
  assert.equal(promptHash, receipt.promptSha256, 'prompt receipt hash')
  assert.match(receipt.baseReference, /^public\/characters\/desk-crew\/base\/.+\.png$/)
  assert.match(receipt.baseSha256, /^[a-f0-9]{64}$/)
  assert.equal(receipt.immutableBase, true)
  assert.deepEqual(receipt.cohesionPolicy, COHESION_POLICY, 'single-illustrator cohesion policy')
  for (const pattern of REQUIRED_PROMPT_PATTERNS) assert.match(receipt.prompt, pattern)
}

async function selfTest() {
  const manifest = JSON.parse(await readFile(
    new URL('../public/characters/desk-crew/crew-manifest.json', import.meta.url),
    'utf8',
  ))
  const character = manifest.characters[0]
  const baseReference = `public/characters/desk-crew/${character.file}`
  const baseBytes = await readFile(resolve(baseReference))
  const prompt = REQUIRED_PROMPT_PATTERNS.map((pattern) => pattern.source.replaceAll('\\', '')).join('\n')
  const receipt = {
    schemaVersion: 2,
    baseReference,
    baseSha256: character.sha256,
    immutableBase: true,
    prompt,
    promptSha256: sha256(prompt),
    cohesionPolicy: COHESION_POLICY,
  }
  const samePixelsDifferentFileBytes = Buffer.concat([baseBytes, Buffer.from('not new pixels')])
  assert.throws(
    () => validateVariant(samePixelsDifferentFileBytes, receipt, baseBytes, resolve('output/crew-studio/fake.png')),
    /decoded pixel identity/,
  )
  console.log('Crew variant self-test: unchanged base pixels with different file bytes rejected')
}

const [pngArg, receiptArg] = process.argv.slice(2)
if (pngArg === '--self-test') {
  await selfTest()
} else {
  if (!pngArg || !receiptArg) {
    console.error('Usage: npm run crew:verify -- output/crew-studio/<variant>.png output/crew-studio/<variant>.prompt.json')
    process.exit(1)
  }
  const pngPath = resolve(pngArg)
  const receiptPath = resolve(receiptArg)
  const receipt = JSON.parse(await readFile(receiptPath, 'utf8'))
  assert.match(receipt.baseReference, /^public\/characters\/desk-crew\/base\/.+\.png$/)
  const [bytes, baseBytes] = await Promise.all([readFile(pngPath), readFile(resolve(receipt.baseReference))])
  validateVariant(bytes, receipt, baseBytes, pngPath)
  console.log(`Crew variant contract: ${receipt.variantSlug} is staged, traceable, pixel-distinct, 1024×1024 RGBA, and halo-safe`)
}
