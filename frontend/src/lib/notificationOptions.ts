export interface PushData {
  title?: string
  body?: string
  loud?: boolean
  tag?: string
}

/** Build showNotification options from a push payload. Loud alerts stay on screen and re-alert. */
export function buildNotificationOptions(data: PushData): NotificationOptions {
  const opts: NotificationOptions = { body: data.body || '', icon: '/vite.svg', badge: '/vite.svg' }
  if (data.tag) opts.tag = data.tag
  if (data.loud) {
    opts.requireInteraction = true
    // renotify is valid at runtime but missing from the DOM lib types
    ;(opts as NotificationOptions & { renotify?: boolean }).renotify = true
  }
  return opts
}
