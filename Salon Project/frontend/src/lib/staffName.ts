/**
 * Display label for a staff member. The list endpoint joins the linked user, so
 * `name` is normally present; it stays optional so the UI degrades gracefully
 * to the specialisation if a payload ever omits it.
 */
export function staffNameOf(member: {
  id: number
  name?: string
  specialization?: string | null
}): string {
  return member.name?.trim() || member.specialization?.trim() || `Staff #${member.id}`
}
