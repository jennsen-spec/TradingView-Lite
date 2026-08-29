# #60 — Inventaire mensuel de l'univers

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : ⚙️ Technique · **Priorité** : —

## Objectif
L'univers doit grandir avec la bourse. Aujourd'hui le rafraîchissement quotidien ne fait
que remettre à jour les tickers déjà connus : une nouvelle inscription (IPO, nouveau CDR)
n'entre jamais toute seule. Comparer chaque mois la liste réelle des titres cotés
(secteurs industrie + techno) à notre base, et signaler les manquants. Demandé par Jean
le 27/08. (Reprend l'étape 8 de #58, jamais faite.)

## Critères d'acceptation
- [x] Une commande `npm run inventaire` liste les titres industrie/techno cotés **en CAD**
      au TSX, au TSXV **et chez Cboe Canada (`.NE`, CDR compris)** absents de la base, et
      les titres de la base qui ne cotent plus.
- [x] Le rapport mensuel affiche une alerte quand l'inventaire trouve des manquants.
- [x] Ajouter un manquant = une commande simple (backfill d'un ticker), pas une migration.
- [x] Aucun retrait automatique : un ticker radié est signalé, jamais supprimé.
- [x] La politique CDR est tranchée et documentée au protocole (voir questions).

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
  conclusion « rien à élargir ». Sprint démarré sur décision de Jean (#60, #61, #62).
- 27/08 16 h 45 : **le CSV Cboe corrige la mesure de 16 h.** Le sondage `.NE` interrogeait
  le mauvais suffixe : 104 des 190 CDR ont migré au TSX et vivent en `.TO` chez Yahoo,
  très liquides (MU 99 M$/j, INTC 20, AVGO 14, PLTR 11, SMCI 11…). Resondage complet des
  88 CDR à dv ≥ 100 k$ : **14 ont ≥ 253 barres**, dont un seul techno nouveau — CSCO.TO
  (416 barres, 3 M$/j, éligible depuis ~janv. 2026). **Backtest élargi duo + CSCO.TO :
  ×52,87 identique, aucun mois modifié** — jamais retenu par le tri momentum. Les autres
  CDR techno/industrie (MU, INTC, AVGO, PLTR, SMCI, ORAC, AMAT, IBM, BA, CAT, DEER, GE,
  HON, UPS…) mûrissent : éligibles d'ici 12-18 mois. C'est EUX que la surveillance de
  maturation doit suivre — en `.TO`, pas en `.NE`. Le CSV Cboe
  (`cdn.cboe.com/ca/equities/mnow/symbol_listings.csv`) devient la source pressentie de
  l'inventaire : tout le marché canadien consolidé, bourse (mic), devise, classe d'actif
  et volume moyen inclus — le pré-filtre de liquidité est gratuit, avant tout appel Yahoo.
  Question posée à Jean : ajouter dès maintenant les CDR techno/industrie liquides à la
  base (ils mûriraient DANS le système et entreraient d'eux-mêmes via les filtres), ou
  attendre l'alerte de maturation.
- 27/08 16 h 45 : le backtest publié — « L'élargissement CDR » (artifact 12d89168).
- 27/08 16 h 35 : **décision de Jean : ajouter les CDR mûrissants tout de suite.** Les 22
  CDR techno/industrie (dv ≥ 300 k$) sont backfillés dans la base (comptes identiques à la
  sonde locale, base à 97 Mo/500, 133 tickers), inscrits dans `bars_coverage` (max_range 6y)
  et au seed des secteurs. Vérifié : l'univers du labo passe à 102 séries (CSCO entre, les
  21 immatures attendent leurs 253 barres), signal et ordres inchangés, conformité
  moteur ↔ rapport OK. Le refresh de 17 h les adopte (last_refresh null = priorité).
  Protocole (section 01, périmètre CDR + note de révision) et document « L'élargissement
  CDR » (décision + vérification) republiés. **Reste à faire** : dividendes des CDR non
  couverts par la table `dividends` (à alimenter quand un CDR approche l'éligibilité —
  IBM/TXN/QCOM paient), et la commande `npm run inventaire` elle-même.
  Détail du verdict : CSCO réellement éligible 2 mois (juin-juillet 2026), classé 28ᵉ/69
  puis 22ᵉ/68, momentum +73 % quand le 10ᵉ retenu est à +118 % — jamais proche d'entrer.
  Le document porte aussi le calendrier de maturation des 21 CDR suivis (Micron 99 M$/j,
  mesurable vers 2026-10 ; Intel, Broadcom, Palantir… échelonnés jusqu'en 2027).

## Procédure d'ajout d'un manquant (validée le 27/08 sur les 22 CDR)
1. `select public.backfill_ticker('X.TO', 6);` (SQL, le serveur va chercher chez Yahoo)
2. `insert into bars_coverage (ticker, interval, max_range, currency, name, fetched_at)
   values ('X.TO','1d','6y','CAD','NOM', now());`
3. Ajouter le ticker à `labo/data/secteurs-seed.json` (secteur + industrie), committer.
4. S'il paie des dividendes : les charger dans la table `dividends`.
Le rafraîchissement quotidien adopte le ticker de lui-même (jamais rafraîchi = priorité).

## Journal du sprint (fin)
- 28/08 soir : `labo/src/inventaire.ts` construit (`npm run inventaire`). Source : CSV
  officiel Cboe (tout le marché canadien consolidé, mic → .TO/.V/.NE, CDR inclus via le
  nom). Classification : seed + cache d'abord, Yahoo par lots limités (`--max-yahoo`,
  défaut 40) — la file converge sans marteler l'API (455 → 415 inconnus au 1er lot).
  Maturation : comptage des barres des titres duo < 253 (les 21 CDR, datés). Radiés :
  signalés, jamais supprimés. Écrit `labo/.cache/inventaire.json` ; `page.ts` affiche un
  encart d'alerte si manquants (testé) et date l'inventaire au pied du rapport ; le
  workflow lance l'inventaire avant le rapport (non bloquant).
- **Trouvailles du premier passage réel** : 3 titres du duo cotés et absents de la base —
  ABXX.TO (Technology, 5,2 M$/j, 491 barres), AMT.V (Technology, 1,2 M$/j), ACT.TO
  (Industrials, 0,7 M$/j, 444 barres). ABXX et ACT ont > 253 barres (migrations de
  bourse, l'historique suit) : **éligibles dès leur ajout** → décision de Jean requise
  avant le signal du 31/08. Et 4 restes dans la base : AAPL + QQQ (cotations américaines
  historiques, rafraîchies quotidiennement pour rien) et AMZN.NE + TSLA.NE (CDR
  d'avant-migration) — signalés, à purger seulement sur décision.
- 28/08 soir : **ABXX.TO, ACT.TO et AMT.V ajoutés à la base** (décision de Jean) — les
  trois ont ≥ 253 barres (les historiques ont suivi les migrations de bourse), donc tous
  immédiatement éligibles. Effet mesuré : **top 10 du signal courant inchangé** (aucun des
  trois n'approche le classement — hors du top 10 de leur secteur), mais le **grand livre
  bouge de 702 188 → 699 606 $ (−0,37 %)** : ils ont été retenus dans des mois récents du
  backtest (638 positions contre 636). Conséquence prévue par le plan : les artefacts
  chiffrés doivent être régénérés (en cours). Le seed des secteurs porte les trois.
- 28/08 tard : **régénération complète des artefacts** sur l'univers courant (96 titres —
  +ABXX/ACT/AMT/CSCO, −AAPL/QQQ purgés) : protocole v4 (×52,7 · −28,0 %), Protéger le
  momentum canadien, les deux comparatifs d'interrupteur, le grand livre (699 606 $), le
  Journal des transactions et Les douze mois — ces deux derniers étaient restés à
  l'ANCIENNE règle (554 017 $), ils passent d'un coup à la règle courante. Poids
  dérivants re-mesurés : écart +0,00 pt/an, pire baisse −31,0 %. Benchmark : +0,76
  (t=2,90) / +0,71 (t=1,56). Générateurs des documents : scratchpad de session
  (gl-data.ts, tx-gen.ts, saison-gen.ts, mensuel-payload.ts, momentum-payload.ts,
  jour-sous-payload.ts) — à verser au dépôt un jour si on veut les rejouer hors session.

**UAT validée par Jean le 29/08/2026** → ✅ Fait.
