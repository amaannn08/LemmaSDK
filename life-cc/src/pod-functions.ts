import { isTerminalFunctionStatus, nextBackoffDelay, sleep } from 'lemma-sdk'
import { lemmaClient } from './lemma-client'
import type { Category, CommitmentStatus, Priority } from './types'

type LooseFunctionEnvelope<T> = T | { output?: T; data?: T; result?: T; output_data?: T }

type SyncSourceSummary = { seen?: number; written?: number }

export type CreateManualCommitmentInput = {
  title: string
  category: Category
  priority?: Priority
  due_date?: string | null
  description?: string | null
}

export type UpdateCommitmentStatusInput = {
  commitment_id: string
  status: CommitmentStatus
  due_date?: string | null
}

export type CreateGmailDraftInput = {
  commitment_id: string
  final_text: string
}

export type EditCalendarEventInput = {
  commitment_id: string
  title?: string
  due_date?: string
  start_time?: string
  end_time?: string
  timezone?: string
  description?: string
  location?: string
  attendees?: string[]
}

export type CreateCalendarEventInput = {
  title: string
  due_date: string
  start_time?: string
  end_time?: string
  timezone?: string
  description?: string | null
  location?: string | null
  attendees?: string[]
}

export type CreateCalendarEventResult = {
  commitment_id: string
  event_id: string
  message: string
}

export type RunExtractionInput = {
  sync_run_id: string
}

export type RunExtractionResult = {
  items_seen?: number
  items_written?: number
  sources?: Record<string, SyncSourceSummary>
}

export type ClassifyCommitmentsInput = {
  limit?: number
}

export type ClassifyCommitmentsResult = {
  processed?: number
  classified?: number
  not_actionable?: number
}

export type ReplySuggestionContext = {
  prompt: string
  sender?: string
  subject?: string
  excerpt?: string
}

export type GmailDraftResult = {
  draft_id?: string
  message?: string
}

export type CalendarEditResult = {
  changed_fields?: string[]
  message?: string
}

export type DocumentPreviewResult = {
  content: string
}

function unwrapFunctionOutput<T>(raw: LooseFunctionEnvelope<T>): T {
  if (raw && typeof raw === 'object') {
    if ('output_data' in raw && raw.output_data !== undefined) return raw.output_data
    if ('output' in raw && raw.output !== undefined) return raw.output
    if ('data' in raw && raw.data !== undefined) return raw.data
    if ('result' in raw && raw.result !== undefined) return raw.result
  }
  return raw as T
}

function toTextPayload(raw: unknown, emptyMessage: string) {
  if (typeof raw === 'string') return raw
  if (raw && typeof raw === 'object') {
    const payload = raw as Record<string, unknown>
    const candidate = [payload.text, payload.content, payload.message].find((value) => typeof value === 'string')
    if (typeof candidate === 'string') return candidate
  }
  throw new Error(emptyMessage)
}

const FUNCTION_RUN_MAX_WAIT_MS = 5 * 60 * 1000

type FunctionRunEnvelope = LooseFunctionEnvelope<unknown> & { id?: string; status?: string; error?: string | null }

// `functions.run` only *starts* the job — it returns a PENDING envelope with
// output_data: null almost instantly, not the finished result. Poll runs.get
// until the run reaches a terminal status before treating it as done, or every
// caller (Check now, quick-add, mark-done, ...) reports false-instant success.
async function runPodFunction<TInput extends Record<string, unknown>, TOutput>(name: string, input: TInput): Promise<TOutput> {
  let run = (await lemmaClient.functions.run(name, { input })) as FunctionRunEnvelope
  const runId = run.id
  if (runId) {
    const deadline = Date.now() + FUNCTION_RUN_MAX_WAIT_MS
    let attempt = 0
    while (!isTerminalFunctionStatus(run.status)) {
      if (Date.now() >= deadline) throw new Error(`${name} timed out waiting for a result.`)
      await sleep(nextBackoffDelay(attempt))
      attempt += 1
      run = (await lemmaClient.functions.runs.get(name, runId)) as FunctionRunEnvelope
    }
  }
  if (run.status === 'FAILED' || run.status === 'CANCELLED') {
    throw new Error(run.error || `${name} ${run.status.toLowerCase()}`)
  }
  return unwrapFunctionOutput(run as LooseFunctionEnvelope<TOutput>)
}

export function createManualCommitment(input: CreateManualCommitmentInput) {
  return runPodFunction<CreateManualCommitmentInput, unknown>('create_manual_commitment', input)
}

export function updateCommitmentStatus(input: UpdateCommitmentStatusInput) {
  return runPodFunction<UpdateCommitmentStatusInput, unknown>('update_commitment_status', input)
}

export function suggestGmailReply(commitment_id: string): Promise<ReplySuggestionContext> {
  return runPodFunction<{ commitment_id: string }, ReplySuggestionContext>('suggest_gmail_reply', { commitment_id })
}

export function createGmailDraft(input: CreateGmailDraftInput) {
  return runPodFunction<CreateGmailDraftInput, GmailDraftResult>('create_gmail_draft', input)
}

export function editCalendarEvent(input: EditCalendarEventInput) {
  return runPodFunction<EditCalendarEventInput, CalendarEditResult>('edit_calendar_event', input)
}

export function createCalendarEvent(input: CreateCalendarEventInput) {
  return runPodFunction<CreateCalendarEventInput, CreateCalendarEventResult>('create_calendar_event', input)
}

export function previewDocument(commitment_id: string): Promise<DocumentPreviewResult> {
  return runPodFunction<{ commitment_id: string }, unknown>('preview_document', { commitment_id }).then((raw) => ({
    content: toTextPayload(raw, 'No document preview returned.'),
  }))
}

export function runExtraction(input: RunExtractionInput) {
  return runPodFunction<RunExtractionInput, RunExtractionResult>('run_extraction', input)
}

export function classifyCommitments(input: ClassifyCommitmentsInput) {
  return runPodFunction<ClassifyCommitmentsInput, ClassifyCommitmentsResult>('classify_commitments', input)
}

export function refreshBriefing() {
  return lemmaClient.workflows.runs.create('briefing-refresh')
}
