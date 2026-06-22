self.addEventListener('push', (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Scout EA', {
      body: data.body || '', icon: '/vite.svg', badge: '/vite.svg',
    })
  )
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(self.clients.openWindow('/'))
})
