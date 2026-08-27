# #60 — Inventaire mensuel de l'univers

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : ⚙️ Technique · **Priorité** : —

## Objectif
L'univers doit grandir avec la bourse. Aujourd'hui le rafraîchissement quotidien ne fait
que remettre à jour les tickers déjà connus : une nouvelle inscription (IPO, nouveau CDR)
n'entre jamais toute seule. Comparer chaque mois la liste réelle des titres cotés
(secteurs industrie + techno) à notre base, et signaler les manquants. Demandé par Jean
le 27/08. (Reprend l'étape 8 de #58, jamais faite.)

## Critères d'acceptation
- [ ] Une commande `npm run inventaire` liste les titres industrie/techno cotés **en CAD**
      au TSX, au TSXV **et chez Cboe Canada (`.NE`, CDR compris)** absents de la base, et
      les titres de la base qui ne cotent plus.
- [ ] Le rapport mensuel affiche une alerte quand l'inventaire trouve des manquants.
- [ ] Ajouter un manquant = une commande simple (backfill d'un ticker), pas une migration.
- [ ] Aucun retrait automatique : un ticker radié est signalé, jamais supprimé.
- [ ] La politique CDR est tranchée et documentée au protocole (voir questions).

## Décisions
- Cadence mensuelle : le momentum 12-1 exige 253 séances, une IPO n'est éligible qu'un an
  après son entrée — l'inventaire mensuel ne rate rien d'urgent.
- La comparaison se fait par secteur APRÈS classification (seed + Yahoo), pas sur la bourse
  entière : inutile de suivre 3 000 tickers pour un univers de deux secteurs.
- **Décision de Jean (27/08)** : tout ce qui est **en CAD et des secteurs visés** doit être
  détectable, `.NE` inclus. La détection n'implique pas l'éligibilité : élargir le filtre
  d'univers à `.NE` exige de **refaire les backtests** — si la mesure le justifie, on les
  refait et on identifie les artefacts à mettre à jour (voir plan, étape 4).

## Questions ouvertes
- **Source de la liste** : TMX publie l'inventaire officiel (fichiers quotidiens) ; Cboe
  Canada publie la liste de ses inscriptions (dont les ~60 CDR) ; le screener Yahoo est
  plus simple mais non exhaustif. À trancher à l'implémentation.
- **Éligibilité des `.NE`** : la détection est tranchée (décision du 27/08, ci-dessus) ;
  reste à décider, mesure en main, si le filtre d'univers s'élargit à `.NE`. Contexte :
  les CDR `.TO` sont déjà gardés dans le duo (mesure du 23/08 : ×50,5 contre ×40,7) ;
  les CDR n'existent que depuis 2021-2022, donc l'élargissement ne change les backtests
  que sur les dernières années.

## Plan technique
1. Commande `labo/src/inventaire.ts` : récupérer la liste des cotés, classifier
   (seed + Yahoo), comparer à `bars` → manquants / radiés. → vérif : sortie stable deux
   passages de suite.
2. Alerte dans le rapport (section réserves) quand manquants > 0. → vérif : injection
   d'un manquant factice.
3. Documenter l'ajout d'un ticker (backfill_ticker + secteur au seed). → vérif : ajout réel.
4. **Si l'éligibilité `.NE` est envisagée** : backtest de l'univers élargi (duo + CDR/`.NE`
   des deux secteurs) contre la référence, présenté à Jean. S'il élargit : refaire les
   backtests et **régénérer les artefacts chiffrés sur le duo** — protocole, « Protéger le
   momentum canadien », grand livre, journal des transactions, les deux comparatifs
   d'interrupteur, « Les douze mois du duo », rapport mensuel — chacun avec sa date de
   mesure. Les v1 archivées ne sont jamais retouchées. → vérif : liste cochée.
