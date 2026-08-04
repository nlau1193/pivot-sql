import { readFile } from 'node:fs/promises'

const readme = await readFile(new URL('../README.md', import.meta.url), 'utf8')
const required = [
  'https://learn-sql-peach.vercel.app/',
  'No account, upload, API key, paid service, or AI model is required.',
  'docs/star67-practice-desk.png',
]
const forbidden = /\b(install|clone|contributor)\b|node\.js|\bnpm\b|\.\/start/i

for (const text of required) {
  if (!readme.includes(text)) throw new Error(`README is missing required front-door copy: ${text}`)
}

if (forbidden.test(readme)) {
  throw new Error('README must stay browser-first; remove installation or contributor instructions')
}

const lineCount = readme.trim().split(/\r?\n/).length
if (lineCount > 20) throw new Error(`README is ${lineCount} lines; keep the public front door concise`)

console.log(`README_CONTRACT=PASS lines=${lineCount}`)
