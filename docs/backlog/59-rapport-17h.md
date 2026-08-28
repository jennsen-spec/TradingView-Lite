# #59 — Rafraîchissement et rapport à 17 h

**Statut** : ✅ Fait · **Points** : 2 · **Catégorie** : ⚙️ Technique · **Priorité** : —

## Objectif
Avancer la chaîne de fin de mois de 18 h / 19 h 30 à **17 h / 17 h 30 heure de Toronto**, pour que
Jean ait le rapport en main plus tôt le soir du signal. Demandé le 26/08.

## Critères d'acceptation
- [ ] Le rafraîchissement des cours tourne à 17 h ET **toute l'année** — pas 18 h l'été et 17 h l'hiver.
- [ ] Le rapport est publié à 17 h 30 ET, également toute l'année.
- [ ] Une barre écrite trop tôt (donc incomplète) est **corrigée** au passage suivant.
- [ ] L'Action ne publie **jamais** un signal calculé sur des cours périmés.
- [ ] La chaîne complète produit le bon signal le 31 août 2026 — c'est l'UAT réelle.

## Décisions
- **Deux créneaux plutôt qu'un.** `pg_cron` ne connaît pas les fuseaux : un cron UTC fixe dérive
  d'une heure au changement d'heure. On lance à 21 h **et** 22 h UTC, et le travail n'est fait que
  si l'heure locale de Toronto vaut 17. C'était déjà un défaut avant ce ticket — le « 18 h »
  affiché dans le protocole était en réalité 18 h l'été et 17 h l'hiver.
- **Pas de garde d'heure côté GitHub Actions.** Les deux passages (21 h 30 et 22 h 30 UTC) tournent ;
  c'est le contrôle de fraîcheur qui écarte le trop précoce et le contrôle « signal inchangé » qui
  rend le second silencieux. Les crons GitHub sont souvent retardés de plusieurs dizaines de
  minutes : une garde stricte sur l'heure aurait sauté des passages.

## Plan technique
1. `backfill_ticker` : `on conflict do nothing` → `do update` limité à `bar_date >= current_date - 5`.
   → vérif : `backfill_ticker('XSP.TO', 1)` touche 3 lignes, le total de barres ne bouge pas. **Fait.**
2. Replanifier `rafraichissement-cours` en `0 21,22 * * 1-5` avec la garde d'heure locale.
   → vérif : `cron.job` porte bien la nouvelle commande. **Fait.**
3. `rapport.yml` : cron `30 21,22 …` + étape « Fraîcheur des données ».
   → vérif : l'étape lit la dernière barre en base et la compare à la date du jour. **Fait.**
4. Mettre le protocole à jour (section 07). **Fait.**

## Notes / risques
- **Pourquoi le correctif d'écriture était indispensable.** À deux heures de la clôture, une barre
  Yahoo incomplète restait théorique. À une heure, elle ne l'est plus — et `do nothing` la gelait
  pour toujours. C'est le seul changement de ce ticket qui touche les données.
- Le garde-fou de fraîcheur échoue un jour férié tombant en fin de mois : le passage de rattrapage
  du 1er s'en charge, avec un jour de retard. Préféré à la publication d'un signal faux.
- La tolérance de 4 jours de `calculerCycle` reste en place pour les fins de mois en week-end ;
  c'est elle que le garde-fou vient encadrer, pas remplacer.

## Répétition générale du 27/08 (UAT, demandée par Jean)

**Principe** : faire comme si le 27 août était le 31. À 17 h, après le rafraîchissement,
dérouler la chaîne complète — signal, rapport, cycle inscrit, libellés de la collection —
puis Jean consulte, annonce son action, elle est inscrite. À la fin, **tout est restauré**.

**Mécanisme** : `TVLITE_AUJOURDHUI=2026-08-31` (variable de test lue par `calculerCycle`,
jamais posée en production). Le 27 devient une fin de mois complète via la tolérance de
4 jours qui existe déjà pour les week-ends.

### Séquence (heure de Toronto)
1. **17 h 00** — le cron Supabase rafraîchit les cours (processus réel, rien de simulé).
2. **17 h 10** — vérifier la fraîcheur : barre du 27 présente sur les ~105 tickers et sur XSP.
3. `TVLITE_AUJOURDHUI=2026-08-31 npm run rapport -- --frais --enregistrer` (en local, pas de push).
4. `TVLITE_AUJOURDHUI=2026-08-31 npm run collection -- --frais` → libellés dans le cloud.
5. Publier le rapport en artifact « Rapport UAT » ; prévenir Jean, qui consulte le rapport
   ET la collection dans TVLite (recharger l'app pour voir les libellés).
6. Jean annonce son action → l'inscrire dans `execute` du cycle (etat.json).
7. **Rollback** (fin de l'exercice, sur l'accord de Jean).

### Ce que l'exercice touche, et comment on le défait
| Quoi | Où | Rollback |
|---|---|---|
| `etat.json` (cycle + execute) | git | `git restore --source=<sha-avant> -- portefeuille/etat.json` |
| `dernier-signal.txt` (→ 2026-08-27) | git | idem |
| `frontend/public/rapport.html` | git | idem |
| Libellés de la collection | cloud `tvlite_prefs` | POST de la sauvegarde `uat/collections-avant-uat.json` (prise le 27 à 12 h 26, 12 456 octets) |
| Cours Supabase | — | rien à défaire : le rafraîchissement de 17 h est le processus normal |

Sauvegardes déposées dans le scratchpad de session (`uat/`). Le sha-avant est le commit
qui précède la séquence de 17 h. **Aucun push pendant l'exercice.**

### Pièges connus
- **Cloud-clobber** : un TVLite ouvert pendant la restauration de la collection peut
  repousser l'état UAT par-dessus. Après le rollback, Jean recharge l'app.
- **L'Action GitHub d'origin tournera le 28 au soir** (le cron des 28-2 sur l'ancienne
  version, 19 h 30) : sans barre de fin de mois elle conclura « signal inchangé » et ne
  publiera rien. Inoffensif, mais attendu.
- Si `execute` est inscrit pendant l'UAT, le rollback l'efface aussi — c'est voulu,
  l'exercice entier est jetable.

### Journal de la répétition générale
- **27/08 17 h 00** : le nouveau créneau du refresh a tourné pile — 133/133 tickers (les 22
  CDR du jour compris). Barre du 27 partout, XSP inclus.
- **27/08 17 h 10** : rapport en date forgée — signal 2026-08-27, conformité moteur OK,
  interrupteur ON, cycle inscrit (poche 5 000 $, ligne 500 $, 10 achats). Collection : 12
  libellés poussés, CSCO.TO entré en réserve de lui-même. Rapport publié en artifact
  séparé avec bandeau « répétition générale » (c10c7466).
- **27/08 soir — décision de Jean** : il SUIT les 10 ordres tel quel. `execute` inscrit
  (quantités prescrites, prix = encan d'ouverture du 28, à remplir après la séance).
- **L'exercice s'étend au 28/08** : une journée = un mois. Demain 17 h : prix d'exécution
  réels inscrits, rapport du « mois suivant » (signal 2026-08-28 — conserver/vendre/acheter
  contre les 10 détenus), collection, et le **« Journal de mon investissement »** demandé
  par Jean : chaque ligne exécutée valorisée sur sa journée-mois, résultat en $ et %,
  total du portefeuille contre les 5 000 $. Le rollback reste global : l'exercice entier
  (jours 1 et 2) s'annule d'un bloc — git a034c6d + collection sauvegardée.
- **28/08 17 h 30 (jour 2)** : refresh de 17 h passé (barre du 28 partout). Prix
  d'exécution réels inscrits (10 ouvertures du 28, engagé 4 634,64 $, cash 365,36 $).
  Rapport du « mois suivant » : signal 2026-08-28, conformité OK, **les 10 lignes
  reconduites** — la collection passe tout le vert en bleu, zéro ordre à passer.
  « Journal de mon investissement » construit et injecté au rapport UAT (republié,
  même URL) : titres 4 518,32 $ + cash 365,36 $ = **4 883,68 $ (−2,33 %)** — une
  journée-mois rouge ordinaire, l'arrondi en actions entières visible (7,3 % du
  capital en liquidités). Verdict de Jean attendu, puis rollback global.
- **28/08 17 h 50** : **UAT VALIDÉE par Jean.** Rollback déroulé et vérifié : les trois
  fichiers restaurés depuis a034c6d (cycles vide, signal 2026-07-31), collection cloud
  reposée à l'octet près depuis la sauvegarde (10 verts + 10 orange de juillet). Le
  rapport UAT reste publié comme témoin, bandeau « exercice clos ». Ticket ✅.
