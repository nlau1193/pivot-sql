import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8')

function token(name) {
  const match = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, 'i'))
  assert.ok(match, `missing ${name} token`)
  return match[1]
}

function luminance(hex) {
  const channels = [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map((value) => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

function contrast(foreground, background) {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return (light + 0.05) / (dark + 0.05)
}

const raised = token('--paper-raised')
const soft = token('--amber-soft')
const faintRatio = contrast(token('--ink-faint'), raised)
const amberRatio = contrast(token('--amber'), soft)
assert.ok(faintRatio >= 4.5, `--ink-faint contrast ${faintRatio.toFixed(2)}:1 is below 4.5:1`)
assert.ok(amberRatio >= 4.5, `--amber contrast ${amberRatio.toFixed(2)}:1 is below 4.5:1`)
console.log(`Contrast contract: --ink-faint ${faintRatio.toFixed(2)}:1, --amber ${amberRatio.toFixed(2)}:1`)
