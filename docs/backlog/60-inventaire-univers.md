# #60 — Inventaire mensuel de l'univers

**Statut** : 🏗️ En cours · **Points** : 5 · **Catégorie** : ⚙️ Technique · **Priorité** : —

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
- ~~Éligibilité des `.NE`~~ — **mesurée et refermée le 27/08** : le backtest d'élargissement
  demandé par Jean n'a rien trouvé à élargir. Les seuls `.NE` avec un historique réel
  (AAPL, MSFT, NVDA, AMD, ~1 100-1 200 barres) sont les jumeaux des `.TO` déjà dans
  l'univers — les ajouter compterait le même instrument deux fois. Les autres CDR
  techno/industrie sondés (CSCO, ORCL, IBM, AVGO, TXN, MU, PLTR, UBER, BA, CAT, GE, HON,
  UNP, UPS, DE, LMT, RTX, MMM…) n'ont que 1-2 barres exploitables chez Yahoo — cotés ou
  couverts depuis la mi-juillet 2026, quasi sans échanges ; SNOW/DELL/SQ/ARM absents.
  **Décision de Jean : on reste sur la stratégie actuelle.** L'inventaire surveillera la
  maturation de ces CDR (barres accumulées, volume) et la question rouvrira quand l'un
  d'eux approchera l'éligibilité (253 barres + dv50 ≥ 500 k$).

## Plan technique
1. Commande `labo/src/inventaire.ts` : récupérer la liste des cotés, classifier
   (seed + Yahoo), comparer à `bars` → manquants / radiés. → vérif : sortie stable deux
   passages de suite.
2. Alerte dans le rapport (section réserves) quand manquants > 0. → vérif : injection
   d'un manquant factice.
3. Documenter l'ajout d'un ticker (backfill_ticker + secteur au seed). → vérif : ajout réel.
4. L'inventaire suit les CDR `.NE` immatures : pour chacun, barres accumulées et volume
   médian ; alerte quand l'un approche l'éligibilité (253 barres + dv50 ≥ 500 k$) — c'est
   le déclencheur qui rouvrira la question de l'élargissement. Si elle rouvre et que Jean
   élargit : backtests refaits et artefacts chiffrés régénérés (protocole, « Protéger le
   momentum canadien », grand livre, journal des transactions, comparatifs d'interrupteur,
   « Les douze mois du duo », rapport mensuel) ; les v1 archivées jamais retouchées.
   → vérif : la sortie de la commande montre la maturation.

## Journal du sprint
- 27/08 16 h : sondage Yahoo des 37 candidats CDR/`.NE` (script local, base non touchée) —
  résultat ci-dessus, question d'éligibilité refermée. Sprint démarré sur décision de Jean
  (#60, #61, #62).
