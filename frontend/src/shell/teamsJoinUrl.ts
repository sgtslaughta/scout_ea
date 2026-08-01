import type { EventItem } from '@/api'
import { safeHttpUrl } from '@/lib/url'

// Matches Teams meeting join links only — a bare https:// link in the body
// is NOT a join link, and a wrong join button is worse than none.
const TEAMS_JOIN_RE = /https:\/\/teams\.(?:microsoft\.com\/l\/meetup-join|live\.com\/meet)\/\S+/i

/** Extracts a Teams meeting join URL from an event's body/attendees, or null if none found. */
export function teamsJoinUrl(event: Pick<EventItem, 'body' | 'attendees'>): string | null {
  const haystack = `${event.body ?? ''} ${event.attendees ?? ''}`
  const match = haystack.match(TEAMS_JOIN_RE)
  if (!match) return null
  // Trim trailing punctuation that isn't part of the URL (e.g. sentence periods).
  const raw = match[0].replace(/[.,)\]]+$/, '')
  return safeHttpUrl(raw)
}
