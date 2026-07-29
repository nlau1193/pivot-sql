/** Deterministic, authored coaching fallback. No provider and no answer key. */

import {
  COACHING_BOUNDARY_V1,
  COACHING_CONTRACT_VERSION,
  COACH_LIMITS,
  parseCoachRequestV1,
  parseCoachResponseForRequestV1,
  type CoachContextV1,
  type CoachMessageV1,
  type CoachReferenceV1,
  type CoachRequestV1,
  type CoachResponseV1,
  type AttemptReviewAssessment,
  type AttemptReviewEvidenceKind,
} from './coaching-contract'

function clipped(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, Math.max(0, max - 1)).trimEnd()}…`
}

function tableByName(context: CoachContextV1, name: string | undefined) {
  if (!name) return undefined
  const wanted = name.toLocaleLowerCase()
  return context.schema.find((table) => table.name.toLocaleLowerCase() === wanted)
}

function tableReference(name: string): CoachReferenceV1 {
  return { kind: 'table', label: name }
}

function relationshipReference(leftTable: string, rightTable: string): CoachReferenceV1 {
  return { kind: 'relationship', label: `${leftTable} ↔ ${rightTable}` }
}

function uniqueReferences(references: CoachReferenceV1[]): CoachReferenceV1[] {
  const seen = new Set<string>()
  const unique: CoachReferenceV1[] = []
  for (const reference of references) {
    const normalized = { ...reference, label: clipped(reference.label, COACH_LIMITS.label) }
    const key = `${normalized.kind}:${normalized.label}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(normalized)
    if (unique.length === COACH_LIMITS.references) break
  }
  return unique
}

function localResponse(
  request: CoachRequestV1,
  message: CoachMessageV1,
  review?: { assessment: AttemptReviewAssessment; evidenceUsed: AttemptReviewEvidenceKind[] },
): CoachResponseV1 {
  // Parse the response too. The local fallback must obey the same boundary a
  // future remote provider will be held to.
  const response = {
    version: COACHING_CONTRACT_VERSION,
    requestId: request.requestId,
    mode: request.mode,
    source: 'local',
    message: {
      ...message,
      headline: clipped(message.headline, COACH_LIMITS.label),
      body: clipped(message.body, COACH_LIMITS.responseBody),
      nextMoves: message.nextMoves
        .slice(0, COACH_LIMITS.nextMoves)
        .map((move) => clipped(move, COACH_LIMITS.responseMove)),
      reflectionQuestion: message.reflectionQuestion
        ? clipped(message.reflectionQuestion, COACH_LIMITS.question)
        : null,
      references: uniqueReferences(message.references),
    },
    boundary: COACHING_BOUNDARY_V1,
  }
  return parseCoachResponseForRequestV1(
    request,
    request.mode === 'review_attempt'
      ? { ...response, ...review }
      : response,
  )
}

function nudge(request: Extract<CoachRequestV1, { mode: 'nudge' }>): CoachResponseV1 {
  const { context, input } = request
  const query = input.query?.trim() ?? ''
  const firstTable = context.schema[0]
  const firstRelationship = context.relationships[0]
  const nextMoves: string[] = []
  const references: CoachReferenceV1[] = [{ kind: 'deliverable', label: context.mission.deliverable }]

  if (!query) {
    nextMoves.push('Rewrite the deliverable as a short checklist: output fields, row grain, time boundary, and sort order.')
    if (firstTable) {
      nextMoves.push(`Start from ${firstTable.name} and say its grain out loud: ${firstTable.grain}.`)
      references.push(tableReference(firstTable.name))
    }
    nextMoves.push('Build one clause at a time, running after each meaningful change so the first bad assumption stays visible.')
  } else {
    const upper = query.toLocaleUpperCase()
    if (!/\bFROM\b/.test(upper) && firstTable) {
      nextMoves.push(`Choose the source whose grain matches the deliverable; the first candidate here is ${firstTable.name} (${firstTable.grain}).`)
      references.push(tableReference(firstTable.name))
    }
    if (context.mission.tables.length > 1 && !/\bJOIN\b/.test(upper) && firstRelationship) {
      nextMoves.push(
        `Map the authored key between ${firstRelationship.left.table}.${firstRelationship.left.column} and ${firstRelationship.right.table}.${firstRelationship.right.column}; decide which side can repeat before adding the relationship.`,
      )
      references.push(relationshipReference(firstRelationship.left.table, firstRelationship.right.table))
    }
    if (/\b(?:SUM|COUNT|AVG|MIN|MAX)\s*\(/.test(upper) && !/\bGROUP\s+BY\b/.test(upper)) {
      nextMoves.push('You are aggregating. Check whether the deliverable asks for one total or one row per category; only the latter needs grouping fields.')
      references.push({ kind: 'clause', label: 'aggregation grain' })
    }
    if (/\bGROUP\s+BY\b/.test(upper)) {
      nextMoves.push('Compare every non-aggregated output expression with the grouping grain. Each should describe the same intended row.')
      references.push({ kind: 'clause', label: 'GROUP BY' })
    }
    if (!nextMoves.length) {
      nextMoves.push('Read the query clause by clause and annotate what each one changes: source rows, filters, row multiplication, grouping, then ordering.')
      nextMoves.push('Compare the final row grain and named output fields with the deliverable before changing syntax.')
    }
  }

  return localResponse(request, {
    headline: query ? 'Protect the row grain before changing more SQL' : 'Turn the ask into a query plan',
    body: `This is a coaching nudge for “${context.mission.title}.” It uses only the ${context.pack.place} brief and visible schema; the deterministic engine remains the judge when you run the query.`,
    nextMoves,
    reflectionQuestion: `What should one row of the finished ${context.mission.deliverable} represent?`,
    references,
  })
}

type ErrorKind = 'syntax' | 'missing-column' | 'ambiguous' | 'grouping' | 'missing-table' | 'conversion' | 'unknown'

function errorKind(engineError: string): ErrorKind {
  const error = engineError.toLocaleLowerCase()
  if (/ambiguous|could refer to/.test(error)) return 'ambiguous'
  if (/column.+(?:not found|does not exist)|referenced column.+not found|binder error/.test(error)) return 'missing-column'
  if (/must appear in the group by|not contained in either an aggregate/.test(error)) return 'grouping'
  if (/table.+(?:not found|does not exist)|catalog error/.test(error)) return 'missing-table'
  if (/conversion error|could not convert|cannot cast/.test(error)) return 'conversion'
  if (/parser error|syntax error|at or near|unexpected token/.test(error)) return 'syntax'
  return 'unknown'
}

function explainError(request: Extract<CoachRequestV1, { mode: 'explain_error' }>): CoachResponseV1 {
  const { context } = request
  const firstTable = context.schema[0]
  const kind = errorKind(request.input.engineError)
  const references: CoachReferenceV1[] = []
  let headline = 'Use the engine message to isolate one assumption'
  let body = 'The error tells us where execution stopped, not always where the mistake began. Work backward from that boundary without changing the whole query at once.'
  let nextMoves: string[] = [
    'Undo the last structural change, run the smaller query, then re-add one clause.',
    'Check every referenced table and column against the visible schema rather than memory.',
  ]

  switch (kind) {
    case 'syntax':
      headline = 'The parser stopped; inspect the token immediately before that point'
      body = 'A parser location is a boundary, not a diagnosis. The cause may be a comma, parenthesis, unfinished expression, stray prose, or a clause placed out of order.'
      nextMoves = [
        'If this was pasted from an explanation, keep only the code block; ordinary sentences are not SQL.',
        'Check balanced parentheses and the separator immediately before the reported token.',
        'Temporarily remove the newest expression or clause and run the smaller statement.',
      ]
      references.push({ kind: 'clause', label: 'parser boundary' })
      break
    case 'missing-column':
      headline = 'The query names a field the selected source does not expose'
      body = 'Treat the schema rail as the contract. A familiar business label may differ from the warehouse field name, or the field may belong to another table.'
      nextMoves = [
        'Find the exact field in the visible schema, including underscores and singular/plural spelling.',
        'Confirm the field belongs to a table already in the query before adding another relationship.',
      ]
      if (firstTable) references.push(tableReference(firstTable.name))
      break
    case 'ambiguous':
      headline = 'More than one source exposes that field name'
      body = 'The engine cannot infer which table owns a shared key. This often appears after a relationship adds a second copy of an id or date field.'
      nextMoves = [
        'Identify the intended source for the ambiguous field from the deliverable.',
        'Qualify that field with its table alias everywhere the ownership matters.',
      ]
      references.push({ kind: 'clause', label: 'qualified column' })
      break
    case 'grouping':
      headline = 'The output grain and grouping grain disagree'
      body = 'Every selected expression must either define the grouped row or be summarized within it. The engine found one that does neither.'
      nextMoves = [
        'State what one output row represents.',
        'For each selected field, decide whether it names that row or summarizes rows inside it.',
      ]
      references.push({ kind: 'clause', label: 'GROUP BY' })
      break
    case 'missing-table':
      headline = 'The source name is outside this mission’s visible warehouse context'
      body = 'Check the exact table name and whether it appears in the mission’s source list. A display label is not always the SQL relation name.'
      nextMoves = [
        'Choose from the mission tables shown in the navigator.',
        'Check the full fact, dimension, or staging prefix before running again.',
      ]
      context.schema.forEach((table) => references.push(tableReference(table.name)))
      break
    case 'conversion':
      headline = 'A value and an operation disagree about data type'
      body = 'The engine reached a value that cannot be interpreted as the requested type. First confirm the field’s meaning, then narrow down the values that violate the assumption.'
      nextMoves = [
        'Inspect the field in the schema and identify its business meaning.',
        'Test the transformation on a small sample before using it in the full deliverable.',
      ]
      break
    case 'unknown':
      break
  }

  return localResponse(request, {
    headline,
    body,
    nextMoves,
    reflectionQuestion: 'What is the smallest runnable piece that still reproduces this error?',
    references,
  })
}

function explainVerdict(request: Extract<CoachRequestV1, { mode: 'explain_verdict' }>): CoachResponseV1 {
  const { context, input } = request
  const references: CoachReferenceV1[] = [{ kind: 'deliverable', label: context.mission.deliverable }]
  context.schema.slice(0, 2).forEach((table) => references.push(tableReference(table.name)))

  if (input.verdict.status === 'correct') {
    return localResponse(request, {
      headline: 'The deterministic checker accepted the result',
      body: 'The coaching layer does not award completion; it can help you explain the work. Anchor the explanation in the business ask, the row grain, and one choice that protected correctness.',
      nextMoves: [
        'State the conclusion in one sentence without narrating every clause.',
        'Name the source grain and the filter or relationship choice that mattered most.',
        'Close with the decision this deliverable supports.',
      ],
      reflectionQuestion: 'How would you defend this result to the person who asked for it?',
      references,
    })
  }

  const close = input.verdict.status === 'close'
  return localResponse(request, {
    headline: close ? 'The result is close; protect the deliverable contract' : 'The result differs; debug grain before syntax',
    body: close
      ? 'The deterministic checker found a near miss. Use its visible verdict as the factual boundary, then compare output names, row grain, ordering, and required business scope one at a time.'
      : 'The deterministic checker found a result mismatch. Coaching cannot see or reveal the answer key, so the reliable path is to trace where your query first changes the intended population or row grain.',
    nextMoves: [
      'Restate the deliverable as output fields, one-row meaning, scope, and ordering.',
      'Run the earliest source-and-filter portion and confirm the population before adding relationships or aggregation.',
      'Add each later clause back separately and watch when the row count or grain changes unexpectedly.',
    ],
    reflectionQuestion: 'Which clause first changes the population or grain away from the business ask?',
    references,
  })
}

function explainSchema(request: Extract<CoachRequestV1, { mode: 'schema' }>): CoachResponseV1 {
  const { context, input } = request
  const selected = tableByName(context, input.table) ?? context.schema[0]
  if (!selected) {
    return localResponse(request, {
      headline: 'No mission table is available in the coaching context',
      body: 'The coach only receives allowlisted schema for the active mission. Open the data navigator for the complete warehouse catalog.',
      nextMoves: ['Return to the mission brief and confirm which table is named there.'],
      reflectionQuestion: 'Which source does the brief expect you to inspect first?',
      references: [{ kind: 'deliverable', label: context.mission.deliverable }],
    })
  }

  const wantedColumn = input.column?.toLocaleLowerCase()
  const column = wantedColumn
    ? selected.columns.find((candidate) => candidate.name.toLocaleLowerCase() === wantedColumn)
    : undefined
  const references: CoachReferenceV1[] = [tableReference(selected.name)]
  if (column) references.push({ kind: 'column', label: `${selected.name}.${column.name}` })

  const body = column
    ? `${selected.name}.${column.name}: ${column.description} The table grain is ${selected.grain}.`
    : `${selected.name}: ${selected.description} Its grain is ${selected.grain}.`
  const nextMoves = column
    ? [
        'Decide whether this field identifies a row, describes it, filters it, or supplies a measure.',
        'Check whether using it changes the intended output grain.',
      ]
    : [
        'Say the table grain out loud before choosing fields.',
        `Scan the available fields: ${selected.columns.slice(0, 8).map((candidate) => candidate.name).join(', ')}${selected.columns.length > 8 ? ', …' : ''}.`,
      ]

  return localResponse(request, {
    headline: column ? `Read ${column.name} in its table grain` : `Start with the grain of ${selected.name}`,
    body,
    nextMoves,
    reflectionQuestion: `Does ${selected.grain} match one row of the requested deliverable?`,
    references,
  })
}

function relationshipMatches(
  relationship: CoachContextV1['relationships'][number],
  leftTable: string | undefined,
  rightTable: string | undefined,
): boolean {
  const endpoints = [relationship.left.table.toLocaleLowerCase(), relationship.right.table.toLocaleLowerCase()]
  const left = leftTable?.toLocaleLowerCase()
  const right = rightTable?.toLocaleLowerCase()
  return (!left || endpoints.includes(left)) && (!right || endpoints.includes(right))
}

function explainRelationship(request: Extract<CoachRequestV1, { mode: 'relationship' }>): CoachResponseV1 {
  const { context, input } = request
  const relationship = context.relationships.find((candidate) => (
    relationshipMatches(candidate, input.leftTable, input.rightTable)
  )) ?? context.relationships[0]

  if (!relationship) {
    return localResponse(request, {
      headline: 'No authored relationship is needed for these mission sources',
      body: `The coaching context only exposes joins deliberately authored for ${context.pack.place}. Do not invent a relationship from two fields merely because their values look similar.`,
      nextMoves: [
        'Check whether the deliverable can be completed from one source.',
        'If another source is truly required, inspect the relationship canvas before adding it.',
      ],
      reflectionQuestion: 'What new field or population requires a second table?',
      references: context.schema.slice(0, 2).map((table) => tableReference(table.name)),
    })
  }

  const leftTable = tableByName(context, relationship.left.table)
  const rightTable = tableByName(context, relationship.right.table)
  const leftGrain = leftTable?.grain ?? 'its documented row grain'
  const rightGrain = rightTable?.grain ?? 'its documented row grain'

  return localResponse(request, {
    headline: `Connect ${relationship.left.table} to ${relationship.right.table} deliberately`,
    body: `${relationship.description} The left side is ${leftGrain}; the right side is ${rightGrain}. Shared key names establish a path, but the two grains determine whether rows can multiply.`,
    nextMoves: [
      `Confirm ${relationship.left.column} and ${relationship.right.column} represent the same business identity.`,
      'Decide which side should be unique for this deliverable and test that assumption before calculating a measure.',
      'After connecting the sources, compare row counts before and after so silent multiplication is visible.',
    ],
    reflectionQuestion: 'If one key appears more than once on either side, what should one output row become?',
    references: [
      relationshipReference(relationship.left.table, relationship.right.table),
      { kind: 'column', label: `${relationship.left.table}.${relationship.left.column}` },
      { kind: 'column', label: `${relationship.right.table}.${relationship.right.column}` },
    ],
  })
}

function rehearse(request: Extract<CoachRequestV1, { mode: 'rehearse' }>): CoachResponseV1 {
  const answer = request.input.answer?.trim() ?? ''
  const nextMoves: string[] = []

  if (!answer) {
    nextMoves.push('Lead with the business conclusion, not “I wrote a query.”')
    nextMoves.push('Support it with the scope, time boundary, and one concrete metric or comparison from your result.')
    nextMoves.push('Name one caveat or control, then state the decision or follow-up the work enables.')
  } else {
    const sentences = answer.split(/[.!?]+/).filter((sentence) => sentence.trim().length > 0)
    if (!/\b(?:because|driven by|due to|compared|versus|vs\.?|from|to)\b/i.test(answer)) {
      nextMoves.push('Add one evidence bridge: say what supports the conclusion or what it is compared with.')
    }
    if (!/\b(?:caveat|limited|assuming|as of|through|exclude|control|validate|check)\b/i.test(answer)) {
      nextMoves.push('Add the boundary that keeps the claim honest: cutoff date, population, exclusion, or validation check.')
    }
    if (!/\b(?:recommend|decision|next|follow up|investigate|owner|action)\b/i.test(answer)) {
      nextMoves.push('Close with the decision, owner, or next check this analysis supports.')
    }
    if (sentences.length > 5 || answer.length > 900) {
      nextMoves.push('Compress the delivery to conclusion, evidence, caveat, and action; move query mechanics to follow-up.')
    }
    if (!nextMoves.length) {
      nextMoves.push('Read it once at speaking pace and cut any clause that does not change the conclusion, evidence, caveat, or action.')
    }
  }

  return localResponse(request, {
    headline: answer ? 'Make the handoff sound like an operator' : 'Use a four-beat finance handoff',
    body: `Rehearse “${request.context.mission.title}” as conclusion → evidence → caveat → action. The coach critiques communication only; the deterministic result remains the factual source.`,
    nextMoves,
    reflectionQuestion: 'What should the stakeholder decide or do differently after hearing this?',
    references: [{ kind: 'deliverable', label: request.context.mission.deliverable }],
  })
}

function reviewAttempt(request: Extract<CoachRequestV1, { mode: 'review_attempt' }>): CoachResponseV1 {
  const { context, input } = request
  const official = input.attempt.deterministicVerdict
  const assessment: AttemptReviewAssessment = official.status === 'correct'
    ? 'on_track'
    : official.status === 'incorrect' || official.status === 'close'
      ? 'needs_revision'
      : 'uncertain'
  const evidenceUsed: AttemptReviewEvidenceKind[] = ['current_attempt']
  if (context.schema.length > 0) evidenceUsed.push('authored_schema')
  if (context.relationships.length > 0) evidenceUsed.push('authored_relationships')

  const references: CoachReferenceV1[] = [
    { kind: 'deliverable', label: context.mission.deliverable },
    ...context.schema.slice(0, 2).map((table) => tableReference(table.name)),
  ]
  if (assessment === 'on_track') {
    return localResponse(request, {
      headline: 'The current attempt is on track',
      body: 'The deterministic warehouse checker accepted this result. Frosty is only reviewing the visible approach and cannot replace that verdict.',
      nextMoves: [
        'Explain the output grain and the source boundary that made the result trustworthy.',
        'Name one relationship, filter, or aggregation choice you would defend in review.',
      ],
      reflectionQuestion: 'Which decision in this query most protected the result from a silent data error?',
      references,
    }, { assessment, evidenceUsed })
  }

  if (assessment === 'needs_revision') {
    return localResponse(request, {
      headline: official.status === 'close' ? 'The attempt is close, but needs revision' : 'Revise the population or row grain first',
      body: 'The deterministic checker did not accept the current result. Frosty cannot see an answer key, so use the visible verdict, result shape, schema, and authored relationships to find the earliest assumption that changed the requested population.',
      nextMoves: [
        'Restate what one output row should represent and compare it with the displayed result.',
        'Check the source population and time boundary before changing calculations.',
        'If tables are connected, verify which side can repeat and whether the relationship multiplied rows.',
      ],
      reflectionQuestion: 'Where does the query first change the requested population, grain, or ordering?',
      references,
    }, { assessment, evidenceUsed })
  }

  return localResponse(request, {
    headline: 'The visible evidence is not enough for a confident review',
    body: 'This attempt has no authored correctness verdict. Frosty can inspect the visible result and schema, but the assessment stays uncertain rather than inventing a grade.',
    nextMoves: [
      'State the intended row grain and verify that the displayed rows match it.',
      'Check the result columns and row count against the business question you are exploring.',
    ],
    reflectionQuestion: 'What factual check would turn this exploratory result into decision-ready evidence?',
    references,
  }, { assessment, evidenceUsed })
}

/**
 * Produce useful guidance without network access. The input is reparsed to
 * enforce the same allowlist and size limits used at any future API boundary.
 */
export function createLocalCoachResponse(value: CoachRequestV1 | unknown): CoachResponseV1 {
  const request = parseCoachRequestV1(value)
  switch (request.mode) {
    case 'nudge': return nudge(request)
    case 'explain_error': return explainError(request)
    case 'explain_verdict': return explainVerdict(request)
    case 'schema': return explainSchema(request)
    case 'relationship': return explainRelationship(request)
    case 'rehearse': return rehearse(request)
    case 'review_attempt': return reviewAttempt(request)
  }
}
