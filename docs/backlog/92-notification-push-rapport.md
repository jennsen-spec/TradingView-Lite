# #92 — Notification iOS à la publication du rapport

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : suite de [#90](90-pastille-nouveau-rapport.md)

## Objectif
Quand le rapport mensuel est publié, **la notification arrive seule sur l'iPhone** — app fermée,
sans avoir à l'ouvrir. Elle complète la pastille interne du #90, qui elle ne s'allume qu'à
l'ouverture de l'app.

## Ce qui retire la notification
Trois objets distincts, une seule règle : **consulter le rapport une fois éteint tout**.

| Objet | Ce qui l'éteint |
|---|---|
| La **bannière** (centre de notifications) | Jean la tape (iOS la retire) ou la balaie. À l'ouverture de l'app, on ferme aussi celles qui traînent (`registration.getNotifications()` → `close()`), sinon la notif du mois précédent resterait. |
| La **pastille sur l'icône** de l'écran d'accueil | `navigator.clearAppBadge()`, appelé à la première consultation du rapport — le même déclencheur que le #90. |
| La **pastille dans l'app** (#90) | Déjà en place : première ouverture de l'onglet Rapport. |

Taper la notification ouvre l'app **sur l'onglet Rapport** → les trois s'éteignent d'un coup.

## Critères d'acceptation
- [ ] Depuis l'app installée sur l'écran d'accueil, une entrée du menu **⋯** permet d'activer les notifications (iOS exige un geste explicite) ; l'état activé/refusé est lisible.
- [ ] À la publication d'un nouveau signal, une notification arrive sur l'iPhone **app fermée**, titrée avec la date du signal.
- [ ] La taper ouvre TVLite **sur l'onglet Rapport**.
- [ ] Après consultation : bannière fermée, pastille d'icône effacée, pastille interne éteinte.
- [ ] **Une seule notification par publication** — pas une par déploiement du site.
- [ ] Un refus de permission (ou un navigateur sans support) laisse l'app pleinement fonctionnelle, pastille interne comprise.
- [ ] Desktop : aucun changement.

## Décisions
- **Service worker `push` uniquement, sans gestionnaire `fetch`.** *Correction de ce que j'avais
  avancé au #88* : le piège du cache vient d'un service worker qui intercepte les requêtes réseau.
  Un worker qui ne traite que `push` et `notificationclick` n'intercepte rien, ne met rien en cache,
  et ne peut donc pas servir une version périmée. L'engagement du #88 tient.
- **Abonnement par appareil**, pas par compte : l'app est mono-utilisateur, inutile d'attendre
  l'espace membre (#24). Un jour où les comptes existeront, l'abonnement s'y rattachera.
- **Déclenchement au changement de signal**, sur l'étape `Publier` du workflow `rapport.yml`
  (déjà conditionnée à `change == 'true'`) — donc une fois par mois, jamais à un simple déploiement.
- Web Push sur iOS exige que l'app soit **installée sur l'écran d'accueil** : c'est acquis depuis
  le [#88](88-pwa.md).

## Plan technique
1. `public/sw.js` : service worker minimal — `push` (afficher la notification) + `notificationclick` (ouvrir/focaliser l'app sur l'onglet Rapport). **Aucun `fetch`.** → vérif : enregistré, et une notification de test s'affiche.
2. Clés **VAPID** : paire générée une fois ; publique dans le front, privée en secret GitHub + secret Supabase.
3. `supabase/functions/tvlite-api/index.ts` : routes `/push/subscribe` (enregistrer un abonnement) et `/push/send` (protégée par secret, envoie à tous les abonnements) + table des abonnements → vérif : un abonnement se crée, un envoi manuel arrive sur l'iPhone.
4. `App.tsx` : entrée « Activer les notifications » dans le ⋯, demande de permission, abonnement, envoi au serveur ; à l'ouverture du rapport → `clearAppBadge()` + fermeture des notifications restantes.
5. `.github/workflows/rapport.yml` : après `Publier`, appeler `/push/send` avec la date du signal → vérif : le prochain cycle mensuel déclenche bien une notification.

## Notes / risques
- **Rien ne se vérifie en émulation** : Web Push iOS ne fonctionne que sur l'appareil réel, app installée. Prévoir un envoi de test manuel plutôt que d'attendre la fin du mois.
- Le comportement exact de la pastille d'icône sur iOS (posée par la notification elle-même vs par `setAppBadge`) est à **constater sur l'appareil** — les deux mécanismes coexistent, l'un pourrait suffire.
- Un abonnement peut expirer : traiter le code `410 Gone` à l'envoi en supprimant l'abonnement mort, sinon la table se remplit d'abonnements fantômes.
- Ne pas envoyer le contenu du signal dans la charge utile au-delà de la date : la notification est visible sur l'écran verrouillé.
