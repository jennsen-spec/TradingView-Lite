# #76 — Réordonner les collections (menu + accès rapide)

**Statut** : 🔍 Affiné · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : S

## Objectif
Choisir l'ordre des collections. L'ordre choisi est **le** seul ordre : il s'applique au menu
déroulant (« Collections ») et aux pastilles d'accès rapide, qui le suivent d'elles-mêmes —
`favorites = collections.filter(favorite)` dérive déjà de l'ordre du tableau, une seule source
de vérité, deux affichages.

## User story
Dans le menu déroulant, je **glisse-dépose** une ligne de collection pour la déplacer ;
en fermant le menu, les pastilles favorites reflètent le nouvel ordre.

## Critères d'acceptation
- [ ] Glisser-déposer d'une ligne dans le menu des collections (même geste que pour les
      symboles/sections, déjà en place dans le panneau : `onDragStart`/`onDropItem`).
- [ ] Les pastilles favorites suivent l'ordre sans réglage séparé (un favori déplacé en tête
      devient la première pastille).
- [ ] La collection affichée reste la même après un déplacement.
- [ ] L'ordre survit au rechargement **et** à la synchronisation cloud multi-appareils.
- [ ] Aucune autre donnée des collections n'est touchée (symboles, sections, drapeaux, favoris).

## Décisions
- **Pas de drag des pastilles rondes en v1** (tranché par Jean le 31/08) : elles sont petites,
  le geste est malcommode, le menu fait le travail.

## Point de vigilance technique
La clé `tvlike:collections` passe par la **fusion cloud** (#48) : vérifier que la fusion préserve
l'ordre choisi et ne « re-trie » pas au merge entre deux appareils (scénario : A réordonne et
pousse ; B, resté sur l'ancien ordre, recharge — voire a modifié une collection entre-temps).
*Audit QA lancé le 31/08 — conclusions à reporter ici avant le sprint.*

## Plan technique
1. Poignée de drag sur les lignes `wl-menu-coll` + réordonnancement du tableau `collections`
   (splice par id, comme les items). → vérif : l'ordre du menu change et persiste.
2. Rien à faire pour les pastilles (dérivées). → vérif : l'ordre des ronds suit.
3. Selon l'audit fusion : adapter la fusion cloud si elle ne préserve pas l'ordre.
   → vérif : reproduire le scénario A/B (deux onglets ou set cloud + reload) sans perte d'ordre.
