# #46 — Refonte visuelle (Phase D)

**Statut** : 🏗️ En cours · **Points** : 8 · **Catégorie** : 🎨 Cosmetic · **Taille** : L · **Priorité** : —

## Objectif
Rendre l'app plus « chaleureuse » façon TradingView (même fond, mais sections séparées + radius + typo légère) et livrer les demandes concrètes : volet watchlist redimensionnable + colonnes adaptatives (ticker prioritaire), titre d'onglet live, logo/favicon.

## Découpage
**Partie A (d'abord)** — demandes concrètes :
- [ ] **Logo + favicon** = design #10 (2 bougies + loupe).
- [ ] **Titre d'onglet live** : `SYM prix ▲/▼ ±x,xx%` (symbole courant), mis à jour en direct.
- [ ] **Volet watchlist redimensionnable** (poignée sur le bord, largeur mémorisée, min/max).
- [ ] **Colonnes adaptatives** : si le volet est trop étroit → colonnes masquées automatiquement ; **le ticker prime** (jamais réduit à 1–2 lettres).

**Partie B (ensuite)** — passe « chaleur » :
- [ ] **Radius** (10–12px) sur volet, cartes, menus, dialogues, barres d'outils.
- [ ] **Surfaces en couches** + filets fins (hairline) : sections séparées, moins d'aplat lourd.
- [ ] **Ombres douces** sur les éléments flottants (menus/dialogues).
- [ ] **Typo** : poids 400/500 uniquement, letter-spacing des labels, tailles harmonisées, plus d'air.
- [ ] Micro-transitions hover/sélection subtiles.

## Décisions
- **Logo = #10** *(choix Jean)*.
- **Ordre A puis B** *(reco validée)* : livrer/valider A, puis la passe visuelle B.
- **Colonnes adaptatives** : seuils de largeur → on révèle Dernier puis Volume quand le volet s'élargit ; en dessous, ticker seul (+ Chg%).

## Questions ouvertes
- Largeur par défaut / min / max du volet (proposition : 300 défaut, 240 min, 520 max).
- Seuils d'apparition des colonnes (proposition : Dernier ≥ 340px, Volume ≥ 400px).
- Passe B : ampleur (tout l'app d'un coup vs volet+dialogues d'abord).

## Plan technique
1. **Favicon** — `frontend/public/favicon.svg` (#10, tuile arrondie lisible en 16px) + `<link rel="icon">` dans `index.html` (respecter le `base` Vite). → vérif : icône dans l'onglet.
2. **Titre onglet** — effet dans `App.tsx` : `document.title = ...` à partir du symbole courant + dernière variation (bougies déjà chargées ou `/quotes`). → vérif : l'onglet affiche `HXS 109,28 ▼ −1,05%`.
3. **Volet redimensionnable** — poignée + drag sur `.wl-panel`, largeur en state (persistée `tvlike:wl-width`, sync cloud), variable CSS `--wl-w`. → vérif : drag fluide, mémorisé.
4. **Colonnes adaptatives** — `ResizeObserver` (ou largeur connue) → colonnes effectives selon seuils ; le ticker garde min-width. → vérif : rétrécir masque les colonnes, ticker intact.
5. **Passe B** — variables radius/surfaces/ombres dans `styles.css`, appliquées volet/cartes/menus/dialogues/toolbars ; ajustement typo. → vérif : rendu clair + sombre, plus aéré.
6. **Déploiement** — push ; vérif en ligne (A d'abord, puis B).

## Notes / risques
- Passe B = large surface CSS → avancer par zones (volet, dialogues, toolbars) et vérifier les 2 thèmes à chaque fois.
- Le `base` Vite (`/TradingView-Lite/`) impacte le chemin du favicon.
- **Lié** : clôt l'épopée Watchlist v2 (#43/#44/#45) côté finition + polish global.
