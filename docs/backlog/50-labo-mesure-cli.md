# #50 — Labo de mesure (CLI)

**Statut** : 🧪 À valider (UAT) · **Points** : 13 · **Catégorie** : 💼 Portefeuille · **Taille** : XL
Épopée : [#47](47-epopee-un-seul-produit.md) · Prérequis : #49 · Suivi de : #51

## Objectif
Un moteur de mesure en TypeScript, lancé en ligne de commande, qui prend un **jeu de règles nommé et versionné**
et rend son verdict honnête. C'est l'outil qui permet à Jean de **refaire lui-même** l'analyse technique au lieu de
croire des chiffres qu'il n'a pas produits.

## Le moteur de règles — trois emplacements
Un jeu de règles se déclare dans un fichier versionné, avec les **trois emplacements** de [#47](47-epopee-un-seul-produit.md) :
`TRIER` (classement transversal) · `FILTRER` (oui/non par titre) · `INTERRUPTEUR` (on joue ce mois-ci, oui/non).
**Un critère mal placé donne le résultat inverse** — c'est mesuré, pas théorique.

## Critères d'acceptation
- [x] `npm run labo -- <jeu-de-regles>` mesure un jeu de règles et écrit le résultat dans `research`.
- [x] Sortie par jeu de règles : nb de mois, **% du temps investi**, rendement mensuel moyen, croissance annualisée, volatilité, **pire baisse**, pire mois, **écart contre benchmark apparié** avec son *t*, et le **découpage sélection 2004-2015 / validation 2016-2026**.
- [x] **Le titre du résultat est l'écart contre benchmark apparié, jamais le rendement absolu** (le rendement absolu est biaisé par le survivant ; l'écart, non — il frappe numérateur et dénominateur).
- [x] **Chaque jeu de règles est mesuré sur les deux univers** : `research.swing` (106 titres, 22 ans, couvre 2008) et `market` pan-canadien (**505 titres à ≥ 5 ans**, mesuré le 21/08). Un **désaccord entre les deux est affiché comme tel**, pas moyenné.
- [x] **Cartouche de validation** : par défaut le labo n'affiche **que** 2004-2015. Voir la validation est un geste explicite, **journalisé et décompté** par jeu de règles (« 3 cartouches consommées »).
- [x] Un **compteur global de jeux testés** est affiché à chaque exécution (en testant 12 variantes, une gagnante apparaît par hasard).
- [x] Aucun **biais de look-ahead** : signal sur la clôture, **exécution à l'ouverture du lendemain**, vérifiable sur un cas tracé pas à pas.
- [x] Frais **0,35 % aller-retour** appliqués sur la **rotation réelle**.
- [x] Le protocole de référence (momentum 12-1, décile supérieur, mensuel) **reproduit les chiffres de Cowork à la marge d'erreur près** — sinon on cherche pourquoi avant d'aller plus loin.

## Décisions
- **TypeScript dans le dépôt, pas SQL.** Un langage, testable, versionné, pas de timeout à 60 s. Postgres reste une base.
- **Benchmark apparié** = rendement moyen de l'univers éligible sur la même fenêtre. Références absolues en plus : `XIU.TO` (TSX 60) et `XWD.TO` (MSCI World), tous deux déjà chargés.
- `mom_12_1 = close[t-21] / close[t-252] − 1`. **Le saut du dernier mois est intentionnel** (évite le retournement court terme) — ne pas simplifier en momentum 12 mois.
- Seuil de liquidité **500 k$/jour**, appliqué **identiquement au backtest et au scan**.

## Questions ouvertes
- Correction du *t* par **bootstrap par blocs** : nécessaire pour les règles à trades chevauchants. Le momentum mensuel produit 259 observations **non chevauchantes** — son *t* est le seul lisible tel quel. À implémenter pour les règles qui en ont besoin.

## Plan technique
1. Schéma `research.rule_sets` / `research.measurements` (jeu de règles versionné + résultats + compteur de cartouches). → vérif : deux exécutions du même jeu donnent la même ligne.
2. Chargement des barres + couche d'indicateurs depuis `research`/`market`. → vérif : recalcul d'un indicateur = valeur de `ta_ca_daily`.
3. Moteur trier/filtrer/interrupteur + boucle de rebalancement mensuel. → vérif : le protocole de référence reproduit Cowork.
4. Métriques + benchmark apparié + découpage + garde-fou de cartouche. → vérif : la validation est invisible sans geste explicite.
5. Sortie console lisible + écriture dans `research`. → vérif : #51 peut lire la table sans retraitement.

## Notes / risques
- **Modèle : Fable.** Une erreur de méthode statistique ne lève pas d'exception — elle produit un joli tableau. C'est le ticket où le choix du modèle compte le plus.

## Résultat du sprint — 21 août 2026

**Construit** : `labo/` en TypeScript natif (zéro dépendance), `npm run labo -- <jeu>`.
Options : `--valider` (consomme une cartouche journalisée) · `--verifier` · `--comparer-cowork` ·
`--trace <date>` · `--univers research|market` · `--sans-db` · `--sans-cache`.
Côté base : schéma `research` **additif** (`rule_sets`, `measurements`, `validation_log` + 3 RPC).
Base passée de 334,3 à 334,7 Mo. `tvlite_prefs` et `bars` inchangés.

**Vérifié par moi, pas seulement déclaré** :
- réplication **259/259 mois identiques** (< 1e-6) au protocole SQL sur données actuelles ;
- **55/55 valeurs d'indicateurs** identiques à `ta_ca_daily` ;
- la **période de validation est bien masquée** par défaut, la cartouche est décomptée.

**Le résultat qui compte, et il refroidit** : sur la **période de sélection seule** (2004-2015),
l'écart contre benchmark apparié est de **+1,05 pt/mois net, t = 1,68** sur l'univers research —
**pas significatif**. Le *t* de 3,63 du brief est un *t* **global** (les deux périodes réunies),
ce qui est justement la mesure que le découpage sert à ne pas croire. Pire baisse **−53,5 %**,
donc le critère « < 40 % » de #52 n'est pas atteint sans interrupteur.

**Écart avec le brief expliqué** : Yahoo réajuste tout l'historique à chaque dividende — seuls
**75 mois sur 259** sont restés identiques entre la photo de Cowork et aujourd'hui. La méthode
se reproduit exactement ; les décimales bougent avec le millésime des données. D'où les fixtures figées.

**Réserves relevées par le labo lui-même** (à traiter en #52) :
- l'univers `market` **avant 2016 est à jeter** (médiane 13 titres éligibles, min 2) ;
- `market` ignore les dividendes → les deux univers ne sont **pas strictement comparables** ;
- le benchmark apparié **contient le décile lui-même** (dilue l'écart — sens conservateur) ;
- un titre **sans barre au mois suivant sort silencieusement** du calcul : un radié ne coûte rien
  au backtest alors qu'il coûterait au portefeuille — le biais du survivant en action ;
- le critère « ≥ 260 barres » du ticket **ne correspond pas** à l'analyse d'origine (~253 en pratique) ;
- trou de données au 2026-07-31 (26 barres sur 106) → le dernier rebalancement est fragile ;
- la cartouche est **procédurale, pas cryptographique** : elle compte les regards, elle ne les empêche pas.

**Une cartouche (n° 1) a été consommée** pour la recette du mécanisme — journalisée dans `research.validation_log`.
