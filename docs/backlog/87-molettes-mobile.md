# #87 — Molettes symbole & intervalle (épopée #70)

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#86](86-graphique-mobile.md) ✅

## Objectif
Changer de symbole (et d'intervalle) **sans quitter le graphique** : un glissement vertical sur
le ticker de la barre du bas fait apparaître une molette qui défile sous le doigt ; on relâche
sur l'entrée voulue. Comportement relevé sur la vidéo TradingView du 02/09.

## Comportement observé (vidéo de référence, 4,5 s)
1. **Au repos**, le ticker et l'intervalle de la barre du bas sont déjà des **mini-molettes** : entrée précédente estompée au-dessus, courante en taille normale, suivante estompée en dessous (`MSFT / GOOG / AMZN` · `4H / 1D / 1S`). C'est l'indice visuel du geste.
2. **Glissement vertical** sur le ticker → une **carte flottante apparaît centrée sur le graphique** (pas sous le doigt), listant les symboles de la collection en molette façon sélecteur iOS : l'entrée centrale est **grande, en gras, logo en couleur**, les voisines rapetissent et s'estompent progressivement (≈ 4 de chaque côté visibles).
3. Pendant le geste, la mini-molette de la barre suit en direct **et le graphique derrière ne change pas** (il reste sur GOOG tout du long).
4. **Au relâchement**, le graphique charge le symbole centré et la carte disparaît (BRK.B chargé).

## Critères d'acceptation
- [ ] Au repos, ticker et intervalle affichent la mini-molette (précédent estompé / courant / suivant estompé).
- [ ] Un **glissement vertical** (> ~8 px) sur le ticker ouvre la molette ; un **tap** sans déplacement garde le comportement actuel (ouvre la recherche).
- [ ] La carte s'affiche **centrée sur le graphique**, l'entrée centrale nette et grande, les voisines dégradées en taille et en opacité.
- [ ] Le défilement suit le doigt ; le graphique **ne recharge pas** pendant le geste.
- [ ] Au relâchement, le symbole centré est chargé ; sortir du geste sans bouger (retour à l'origine) ne change rien.
- [ ] Même molette sur l'**intervalle**, alimentée par les favoris d'intervalle.
- [ ] Aucun parasite iOS pendant l'appui (pas de sélection de texte ni de menu contextuel sur les deux boutons).
- [ ] Desktop : aucun changement.
- [ ] UAT Jean sur iPhone.

## Décisions
- **Geste = glissement, pas appui long.** La vidéo ne montre aucune attente : le tap (recherche) et le glissement (molette) se distinguent par le déplacement, ce qui évite le délai et le conflit avec la loupe iOS.
- **Un seul composant générique** (`WheelPicker`) : liste d'entrées + valeur courante + rappel de sélection. Le symbole et l'intervalle en sont deux usages — la mini-molette de la barre et la carte flottante partagent le même rendu dégradé.
- **Source des symboles** : la collection courante de la watchlist (même donnée que l'onglet Watchlist).
- Le chargement ne se déclenche **qu'au relâchement** (sinon on tirerait une requête par cran).

## Hors périmètre
- Contenu extensible du menu **⋯** (reste : recharger / thème / horodatage) — à cadrer quand Jean saura ce qu'il veut y mettre.
- Le défilement horizontal de la barre du bas : déjà livré en #86.

## Plan technique
1. `WheelPicker.tsx` : rendu molette (dégradé taille/opacité selon la distance au centre) + carte flottante centrée → vérif : rendu isolé aux deux tailles.
2. Gestion du geste (`pointerdown/move/up` + `setPointerCapture`, seuil de 8 px, `touch-action: none`, `user-select: none`) → vérif : tap = recherche, glissement = molette, pas de sélection iOS.
3. Branchement du ticker sur la collection courante ; sélection au relâchement → vérif : le graphique ne recharge qu'une fois, à la fin.
4. Reprise pour l'intervalle (favoris) → vérif : changement d'intervalle au relâchement.
5. Mini-molettes au repos dans la barre → vérif : voisins estompés, desktop intact.

## Notes / risques
- Le geste vit dans la barre du bas, hors du graphique : pas de conflit avec le pan/zoom de lightweight-charts.
- Attention au retour haptique/scroll de la barre : la barre du bas défile horizontalement (#86), la molette est verticale — les deux axes doivent cohabiter (`touch-action: pan-x` sur la barre, capture verticale sur le bouton).
- Images de référence extraites de la vidéo : `scratchpad/tv87/` (14 images, 3/s).
