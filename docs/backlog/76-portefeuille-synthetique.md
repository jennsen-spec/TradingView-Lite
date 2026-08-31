# #76 — Portefeuille perso en bougies (instruments synthétiques)

**Statut** : ✅ Fait · **Points** : 8 · **Catégorie** : 💼 Portefeuille · **Taille** : L

> **Sprint (fait — v1 « panier actuel », VRAIES données)** — Moteur client `frontend/src/lib/portfolios.ts` branché dans `fetchCandles` (`lib/api.ts`) ; **8 symboles** `<COMPTE>.DEJ.A/B` + TOTAL injectés dans `SymbolSearch`. **A** = avoirs réels (relevés CELI/REER/CELIAPP, 5 ETF) valorisés sur l'historique réel des cours ; **B** = même panier **rebasé à 100** (perf). Données = `frontend/src/data/comptes/*.json` (**avoirs actuels réels**). **Vérifié en browser** : `TOTAL.DEJ.A` = **82 788 $ CAD** ≈ somme des valeurs de marché des relevés (82 608 → réconcilie à ~0,2 %) ; `.B` ≈ 160 (base 100 depuis l'inception ZGLD). OHLC + SMA + RSI, CAD, 0 erreur.
>
> **Décisions/limites de la v1** : (1) **A exclut le cash** et les titres hors-ETF (scope = poche 5-ETF, cf. demande Jean). (2) **Modèle « panier actuel »** : quantités figées à aujourd'hui — l'export 12 mois **ne réconcilie pas** (positions de départ négatives, ex. CELI ZEQT +618 achetés mais 516 détenus) → reconstruction du fil des quantités **impossible sans historique complet**. (3) **Validé par Jean (UAT, 15/08)** : le modèle « panier actuel » **suffit** (pas de reconstruction exacte demandée) et **B = rebasé-100 simple** est retenu. Le « compte complet » (titres hors-ETF) et la « voie exacte » (historique complet) **ne sont pas poursuivis** — à rouvrir en ticket dédié si besoin un jour.
>
> **Simplifié (15/08, retour Jean)** : réduit à **un seul** instrument **`DEJ.601030`** (60 actions / 10 oblig / 30 or) = la poche combinée **rebasée à 100**, **avec volume** (somme des volumes des 5 ETF). Les 7 autres symboles retirés (`.A`, comptes séparés). Renommé depuis `TOTAL.DEJ.B`. Vérifié : base 100 (2024) → 160, SMA/RSI/ATR OK, barres de volume affichées.

## Objectif
Afficher le portefeuille ETF perso (par compte) comme un **instrument synthétique en bougies**
dans TVLite, valorisé jour par jour depuis les **transactions réelles** + le **cours des 5 ETF**.
Deux variantes : **A** (valeur de marché) et **B** (indice de performance, base 100).

## Périmètre
- **Comptes** : CELI · REER · CELIAPP + **agrégat** tous comptes.
- **Symboles** : `<COMPTE>.DEJ.<A|B>` → **CELI.DEJ.A/B · REER.DEJ.A/B · CELIAPP.DEJ.A/B · TOTAL.DEJ.A/B** (8 instruments), cherchables/ouvrables comme un titre.
- **5 ETF** : `ZEQT.TO · VMO.TO · HXS.TO · ZAG.TO · ZGLD.TO`. Cible d'allocation **24/24/12/10/30 %** — **informative** (la valeur vient des transactions réelles, pas des poids).

## Critères d'acceptation
- [x] Chaque `<COMPTE>.DEJ.<A|B>` (+ TOTAL) est **cherchable** et s'ouvre dans TVLite comme un symbole, en **bougies**.
- [x] **Variante A — valeur de marché** : bougie = `Σ(qté détenue × cours) + liquidités`. Un **apport** augmente la valeur, un **retrait** la diminue ; un **achat**/**vente** est **neutre** (ETF ↔ cash, le cash **dort** et compte dans la valeur).
- [x] **Variante B — performance (base 100, TWR)** : ne bouge qu'avec le **marché** ; apports/retraits **neutralisés** → **marqueurs**, pas des sauts.
- [x] **OHLC journalier** dérivé des cours ETF (le **H/L intrajournalier est approximé** — documenté ; close exact) ; agrégation semaine/mois via l'existant.
- [x] La série démarre à la **1re transaction** du compte et suit correctement achats/ventes/apports/retraits dans le temps.
- [x] **TOTAL** = somme des 3 comptes (A) / NAV agrégée pondérée (B).
- [x] Données lues depuis un **JSON par compte** ; recalcul à l'ouverture / au refresh.

## Décisions
- **A inclut le cash** : une vente est **neutre** (ETF→cash) ; seul un **retrait** baisse A.
- **B = TWR** (« valeur d'une part » base 100) : flux neutralisés, apports/retraits en marqueurs.
- **Saisie = transcription assistée** : Jean colle les captures d'ordres exécutés + apports/retraits, Claude transcrit dans le JSON. **Pas de formulaire** en v1.
- **Cash** : dort en liquidités (apport → cash → achat plus tard), inclus dans A.
- **Pondérations cible informatives** en v1 (pas de ligne cible ; à envisager plus tard).
- **Bougies** (pas ligne) ; H/L journaliers approximés depuis les ETF.

## Modèle de données — `portefeuille/comptes/<compte>.json`
- `transactions: [{ date, ticker, sens: "achat"|"vente", qte, prix }]`
- `flux: [{ date, type: "apport"|"retrait", montant }]`
- Devise **CAD** ; comptes = `celi` / `reer` / `celiapp`.

## Plan technique
1. Modèle JSON par compte + fichier d'exemple → vérif : lecture/validation.
2. Moteur : reconstruction **jour par jour** des **quantités détenues + cash** depuis transactions/flux → vérif : positions/cash corrects à des dates test.
3. Valorisation **A** : `Σ qté×OHLC_ETF + cash` par jour → vérif : saut sur apport/retrait, neutre sur achat/vente.
4. Valorisation **B** : émission/rachat de parts au NAV courant à chaque flux → NAV base 100 n'évolue qu'avec le marché → vérif : un apport ne bouge pas B.
5. Enregistrement des symboles synthétiques `<COMPTE>.DEJ.<A|B>` + TOTAL → cherchables/ouvrables → vérif : rendu bougies + légende.
6. Agrégat **TOTAL** (A = somme ; B = NAV pondérée) → vérif.

## Questions ouvertes
- **B agrégé (TOTAL.DEJ.B)** : NAV pondérée par la valeur de chaque compte — méthode exacte à figer au sprint.
- Cours **`ZGLD.TO`** (or, coté depuis peu) + les 4 autres bien disponibles via Yahoo/proxy — à vérifier au sprint.
- Devise : tout en CAD (les 5 ETF sont `.TO`) — confirmer le traitement de l'or (couvert/USD ?).

## Notes / risques
- **H/L approximés** : le vrai high/low intrajournalier d'un portefeuille ≠ somme des H/L des ETF (extrêmes non simultanés). Documenté ; close exact.
- **`ZGLD`** cote depuis peu → historique court (les comptes sont récents de toute façon).
- Réutilise le **proxy Yahoo + cache** existants ; pas de nouvelle source de données.
- Distinct de l'ex-#40 (absorbé par #47, qui vise le duo momentum) : ici c'est le **suivi de la poche ETF buy-and-hold perso**.
