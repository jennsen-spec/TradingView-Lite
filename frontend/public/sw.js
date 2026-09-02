// Service worker de TVLite (#92) — NOTIFICATIONS UNIQUEMENT.
//
// Il ne déclare AUCUN gestionnaire `fetch` : il n'intercepte donc aucune requête,
// ne met rien en cache, et ne peut pas servir une version périmée de l'app.
// C'est la condition posée au #88 pour accepter un service worker.

// Réception d'une poussée : le serveur envoie { titre, corps, signal }.
self.addEventListener("push", (event) => {
  let d = {};
  try { d = event.data ? event.data.json() : {}; } catch { /* charge illisible */ }
  const titre = d.titre || "TVLite";
  const corps = d.corps || "Un nouveau rapport est publié.";
  event.waitUntil(
    self.registration.showNotification(titre, {
      body: corps,
      icon: "apple-touch-icon.png",
      badge: "apple-touch-icon.png",
      tag: "rapport", // une seule notification de rapport à la fois : la nouvelle remplace l'ancienne
      renotify: true,
      data: { signal: d.signal || null },
    }),
  );
});

// Tap sur la notification : ouvrir TVLite sur l'onglet Rapport (ou y ramener
// l'instance déjà ouverte plutôt que d'en lancer une seconde).
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const cible = new URL("./?vue=rapport", self.registration.scope).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((liste) => {
      for (const c of liste) {
        if (c.url.startsWith(self.registration.scope)) {
          c.postMessage({ type: "ouvrir-rapport" });
          return c.focus();
        }
      }
      return self.clients.openWindow(cible);
    }),
  );
});
