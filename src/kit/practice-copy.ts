import type { CompiledSim } from '../missions'

/**
 * Keep the learner's practice library about the skill, not an employer name.
 * Employer/JD provenance stays in the compiled content for review and authoring;
 * it is not a learner-facing product promise.
 */
const PRACTICE_COPY: Record<string, { label: string; summary: string; intro: string }> = {
  sim01: {
    label: 'Customer metrics',
    summary: 'Joins, time periods, and churn',
    intro: 'Four questions on joining customer data, comparing periods, and explaining churn. This uses fictional Star67 data and is practice—not an employer interview.',
  },
  sim02: {
    label: 'Workforce planning',
    summary: 'Headcount, payroll, and plan variance',
    intro: 'Four questions on headcount, payroll, and plan variance. This uses fictional Star67 data and is practice—not an employer interview.',
  },
  sim03: {
    label: 'Close debugging',
    summary: 'Duplicate loads and late close entries',
    intro: 'Four questions on duplicate loads and late close entries. This uses fictional Star67 data and is practice—not an employer interview.',
  },
  sim04: {
    label: 'Plan outcomes',
    summary: 'Comparing plan versions against actuals',
    intro: 'Three questions on comparing two plan versions and checking their outcomes. This uses fictional Star67 data and is practice—not an employer interview.',
  },
  sim05: {
    label: 'Revenue sensitivity',
    summary: 'ARR movement and simple scenarios',
    intro: 'Four questions on ARR movement and simple scenario analysis. This uses fictional Star67 data and is practice—not an employer interview.',
  },
}

const fallback = {
  label: 'SQL practice',
  summary: 'A short SQL practice set',
  intro: 'This uses fictional Star67 data and is practice—not an employer interview.',
}

export function practiceCopy(sim: Pick<CompiledSim, 'id'>) {
  return PRACTICE_COPY[sim.id] ?? fallback
}
