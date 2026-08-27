# #60 — Inventaire mensuel de l'univers

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : ⚙️ Technique · **Priorité** : —

## Objectif
L'univers doit grandir avec la bourse. Aujourd'hui le rafraîchissement quotidien ne fait
que remettre à jour les tickers déjà connus : une nouvelle inscription (IPO, nouveau CDR)
n'entre jamais toute seule. Comparer chaque mois la liste réelle des titres cotés
(secteurs industrie + techno) à notre base, et signaler les manquants. Demandé par Jean
le 27/08. (Reprend l'étape 8 de #58, jamais faite.)

## Critères d'acceptation
- [ ] Une commande `npm run inventaire` liste les titres industrie/techno cotés au
      TSX/TSXV absents de la base, et les titres de la base qui ne cotent plus.
- [ ] Le rapport mensuel affiche une alerte quand l'inventaire trouve des manquants.
- [ ] Ajouter un manquant = une commande simple (backfill d'un ticker), pas une migration.
- [ ] Aucun retrait automatique : un ticker radié est signalé, jamais supprimé.
- [ ] La politique CDR est tranchée et documentée au protocole (voir questions).

## Décisions
- Cadence mensuelle : le momentum 12-1 exige 253 séances, une IPO n'est éligible qu'un an
  après son entrée — l'inventaire mensuel ne rate rien d'urgent.
- La comparaison se fait par secteur APRÈS classification (seed + Yahoo), pas sur la bourse
  entière : inutile de suivre 3 000 tickers pour un univers de deux secteurs.

## Questions ouvertes
- **Source de la liste** : TMX publie l'inventaire officiel (fichiers quotidiens) ; le
  screener Yahoo est plus simple mais non exhaustif. À trancher à l'implémentation.
- **Les `.NE` (Cboe Canada)** : la base contient AMZN.NE et TSLA.NE mais le filtre
  d'univers ne garde que `.TO`/`.V` — un CDR techno coté seulement en `.NE` est invisible.
  Les CDR sont gardés dans le duo (mesure du 23/08 : ×50,5 contre ×40,7) ; il serait
  cohérent d'inclure les `.NE` des deux secteurs. Impact à mesurer avant de trancher.

## Plan technique
1. Commande `labo/src/inventaire.ts` : récupérer la liste des cotés, classifier
   (seed + Yahoo), comparer à `bars` → manquants / radiés. → vérif : sortie stable deux
   passages de suite.
2. Alerte dans le rapport (section réserves) quand manquants > 0. → vérif : injection
   d'un manquant factice.
3. Documenter l'ajout d'un ticker (backfill_ticker + secteur au seed). → vérif : ajout réel.
