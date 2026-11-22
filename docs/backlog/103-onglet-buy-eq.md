# #103 — Onglet BUY EQ : investir et rebalancer en un seul écran

**Statut** : ✅ Fait (UAT validée par Jean le 22/11/2026) · **Points** : 5 · **Catégorie** : 💼 Portefeuille · **Taille** : M · **Priorité** : —

## Objectif
Un écran **BUY EQ** où je saisis **l'état de mon portefeuille** (parts détenues de chaque ETF) et
**mes liquidités**, et qui me dit, titre par titre, **acheter N / vendre N / conserver** pour
revenir à la cible 60/10/30 en investissant ces liquidités, en tenant compte du cours de chaque titre.

Un seul formulaire couvre les deux usages :
- **Investir sans me prendre la tête** : parts à 0, liquidités = mon montant → combien acheter de chaque ETF.
- **Rebalancer seulement** : mes parts, liquidités à 0 → quoi vendre / acheter.
- **Les deux** : mes parts + mes liquidités → rebalancer proprement en investissant le cash.

Remplace le calcul fait à la main avant chaque passage d'ordres.

## Critères d'acceptation
**Accès**
- [x] Mobile : un **4e onglet « BUY EQ »** dans la barre du bas.
- [x] Desktop : un bouton **« BUY EQ »** à côté de « Rapport » en haut à droite ouvre le même écran
      (volet par-dessus le graphe, fermeture par ✕ ou Échap). Le reste du desktop est inchangé.

**Saisie** (un seul formulaire, pas de modes)
- [x] Un champ **parts détenues** par ETF (5 champs, entiers ≥ 0, vides = 0).
- [x] Un champ **liquidités** (CAD, clavier numérique).
- [x] Un **interrupteur « Achats seulement »** (style réglages iPhone), **désactivé par défaut**.
- [x] Le calcul se met à jour pendant la saisie et au basculement de l'interrupteur.

**Interrupteur**
- [x] **Activé** : aucune vente. Le cash est placé une part à la fois dans le titre le plus en
      retard sur sa cible, tant qu'une part passe. Si des titres restent hors bande faute de cash,
      l'écran le dit : « Pour revenir dans la cible, désactive Achats seulement ».
- [x] **Activé, liquidités à 0** : « Rien à acheter sans liquidités. Désactive Achats seulement
      pour rebalancer en vendant. »
- [x] **Désactivé** : rebalancement complet vers la cible, ventes comprises.

**Résultat**
- [x] Tableau par titre : parts · valeur · **% actuel** · **% cible** · écart (points) ·
      **action** (Acheter N / Vendre N / Conserver) · coût ou produit · parts après.
- [x] Récapitulatif : valeur totale (titres + liquidités), **cash dégagé par les ventes**,
      **cash utilisé par les achats**, **liquidités restantes** (jamais négatives) et leur %.
- [x] Pour chaque titre : **« il manque X $ pour une part de plus »**.
- [x] **Message « écart dérisoire »** quand, avant opérations, aucun titre ne sort de sa bande de
      tolérance (règle ci-dessous) et que les liquidités sont nulles : on affiche quand même le
      rebalancement, avec la mention « Écart dérisoire : rebalancer est facultatif ».
- [x] Les titres hors bande sont mis en évidence.
- [x] Parts toutes à 0 → le tableau se lit comme un simple plan d'achat (aucune vente possible).

**Commun**
- [x] Le **cours affiché est horodaté** et signalé comme une estimation (les ordres passent à
      l'ouverture suivante, cf. `portefeuille/README.md`).
- [x] Tout à 0, vide ou non numérique → pas de calcul, pas d'erreur.
- [x] Cours indisponible → pas de calcul (on ne peut pas valoriser le portefeuille) et l'écran dit
      lequel manque.
- [x] **Rien n'est mémorisé** : recharger l'app vide les champs ; sur desktop, fermer le volet aussi.
      En mobile, changer d'onglet **conserve** la saisie (comme le graphe et la watchlist).
- [x] Vérifié sur iPhone réel et sur desktop (UAT Jean), sur les trois usages, avec un recalcul à
      la main sur un cas.

## Décisions
*(tranchées avec Jean au raffinement, 06/10 puis 22/11/2026)*
- **Un seul écran, une seule saisie** (parts + liquidités) : pas de bascule entre « investir » et
  « rebalancer ». Ces deux usages sont les cas particuliers parts = 0 et liquidités = 0.
- **Pondération = la cible 60/10/30 du [#76](76-portefeuille-synthetique.md)** :
  `ZEQT 24 · VMO 24 · HXS 12 · ZAG 10 · ZGLD 30` (60 % actions, 10 % obligations, 30 % or).
  **Pas `portefeuille.json`** (poids dérivés des avoirs, faux), **pas** `etat.json.repartition_apports`.
- **Ventes au choix, via l'interrupteur « Achats seulement »** (22/11), **désactivé par
  défaut** (choix de Jean) : par défaut, rebalancement complet, ventes comprises.
- **Bande de tolérance = règle « 5/25 »** : un titre est hors bande si son écart dépasse
  **le plus petit de 5 points ou 25 % de sa cible**, soit ZEQT/VMO ±5 pts · HXS ±3 pts ·
  ZAG ±2,5 pts · ZGLD ±5 pts. Le rebalancement reste toujours proposé.
- **Sans mémoire** : rien n'est stocké, pas même en local. Mémoriser REER / CELI / CELIAP
  séparément serait confus ; on préfère ressaisir.
- **Indépendant du compte** : pour un compte, Jean saisit les parts et les liquidités de ce compte
  (il est alors ramené au 60/10/30) ; pour le global, les totaux.
- **Arrondi au plancher** des parts cibles, **puis le reste est réinvesti** une part à la fois
  dans le titre le plus loin sous sa cible, tant qu'une part passe (22/11, après l'UAT : 250 $
  n'en investissaient que 110 $). On ne dépense jamais plus que ce qu'on a.
- **Pas de frais** (commission 0 chez Disnat). **Le duo n'apparaît pas** (poche ETF seule).
- **Pas de sélecteur de portefeuille** en v1 : il viendra avec [#93](../../ROADMAP.md).

## Questions ouvertes
- *(aucune)* — l'interrupteur a tranché la question des ventes. Le reliquat : en mode
  « Achats seulement » il est réinjecté part par part ; en rebalancement complet il reste en
  liquidités (plancher strict).

## Plan technique
1. `frontend/src/lib/buyEq.ts` (nouveau) — cible en dur + **une fonction pure**
   `rebalancer(parts, liquidites, cours, achatsSeulement) → lignes[] + total + horsBande`.
   Complet : total = Σ parts×cours + liquidités ; cible_i = ⌊total × w_i / cours_i⌋ ; action = cible − parts.
   Achats seulement : boucle gloutonne, +1 part au titre dont la valeur est la plus loin sous sa
   cible (rapportée au total), tant que le cash couvre une part.
   → vérif : tests sur le cas 1 000 $ du 06/10 avec parts à 0 (10 ZEQT · 2 VMO · 1 HXS · 7 ZAG ·
   4 ZGLD, 105,08 $ non investis), un portefeuille déjà à la cible sans cash (tout « Conserver »,
   message affiché), un cas avec vente (interrupteur désactivé), le même cas interrupteur activé
   (zéro vente), un cas parts + cash, liquidités restantes ≥ 0 dans tous les cas.
2. `frontend/src/components/BuyEqPanel.tsx` (nouveau) — champs + tableau + récapitulatif ;
   cours via `fetchQuotes()` de `lib/api.ts` (un seul appel pour les 5) → vérif : 1 requête réseau.
3. `App.tsx` — `mobileTab` étendu à `"buyeq"`, 4e bouton, volet monté en lazy (pattern [#89](89-onglet-rapport-mobile.md)) ;
   desktop : bouton à côté de `rapport-btn` qui ouvre le volet → vérif : bascule sans perdre l'état du graphe.
4. `styles.css` — volet mobile plein écran, champs ≥ 44 px, `font-size: 16px` (pas de zoom au focus),
   volet desktop en surimpression → vérif : émulation 375×812, desktop, puis iPhone réel.

## Sprint (22/11/2026)
- `frontend/src/lib/buyEq.ts` — `rebalancer()` pure ; 6 tests (node:test, hors dépôt : pas de
  runner dans le frontend) : plan d'achat 1 000 $ au plancher, achats seulement sans vente,
  portefeuille à la cible, surpondération en or (vente en complet, aucune en achats seulement),
  parts + cash, rien saisi.
- `frontend/src/components/BuyEqPanel.tsx` — formulaire, interrupteur, cartes par titre (plus
  lisible qu'un tableau à 7 colonnes sur 375 px), récapitulatif, bouton ↻ pour rafraîchir les cours.
- `App.tsx` — onglet mobile `buyeq` (monté à la 1re ouverture) ; bouton desktop + volet
  en surimpression (✕, Échap, clic sur le voile). `styles.css` — section BUY EQ.
- Vérifié en navigateur (22/11, cours de 14 h 34) : desktop + émulation 375×812, 1 seule requête
  de cours (2 en dev à cause du StrictMode), champs à 16 px, pas de défilement horizontal.
  Cas parts + 1 000 $ : total 8 499,50 $ recalculé à la main ; messages « dérisoire »,
  « rien à acheter » et « saisie invalide » affichés comme prévu.
- **Retour d'UAT (22/11)** : 250 $ n'investissaient que 110,80 $ (plancher sur 5 lignes :
  VMO et HXS à 0 part). **Corrigé** : le reste est réinvesti part par part aussi en
  rebalancement complet → 2 ZEQT · 1 VMO · 0 HXS · 1 ZAG · 2 ZGLD, soit **244,06 $ investis, 5,94 $ restants**
  (test ajouté, vérifié en navigateur). Libellé « Pas d'achat » au lieu de « Conserver » pour un
  titre non détenu.
- **Retour d'UAT n° 2 (22/11)** : en « Achats seulement », avec seul ZGLD sous sa cible, le reste
  du cash (moins d'une part de ZGLD) partait dans ZEQT, déjà surpondéré. **Corrigé** : un achat ne
  va qu'à un titre **encore sous sa cible** (les deux modes) ; ce qui ne suffit pas pour une part
  reste en liquidités. Ex. : seul ZGLD à −6 pts, 300 $ → 5 ZGLD, 28,60 $ restants (avant : + 2 ZAG).
- **Retouche après clôture (22/11, demande de Jean)** : les **% s'affichent sur les titres seuls**,
  sans le cash. % avant = répartition actuelle (comme Disnat, « — » si aucun titre) ; % après =
  une fois le cash dissous. Écart et bande se lisent sur le % avant. Les **ordres ne changent pas**
  (la cible reste appliquée à titres + cash). Effet : acheter ZGLD fait baisser la part des autres
  (ex. ZEQT 26,1 % → 25,4 %), ce qui colle à « dissoudre le cash dans le portefeuille ».
- Reste possible en rebalancement complet : vendre quelques parts d'un titre pourtant dans sa
  bande (le message « dérisoire » le signale quand tout est dans la bande).

## Notes / risques
- **4 onglets sur iPhone** serrent la barre du bas : libellé court « BUY EQ » à vérifier au sprint.
- Saisir les 5 parts à chaque fois est le prix du « sans mémoire » (décision assumée).
- **Deux règles coexistent dans le dépôt** : cet écran (cible du #76) et
  `etat.json.repartition_apports` (`duo 30 · ZEQT 40 · HXS 15 · VMO 15`). À réconcilier dans un
  ticket dédié, hors périmètre ici.
- Le mode B repoussé au raffinement du 06/10 (faute de parts fiables) est débloqué par la saisie
  manuelle. Il reprend l'idée du [#68](../../ROADMAP.md), abandonné faute de poids cible.
