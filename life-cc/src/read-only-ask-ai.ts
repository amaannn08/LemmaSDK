import type { Commitment } from './types'

type AskAiSnapshot = {
  openRecords: Commitment[]
  snoozedRecords: Commitment[]
}

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function formatList(records: Commitment[], emptyMessage: string) {
  if (records.length === 0) return emptyMessage
  return records
    .slice(0, 5)
    .map((record) => `- ${record.title}${record.due_date ? ` (${record.due_date})` : ''}`)
    .join('\n')
}

function buildOverview({ openRecords, snoozedRecords }: AskAiSnapshot) {
  const today = todayISO()
  const overdue = openRecords.filter((record) => record.due_date && record.due_date < today)
  const dueToday = openRecords.filter((record) => record.due_date === today)
  const nextUp = openRecords.filter((record) => record.due_date && record.due_date >= today).slice(0, 3)

  const lines = [
    `You have ${openRecords.length} open commitment${openRecords.length === 1 ? '' : 's'}.`,
    overdue.length > 0 ? `${overdue.length} are overdue.` : 'Nothing is overdue right now.',
    dueToday.length > 0 ? `${dueToday.length} are due today.` : 'Nothing is due today.',
  ]

  if (snoozedRecords.length > 0) {
    lines.push(`${snoozedRecords.length} item${snoozedRecords.length === 1 ? ' is' : 's are'} snoozed separately.`)
  }
  if (nextUp.length > 0) {
    lines.push(`Next up:\n${formatList(nextUp, '')}`)
  }

  return lines.join('\n\n')
}

export function answerReadOnlyQuestion(question: string, snapshot: AskAiSnapshot) {
  const normalized = question.toLowerCase()
  if (/(add|create|mark|snooze|unsnooze|done|delete|remove|reply|draft|edit|send)\b/.test(normalized)) {
    return 'Ask AI is read-only here. Use Quick Add, the Snoozed view, or the row actions for changes.'
  }

  if (/snooz/.test(normalized)) {
    return formatList(snapshot.snoozedRecords, 'Nothing is snoozed right now.')
  }

  if (/overdue|late|missed/.test(normalized)) {
    const overdue = snapshot.openRecords.filter((record) => record.due_date && record.due_date < todayISO())
    return formatList(overdue, 'Nothing is overdue right now.')
  }

  if (/today/.test(normalized)) {
    const today = snapshot.openRecords.filter((record) => record.due_date === todayISO())
    return formatList(today, 'Nothing is due today.')
  }

  if (/week/.test(normalized)) {
    const today = new Date()
    const weekEnd = new Date(today)
    weekEnd.setDate(today.getDate() + 7)
    const weekEndISO = weekEnd.toISOString().slice(0, 10)
    const weekItems = snapshot.openRecords.filter(
      (record) => record.due_date && record.due_date >= todayISO() && record.due_date <= weekEndISO,
    )
    return formatList(weekItems, 'Nothing is due in the next 7 days.')
  }

  if (/follow/.test(normalized)) {
    return formatList(snapshot.openRecords.filter((record) => record.category === 'followup'), 'No open follow-ups right now.')
  }

  if (/document|doc|drive|sheet/.test(normalized)) {
    return formatList(snapshot.openRecords.filter((record) => record.category === 'document'), 'No open documents right now.')
  }

  if (/loop/.test(normalized)) {
    return formatList(snapshot.openRecords.filter((record) => record.category === 'loop'), 'No open loops right now.')
  }

  return buildOverview(snapshot)
}
