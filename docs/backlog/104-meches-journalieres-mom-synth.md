# #104 — Mèches journalières sur MOM.SYNTH

**Statut** : 🔍 Affiné (2026-10-09) · **Points** : 3 · **Catégorie** : 💼 Portefeuille · **Taille** : S

## Objectif
En journalier, les bougies de MOM.SYNTH n'ont pas de mèches : la courbe est construite sur les seules
clôtures (plus-haut et plus-bas = bornes du corps, sur les 5 670 points). On y ajoute les **plus-hauts et
plus-bas de séance du panier**, sur tout l'historique et sur les séances à venir.

## Critères d'acceptation
- [ ] En 1j, les bougies de MOM.SYNTH ont des mèches de 2004 à aujourd'hui, **mois en cours compris**.
- [ ] Plus-haut d'un jour = **moyenne, sur les titres détenus, de plus-haut ÷ cours d'entrée**, ramenée en base 100 avec la même correction de frais que la clôture ; idem plus-bas. → vérif : recalcul à la main d'une date de l'historique et d'une date du mois en cours.
- [ ] **Ouvertures et clôtures identiques** au point près avant/après ; ouverture = clôture de la veille conservée. → vérif : diff de `duo-mom.json` sur `open` et `close`.
- [ ] Pour chaque point : plus-haut ≥ max(ouverture, clôture) et plus-bas ≤ min(ouverture, clôture).
- [ ] Les mois **en liquidités** restent plats, sans mèche.
- [ ] Multiple, pire baisse de la fiche détail, moyennes mobiles et RSI inchangés.
- [ ] L'exporteur affiche les **plus grosses mèches produites** (date, amplitude, titre responsable) ; aucune mèche aberrante ne reste à l'écran sans avoir été regardée.
- [ ] EQ.SYNTH et les titres réels sont inchangés.

## Décisions
- **Ouverture = clôture de la veille**, inchangée (Jean, 2026-10-09). On n'ajoute que les mèches ; pas d'écarts d'ouverture.
- **Borne, pas mesure** : les titres ne font pas leur plus-haut au même instant, donc la moyenne des plus-hauts surestime le vrai plus-haut du panier. Même convention qu'EQ.SYNTH. Faute de données intrajournalières, on l'accepte et on le dit dans la fiche détail.
- **Hebdo et au-delà** : l'agrégation prend désormais les vrais extrêmes journaliers, les mèches s'allongent un peu. Assumé.
- **L'ATR monte** : il mesure l'amplitude des séances, jusqu'ici sous-estimée. Assumé.
- **Aucun changement de workflow** : l'Action mensuelle relance le même exporteur ; le frontend valorise chaque nouvelle séance.

## Questions ouvertes
- **Cotations aberrantes** : sur 528 000 barres du cache depuis 2004, 42 ont une mèche de plus de 30 % et 49 sont incohérentes (plus-haut sous la clôture). Une seule dans un panier de 10 lignes = 3 % de mèche sur la courbe. Plafonner (par titre, à combien ?) ou laisser tel quel : à trancher au sprint, liste des plus grosses mèches à l'appui.

## Plan technique
1. **Exporteur** (`labo/src/exporter-duo-mom.ts`) : `pathAt` généralisé aux colonnes `haut` et `bas` de `Serie` ; plus-haut = `startE × pathHaut(d) × corr`, borné par le corps ; liquidités inchangées. → vérif : critères « ouvertures et clôtures identiques » et « bornes ».
2. **Contrôle des extrêmes** : l'exporteur imprime les 10 plus grosses mèches et le titre qui les cause. → vérif : chaque ligne regardée, décision sur le plafond.
3. **Frontend** (`duoTail` dans `lib/portfolios.ts`) : même calcul sur les plus-hauts et plus-bas Yahoo du panier, déjà récupérés par `api.ts`. → vérif : recalcul à la main d'un jour du mois en cours.
4. **Fiche détail** : mention « mèches = borne haute / basse du panier » dans `syntheticDetail`.
5. **Régénérer** `duo-mom.json` (`npm run duo:export`), puis contrôle visuel en 1j, 1sem, 1mois et à la jointure historique ↔ mois en cours.

## Notes / risques
- **Panier périmé** : tant que le retard d'un mois de `basketCourant` n'est pas corrigé (constat du 05/10, hors ticket), les mèches du mois qui suit un signal sont celles de l'ancien panier — comme le cours et le volume aujourd'hui.
- **Titre sans barre un jour donné** : il est ignoré ce jour-là, comme pour la clôture ; plus-haut et plus-bas doivent porter sur les **mêmes titres** que la clôture, sinon la bougie devient incohérente.
- **Jointure** : historique = base du labo, mois en cours = Yahoo. Écart de 1 à 5 % constaté sur le volume au #102 ; à regarder aussi sur les mèches.
- **Automatisation** : ne dire « les mèches survivent au rapport mensuel » qu'après un run GitHub réel.
- Le #82 (analyse technique sur MOM.SYNTH) en bénéficie : stops et ATR deviennent exploitables.
