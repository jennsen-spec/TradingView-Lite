# #59 — Rafraîchissement et rapport à 17 h

**Statut** : 🧪 À valider · **Points** : 2 · **Catégorie** : ⚙️ Technique · **Priorité** : —

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
