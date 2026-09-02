# #87 — Molettes symbole & intervalle (épopée #70)

**Statut** : 🧪 À valider (sprinté le 02/09/2026) · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#86](86-graphique-mobile.md) ✅

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
- [x] Au repos, ticker et intervalle affichent la mini-molette (`EQ.SYNTH | MOM.SYNTH` · `4h | 1J | 1S`).
- [x] Un **glissement vertical** (> 8 px) ouvre la molette ; un **tap** sans déplacement ouvre la recherche (vérifié : les deux gestes se distinguent).
- [x] La carte s'affiche **centrée sur le graphique**, entrée centrale à 26 px opacité 1, voisines dégradées jusqu'à 15,5 px / 0,34.
- [x] Le défilement suit le doigt ; le graphique **ne recharge pas** pendant le geste (titre resté sur l'ancien symbole tout du long).
- [x] Au relâchement, le symbole centré est chargé (EQ.SYNTH → VMO.TO) ; sans déplacement, rien ne change.
- [x] Même molette sur l'**intervalle** (1J → 1S), alimentée par les favoris ; le chevron ouvre toujours le panneau complet.
- [x] `user-select`, `-webkit-touch-callout` et `touch-action: pan-x` posés sur la molette (la barre continue de défiler horizontalement) — **parasites iOS à confirmer sur l'appareil**.
- [x] Desktop : aucun changement (bouton ticker classique, rangée d'intervalles inline, aucune molette).
- [ ] UAT Jean sur iPhone.

## Réalisation (02/09/2026)
- `WheelPicker.tsx` (nouveau) : composant générique — mini-molette au repos + carte flottante en portail pendant le geste ; dégradé taille/opacité selon la distance au centre ; sélection **au relâchement** uniquement.
- `App.tsx` : molette du ticker alimentée par la collection courante (relue à chaque geste) ; un symbole hors collection est ajouté en tête pour que la molette démarre au bon endroit.
- `IntervalSelector.tsx` : molette sur les favoris en mobile ; rangée inline conservée sur desktop.
- `collections.ts` + `WatchlistPanel.tsx` : la collection courante est mémorisée (`tvlike:wl-current`, local à l'appareil, pas de synchro cloud) pour que la molette liste ce que Jean a sous les yeux. Effet de bord bienvenu : la collection choisie survit désormais au rechargement.
- **Défaut évité en cours de route** : l'état du geste vivait dans un état React, or `pointerdown` et `pointermove` peuvent tomber dans la même frame — le gestionnaire lisait alors un état périmé et ignorait le geste. Passé sur des références.

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
