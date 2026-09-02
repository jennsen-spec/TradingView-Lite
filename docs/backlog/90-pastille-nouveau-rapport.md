# #90 — Pastille « nouveau rapport »

**Statut** : ✅ Fait (UAT Jean 02/09/2026) · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité

## Objectif
Signaler dans l'app qu'un **nouveau rapport mensuel est publié** : une pastille sur l'onglet
Rapport, qui disparaît dès que Jean l'a consulté une fois.

## Critères d'acceptation
- [x] Quand le signal publié est plus récent que le dernier consulté, une **pastille** apparaît sur l'onglet Rapport (mobile) et sur le bouton Rapport (desktop).
- [x] Ouvrir le rapport **une fois** éteint la pastille, et elle ne revient pas au rechargement.
- [x] Elle réapparaît à la **publication suivante** (nouveau signal mensuel), pas à chaque déploiement du site.
- [x] Aucun téléchargement lourd : la détection ne charge pas les ~320 Ko du rapport.
- [x] Hors-ligne ou détection en échec → **pas de pastille** (jamais de faux positif), l'app fonctionne normalement.

## Décisions
- **Pastille dans l'app, pas de notification iOS.** Une vraie notification système exige un service
  worker + l'autorisation de notifications, soit exactement ce qu'on a écarté au [#88](88-pwa.md)
  (piège du cache). **Reporté à l'espace membre** ([#23](#)/[#24](#)) — décision de Jean le 02/09,
  à reprendre quand les comptes existeront.
- **Détection par la date de signal, pas par la date de fichier.** GitHub Pages redéploie à chaque
  commit : un `Last-Modified` ferait clignoter la pastille à chaque déploiement, alors que le
  rapport ne change qu'une fois par mois.
- Le générateur (`labo/src/page.ts`) écrit déjà `portefeuille/dernier-signal.txt` ; il déposera en
  plus un **`frontend/public/rapport-meta.json`** de quelques octets, servi par le même déploiement.
- Le « dernier consulté » est **local à l'appareil** (pas de synchro cloud) : chaque appareil a sa
  propre pastille, ce qui est le comportement attendu.

## Plan technique
1. `labo/src/page.ts` : écrire `frontend/public/rapport-meta.json` = `{ "signal": "<date du signal>" }` à côté du HTML → vérif : `npm run rapport` produit les deux fichiers.
2. `App.tsx` : au démarrage, `fetch` du méta (échec silencieux) ; comparer à `localStorage['tvlike:rapport-vu']` → état `rapportNeuf`.
3. Pastille sur l'onglet Rapport (mobile) et sur `.rapport-btn` (desktop) → vérif : visible aux deux ruptures.
4. À l'ouverture du rapport, écrire la date vue → vérif : la pastille s'éteint et ne revient pas au rechargement.

## Réalisation (02/09/2026)
- `labo/src/page.ts` : écrit `frontend/public/rapport-meta.json` = `{"signal":"2026-08-31"}` à côté du HTML.
- `App.tsx` : lecture au démarrage (`cache: no-store`), comparaison à `tvlike:rapport-vu`, extinction à l'ouverture (desktop **et** mobile).
- `styles.css` : point rouge de 8 px en coin du bouton/onglet Rapport.
- **Piège évité** : lancer `npm run rapport` en local a régénéré un rapport **dégradé** (inventaire du 29/08 au lieu du 01/09, section « premier cycle » perdue) — les données locales sont plus pauvres que celles de l'Action. Le HTML a été révoqué, seule la métadonnée est commitée. *À retenir : ne jamais committer un rapport régénéré à la main.*

## Notes / risques
- Le rapport publié aujourd'hui n'a pas encore de méta : prévoir le cas « méta absente » → pas de pastille (et non « rapport neuf »), sinon la pastille s'allumerait à tort jusqu'au prochain cycle mensuel.
- Le fichier méta doit être servi sous la base `/TradingView-Lite/` (même piège qu'au #88).
