import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const [seal, reveal, path, crew, crewRegistry, story, app, css, workspace, progressView, coach, desk, index, pathChooser, routing] = await Promise.all([
  readFile(new URL('../src/EvidenceSeal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/BadgeReveal.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/CasebookPath.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/characters/DeskCrew.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/characters/desk-crew.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/star67-story.ts', import.meta.url), 'utf8'),
  readFile(new URL('../src/App.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/styles.css', import.meta.url), 'utf8'),
  readFile(new URL('../src/Workspace.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/CareerDossier.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/CoachPanel.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/Desk.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/PathChooser.tsx', import.meta.url), 'utf8'),
  readFile(new URL('../src/kit/coaching-routing.ts', import.meta.url), 'utf8'),
])

let passed = 0
const check = (name, proof) => {
  proof()
  passed += 1
  console.log(`  ✓ ${name}`)
}

check('named semantic component exports', () => {
  assert.match(seal, /export function EvidenceSeal/)
  assert.match(path, /export function CasebookPath/)
  assert.match(crew, /export function DeskCrew/)
})

check('seal reveal is caller-gated and earned-only', () => {
  assert.match(seal, /const reveal = earned && animate/)
  assert.match(seal, /data-reveal=\{reveal \? 'true' : 'false'\}/)
  assert.match(reveal, /animateReveal = false/)
  assert.match(reveal, /&& animateReveal/)
  assert.match(reveal, /CareerDossier selects at most one genuinely new reveal/)
})

check('path advance is tied to one explicit chapter id', () => {
  assert.match(path, /chapter\.id === animateChapterId/)
  assert.match(path, /data-advance=\{advance \? 'true' : 'false'\}/)
})

check('Star67 desk crew is exactly six named, contextual characters', () => {
  for (const name of ['Riff', 'Rex', 'Coco', 'Zi', 'Fin', 'Frosty']) assert.match(crewRegistry, new RegExp(`name: '${name}'`))
  assert.match(crewRegistry, /DESK_CREW_ORDER[^\n]*\['riff', 'rex', 'coco', 'zi', 'fin', 'frosty'\]/)
  assert.match(crew, /aria-label="Meet the Star67 crew at your desk"/)
  assert.match(crew, /deskCrewAlt\(character\)/)
  assert.match(css, /\.desk-crew__portrait-frame img[^}]*object-fit:\s*contain/)
})

check('desk crew portraits use the licensed Animina identity anchors', () => {
  assert.match(crewRegistry, /origin: 'Animina'/)
  assert.match(crewRegistry, /\/characters\/desk-crew\/base\//)
  assert.doesNotMatch(crewRegistry, /publicPortrait|data:image|emoji/i)
})

check('Riff character canon stays consistent in the first-run story', () => {
  assert.match(story, /name: 'Riff'/)
  assert.match(story, /pronouns: 'she\/her'/)
  assert.match(app, /She opens the/)
  assert.doesNotMatch(app, /Riff[\s\S]{0,160}\bHe\b/)
})

check('motion is one-shot and within the approved window', () => {
  assert.match(css, /casebook-seal-delivered 640ms/)
  assert.match(css, /casebook-path-advance 620ms/)
  const casebookCss = css.slice(css.indexOf('career casebook'))
  assert.doesNotMatch(casebookCss, /animation[^;]*infinite/)
})

check('reduced motion has explicit static final states', () => {
  const reduced = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'))
  assert.match(reduced, /evidence-seal--reveal[\s\S]*animation: none/)
  assert.match(reduced, /casebook-path__chapter\[data-advance='true'\][\s\S]*animation: none/)
  assert.match(reduced, /stroke-dashoffset: 0/)
})

check('small buttons and progress tabs keep visible keyboard targets', () => {
  assert.match(css, /\.btn-small \{[^}]*min-height: 44px/)
  assert.match(css, /\.tab \{[^}]*min-height: 44px/)
  assert.match(css, /\.tab:focus-visible/)
})

check('desk tabs implement the complete keyboard tab pattern', () => {
  assert.match(desk, /role="tablist" aria-orientation="horizontal" aria-label="Desk views"/)
  assert.match(desk, /const DESK_TABS: readonly Tab\[\] = \['queue', 'dossier', 'pulls'\]/)
  assert.match(desk, /const tabRefs = useRef<Partial<Record<Tab, HTMLButtonElement \| null>>>/)
  assert.match(desk, /onKeyDown=\{handleTabKeyDown\}/)
  assert.match(desk, /event\.key === 'ArrowLeft'/)
  assert.match(desk, /event\.key === 'ArrowRight'/)
  assert.match(desk, /event\.key === 'Home'/)
  assert.match(desk, /event\.key === 'End'/)
  assert.match(desk, /setTab\(nextTab\)/)
  assert.match(desk, /tabRefs\.current\[nextTab\]\?\.focus\(\)/)
})

check('narrow screens keep Database objects in a viewport-safe drawer', () => {
  const narrow = css.slice(css.indexOf('@media (max-width: 900px)'))
  assert.match(workspace, /database-navigator__mobile-open/)
  assert.match(workspace, /Open database objects/)
  assert.match(narrow, /\.database-navigator\[data-drawer-open='true'\][\s\S]*?width: min\(380px, 100vw\)/)
  assert.match(narrow, /\.database-navigator__backdrop[\s\S]*?position: fixed/)
  assert.doesNotMatch(css, /Pivot needs a bigger desk/i)
})

check('plain-language progress layout is styled, not bare unstyled markup', () => {
  assert.match(css, /\.career-dossier\s*\{/)
  assert.match(css, /\.dossier-hero\s*\{/)
  assert.match(css, /\.evidence-seal-grid\s*\{[^}]*grid/)
  assert.match(css, /\.future-skills\s*\{/)
  assert.match(css, /\.progress-complete\s*\{/)
  assert.match(progressView, />Your progress</)
  assert.match(progressView, />Your next skill to practice</)
  assert.doesNotMatch(progressView, /Target-company readiness|Career dossier|saved pulls/i)
})

check('progress names guided tasks and practice sets separately', () => {
  assert.match(progressView, /completedAuditionIds\(progress\)/)
  assert.match(progressView, /guided task/)
  assert.match(progressView, /practice set/)
  assert.match(progressView, /Guided task: \$\{label\}/)
  assert.match(progressView, /Practice set: \$\{label\}/)
  assert.match(progressView, /Guided task: \$\{missionById\(nextMissionId\)/)
  assert.match(progressView, /Practice set: \$\{DATA\.sims\.find\(\(sim\) => sim\.id === nextPracticeId\)/)
  assert.match(seal, /supporting evidence/)
  assert.doesNotMatch(seal, /completed tasks|Completed tasks/)
})

check('local save state is plain copy while actionable sync states keep emphasis', () => {
  assert.match(css, /\.topbar-runtime\s*\{[^}]*color:\s*var\(--ink-faint\)/)
  assert.doesNotMatch(css, /\.topbar-runtime\s*\{[^}]*background:/)
  assert.match(css, /\.topbar-sync\s*\{[^}]*background:\s*var\(--amber-soft\)/)
  assert.match(css, /\.topbar-sync--conflict\s*\{[^}]*background:\s*var\(--clay-soft\)/)
  assert.match(css, /\.topbar-runtime, \.topbar-sync[\s\S]*?text-overflow:\s*ellipsis/)
})

check('narrow progress view stacks badges and preserves the optional details control', () => {
  const narrow = css.slice(css.indexOf('@media (max-width: 520px)'))
  assert.match(narrow, /\.dossier-hero\s*\{[^}]*grid-template-columns:\s*1fr/)
  assert.match(narrow, /\.evidence-seal-grid[\s\S]*?grid-template-columns:\s*1fr/)
  assert.match(css, /\.future-skills > summary\s*\{[^}]*min-height:\s*44px/)
})

check('learner-facing setup and guidance state the simple local contract', () => {
  assert.match(app, /Preparing your local practice desk/)
  assert.match(app, /one-time local download includes the practice warehouse/i)
  assert.match(coach, /Built-in first · optional AI/)
  assert.match(coach, /Built-in · private/)
  assert.match(desk, /role="tablist" aria-orientation="horizontal" aria-label="Desk views"/)
  assert.match(desk, /aria-selected=\{tab === 'queue'\}/)
  assert.match(index, /guided questions and a realistic local warehouse/)
})

check('completion and copy failures always leave a clear next action', () => {
  assert.match(pathChooser, /Guided tasks complete/)
  assert.match(pathChooser, /Reopen a saved query or explore the data/)
  assert.match(desk, /else onNavigate\(null\)/)
  assert.match(desk, /Progress code to copy manually/)
  assert.match(desk, /Copy failed\. Select the code below/)
  assert.match(routing, /reason: 'your last run'/)
  assert.match(routing, /reason: 'your current draft'/)
})

check('SQL editor exposes its name on the editable CodeMirror surface', () => {
  assert.match(workspace, /EditorView\.contentAttributes\.of\(\{\s*'aria-label': 'SQL editor'\s*\}\)/)
  assert.match(workspace, /<h1 className="sr-only">Star67 SQL practice workspace<\/h1>/)
})

console.log(`Casebook visual contract: ${passed}/${passed}`)
