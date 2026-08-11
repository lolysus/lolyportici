/* Service worker della PWA del personale: riceve le push e apre l'agenda.
 *
 * Fa una cosa sola e la fa bene. Non mette in cache le pagine: il pannello ha
 * bisogno di dati sempre freschi (chi è arrivato, quanti coperti), e una cache
 * che serve una prenotazione di ieri è peggio di un caricamento in più. Il suo
 * mestiere è restare vivo quando l'app è chiusa per mostrare la notifica quando
 * un cliente prenota.
 */

self.addEventListener("install", () => {
  // Entra in servizio subito, senza aspettare che si chiudano le vecchie schede.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Nuova prenotazione", body: "" };
  }

  const title = data.title || "Nuova prenotazione";
  const options = {
    body: data.body || "",
    tag: data.tag || "prenotazione",
    // Riporta in primo piano l'ultima notifica dello stesso evento invece di
    // impilarne una nuova identica.
    renotify: true,
    icon: data.icon || "/brands/notification-badge.png",
    badge: "/brands/notification-badge.png",
    vibrate: [90, 40, 90],
    // In sala il telefono è appoggiato e nessuno lo guarda: la notifica deve
    // restare finché qualcuno non la tocca, non svanire da sola.
    requireInteraction: true,
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Se l'app è già aperta la si porta sulla scheda giusta, invece di aprire
      // una seconda finestra.
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) {
            client.navigate(targetUrl).catch(() => undefined);
          }
          return client.focus();
        }
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});
