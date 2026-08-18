# #30 — Thème clair / sombre

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : 🎨 Cosmetic · **Priorité** : ⭐

> **Sprint (fait)** — `styles.css` refactoré en **variables CSS** (`:root` sombre = actuel · `:root[data-theme="light"]` ≈ TradingView) ; tous les neutres tokenisés (bg/surface/border/text/grid/accent), sémantiques (bougies vert/rouge, indicateurs) **inchangés**. Graphe thémé via `chart.applyOptions` (fond/texte/grille/bordures/séparateurs) sur un effet `[theme]`. Bouton unique dans le cluster haut-droite : **☀** en sombre (→ clair) / **☽** en clair (→ sombre), caractères monochromes. Persistance `tvlike:theme` + pré-réglage `data-theme` dans `index.html` (**pas de flash**). Vérifié : bascule clair/sombre (UI + graphe), reload en clair sans flash, retour sombre.

## Objectif
Basculer entre thème **sombre** (défaut) et **clair** via un bouton unique, en refactorant les
couleurs en variables CSS (UI + graphe) et en persistant le choix.

## Critères d'acceptation
- [x] **Bouton unique** de thème dans le cluster haut-droite (à droite du refresh #26).
- [x] L'icône reflète l'action à venir : en **sombre** → **soleil** (clic = passer clair) ; en **clair** → **quart de lune** (clic = passer sombre).
- [x] Icônes = **caractère Unicode monochrome (style texte), pas emoji couleur** (soleil `☀` U+2600, quart de lune `☽` U+263D) — ou SVG inline.
- [x] Toute l'UI (barre, modales, panneaux, légendes) est thémée via **variables CSS** ; rien d'illisible dans l'un ou l'autre thème.
- [x] Le **graphe** suit le thème : fond, grille, texte des axes, crosshair. **Bougies inchangées** (vert/rouge dans les deux).
- [x] Couleurs des **indicateurs inchangées** (SMA/RSI…).
- [x] Thème **sombre = défaut** ; choix **persistant** (localStorage), restauré au rechargement **sans flash**.
- [x] Thème **clair ≈ palette TradingView** ; thème **sombre = palette actuelle** de l'app.

## Décisions
- **Un seul bouton** togglant ; icône = action à venir (sombre → `☀`, clair → `☽`).
- Icônes en **caractère Unicode monochrome** (pas emoji), soleil U+2600 / quart de lune U+263D, éventuellement SVG.
- **Sombre = défaut**, dérivé des couleurs **actuelles**. **Clair ≈ TradingView**.
- Bougies et couleurs d'indicateurs **inchangées** entre thèmes (ajuster seulement si illisible — non prévu).
- Placement à droite du bouton refresh (#26) → **réutilise le cluster haut-droite** (dépendance #26).

## Palette de référence (à figer au sprint)
| Token | Sombre (= actuel) | Clair (≈ TradingView) |
|---|---|---|
| Fond | actuel | `#ffffff` |
| Surfaces / panneaux | actuel | `#f8f9fd` |
| Grille | actuel | `#e0e3eb` |
| Texte | actuel | `#131722` |
| Texte atténué | actuel | `#787b86` |
| Bougie hausse / baisse | `#26a69a` / `#ef5350` | idem |

## Questions ouvertes
- Valeurs exactes du thème clair à figer au sprint (partir de la palette ci-dessus).
- Teintes du crosshair / price line en clair : à ajuster pour contraste (détail sprint).

## Plan technique
1. Extraire les couleurs en dur de `styles.css` → variables CSS sur `:root` (sombre = actuel) + bloc thème clair (`:root[data-theme="light"]`) → vérif : UI sombre identique à aujourd'hui.
2. Définir la palette claire (≈ TradingView) sur les mêmes tokens → vérif : bascule cohérente, rien d'illisible.
3. Couleurs du graphe pilotées par thème (`layout.background`, `textColor`, `grid`, `crosshair`) mises à jour à la bascule via `applyOptions` → vérif : le graphe suit le thème.
4. Bouton unique dans le cluster haut-droite ; icône selon thème (`☀` en sombre / `☽` en clair), caractère Unicode monochrome ou SVG → vérif : icône correcte + bascule.
5. Persistance localStorage (défaut sombre), `data-theme` appliqué **tôt** au chargement → vérif : reload conserve le thème, **pas de flash**.

## Notes / risques
- Refactor transverse de `styles.css` : risque de rater des couleurs codées en dur → passe de revue nécessaire.
- Flash of wrong theme si `data-theme` appliqué trop tard → l'appliquer avant le premier paint.
- Dépendance de placement avec **#26** (cluster haut-droite).
