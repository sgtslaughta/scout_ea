// ponytail: mirrors src/lib/notificationOptions.ts (~6 lines). A service worker can't import
// app modules without a bundler step; the logic is trivial and unit-tested there. Keep in sync.
function buildNotificationOptions(data) {
  const opts = { body: data.body || '', icon: '/vite.svg', badge: '/vite.svg' }
  if (data.tag) opts.tag = data.tag
  if (data.loud) { opts.requireInteraction = true; opts.renotify = true }
  return opts
}
self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Scout EA', buildNotificationOptions(data))
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/'))
})
