/** Returns the URL only if it is http(s); otherwise null. Blocks javascript:/data: etc. */
export function safeHttpUrl(u: unknown): string | null {
  try {
    const p = new URL(String(u))
    return p.protocol === 'http:' || p.protocol === 'https:' ? p.toString() : null
  } catch {
    return null
  }
}
