import type { User } from 'lemma-sdk'

type UserLike = Partial<Pick<User, 'email' | 'first_name' | 'last_name'>> & {
  name?: string | null
  display_name?: string | null
  full_name?: string | null
}

function cleanPart(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : ''
}

export function getUserDisplayName(user: UserLike | null | undefined) {
  const displayName = cleanPart(user?.display_name) || cleanPart(user?.name) || cleanPart(user?.full_name)
  if (displayName) return displayName

  const firstName = cleanPart(user?.first_name)
  const lastName = cleanPart(user?.last_name)
  if (firstName && lastName) return `${firstName} ${lastName}`
  if (firstName) return firstName

  const email = cleanPart(user?.email)
  if (email) return email.split('@')[0] || email

  return 'there'
}

export function getUserSecondaryLabel(user: UserLike | null | undefined) {
  const email = cleanPart(user?.email)
  if (email) return email

  const fullName = cleanPart(user?.display_name) || cleanPart(user?.name) || cleanPart(user?.full_name)
  if (fullName) return fullName

  return 'Lemma user'
}

export function getUserInitial(user: UserLike | null | undefined) {
  const name = getUserDisplayName(user)
  const initial = name.trim().charAt(0).toUpperCase()
  return initial || 'L'
}
