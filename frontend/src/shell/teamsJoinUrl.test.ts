import { describe, it, expect } from 'vitest'
import { teamsJoinUrl } from './teamsJoinUrl'

describe('teamsJoinUrl', () => {
  it('extracts a teams.microsoft.com meetup-join link from the body', () => {
    const url = teamsJoinUrl({ body: 'Join here: https://teams.microsoft.com/l/meetup-join/abc123' })
    expect(url).toBe('https://teams.microsoft.com/l/meetup-join/abc123')
  })

  it('extracts a teams.live.com meet link from the body', () => {
    const url = teamsJoinUrl({ body: 'https://teams.live.com/meet/xyz987' })
    expect(url).toBe('https://teams.live.com/meet/xyz987')
  })

  it('trims trailing sentence punctuation from the match', () => {
    const url = teamsJoinUrl({ body: 'Meeting link: https://teams.microsoft.com/l/meetup-join/abc123.' })
    expect(url).toBe('https://teams.microsoft.com/l/meetup-join/abc123')
  })

  it('finds a link in attendees if not present in body', () => {
    const url = teamsJoinUrl({ body: 'No link here', attendees: 'https://teams.microsoft.com/l/meetup-join/def456' })
    expect(url).toBe('https://teams.microsoft.com/l/meetup-join/def456')
  })

  it('returns null for a generic https link', () => {
    const url = teamsJoinUrl({ body: 'See notes at https://example.com/doc' })
    expect(url).toBeNull()
  })

  it('returns null when body and attendees are missing', () => {
    expect(teamsJoinUrl({})).toBeNull()
  })

  it('returns null for a javascript: pseudo-url', () => {
    const url = teamsJoinUrl({ body: 'javascript:alert(1) teams.microsoft.com/l/meetup-join/abc' })
    expect(url).toBeNull()
  })

  it('returns null for plain text with no url at all', () => {
    const url = teamsJoinUrl({ body: 'Call me at the usual number' })
    expect(url).toBeNull()
  })
})
