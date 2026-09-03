# #92 — Notification iOS à la publication du rapport

**Statut** : ✅ Fait (UAT Jean 02/09/2026 — « ça marche totalement ») · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : suite de [#90](90-pastille-nouveau-rapport.md)

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
- [x] Depuis l'app installée sur l'écran d'accueil, une entrée du menu **⋯** permet d'activer les notifications (iOS exige un geste explicite) ; l'état activé/refusé est lisible.
- [x] À la publication d'un nouveau signal, une notification arrive sur l'iPhone **app fermée**, titrée avec la date du signal.
- [x] La taper ouvre TVLite **sur l'onglet Rapport**.
- [x] Après consultation : bannière fermée, pastille d'icône effacée, pastille interne éteinte.
- [x] **Une seule notification par publication** — pas une par déploiement du site.
- [x] Un refus de permission (ou un navigateur sans support) laisse l'app pleinement fonctionnelle, pastille interne comprise.
- [x] Desktop : aucun changement.

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

## Réalisation (02/09/2026)
- `frontend/public/sw.js` : worker `push` + `notificationclick` **sans aucun `fetch`** — il n'intercepte rien, ne met rien en cache.
- `frontend/src/lib/push.ts` : enregistrement, permission, abonnement/désabonnement, et `eteindreNotifications()` (pastille d'icône + bannières restantes).
- `App.tsx` : entrée « 🔔 Activer les notifications » dans le ⋯ (avec les états *active* / *inactive* / *refusée*) ; extinction branchée sur `rapportVu()` ; message du worker → ouverture sur l'onglet Rapport.
- `supabase/functions/tvlite-push/` (**fonction séparée**, déployée v1) : `/subscribe`, `/unsubscribe`, `/send`. Table `public.tvlite_push_subs`, **RLS active sans policy** — seule la fonction (service_role) y accède, la clé publishable ne peut pas lire les abonnements.
- `.github/workflows/rapport.yml` : étape « Notifier les appareils » après `Publier`, conditionnée au changement de signal ; un échec d'envoi n'invalide pas une publication réussie.

### Décision de sprint : fonction Edge séparée
Les routes push devaient à l'origine rejoindre `tvlite-api`. Déployer cette fonction imposait de
retranscrire ses 495 lignes — celles qui servent **les graphiques, les cours et les préférences** —
avec un risque d'erreur pour un bénéfice nul. Une fonction dédiée annule ce risque : une panne des
notifications ne peut plus emporter l'app. Vérifié après déploiement : `/quotes` et `/prefs` intacts.

## Secrets (posés le 02/09)
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `PUSH_SEND_SECRET` sur Supabase (vérifiés par
empreinte SHA256, sans exposer les valeurs) ; `PUSH_SEND_SECRET` aussi en secret GitHub.

## Défauts trouvés à l'UAT — corrigés
- **Le bouton ⋯ était invisible** : il réutilisait la classe `theme-btn`, que j'avais moi-même masquée en mobile au #86 en y déplaçant le thème. Le bouton se cachait lui-même. → style propre, 36 px, épinglé à droite de la barre (il débordait aussi hors écran : 393 px pour 375). **Je suis retombé dans le piège documenté au #86** — un `.click()` programmatique réussit sur un élément `display:none` ; seule la détection de collision (`elementFromPoint`) prouve qu'un doigt l'atteint.
- **La notification n'ouvrait pas le Rapport app fermée** : sans fenêtre existante, le worker ouvre `?vue=rapport`, mais rien ne lisait ce paramètre au démarrage. → lecture au montage + nettoyage de l'URL.
- **Pas de pastille sur l'icône** : iOS ne la pose pas en affichant une bannière, il faut `setAppBadge()`. J'avais écrit l'effacement, jamais la pose. → posée à la réception dans le worker.
- *(Non-défaut)* La pastille interne de l'onglet Rapport ne s'allumait pas aux tests : normal, elle compare le signal publié au dernier consulté et aucun rapport n'était réellement republié.

## Reste à surveiller
Supprimer puis rajouter l'icône crée un **nouvel abonnement sans retirer l'ancien** (2 lignes au
02/09 → risque de notification en double). L'abonnement mort disparaîtra au premier `410 Gone`.

## Notes / risques
- **Rien ne se vérifie en émulation** : Web Push iOS ne fonctionne que sur l'appareil réel, app installée. Prévoir un envoi de test manuel plutôt que d'attendre la fin du mois.
- Le comportement exact de la pastille d'icône sur iOS (posée par la notification elle-même vs par `setAppBadge`) est à **constater sur l'appareil** — les deux mécanismes coexistent, l'un pourrait suffire.
- Un abonnement peut expirer : traiter le code `410 Gone` à l'envoi en supprimant l'abonnement mort, sinon la table se remplit d'abonnements fantômes.
- Ne pas envoyer le contenu du signal dans la charge utile au-delà de la date : la notification est visible sur l'écran verrouillé.
