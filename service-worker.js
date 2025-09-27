self.addEventListener('push', event => {
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: 'icon.png', // You can add an icon file later if you want
    badge: 'badge.png'
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});