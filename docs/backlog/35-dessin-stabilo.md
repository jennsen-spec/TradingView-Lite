# #35 — Dessins : Stabilo (surligneur à main levée)

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Outil **surligneur** à **main levée** : on dessine en glissant, rendu **pinceau épais semi-transparent**.
Paradigme de tracé **distinct** (freehand). Réutilise le socle #4 (barre contextuelle, sélection,
verrou, corbeille, persistance, Visibilité).

## Critères d'acceptation

**Tracé & manipulation**
- [ ] **Main levée** : appuyer + **glisser**, le trait **suit la souris** (polyligne échantillonnée + lissée).
- [ ] Rendu **pinceau épais semi-transparent** (opacité ~38 % par défaut).
- [ ] Après tracé : **poignées aux extrémités** pour déplacer.
- [ ] Sélection, verrou, corbeille, **barre contextuelle** — socle #4.

**Barre contextuelle** (spécifique)
- [ ] Couleur + opacité (palette).
- [ ] **Épaisseur du pinceau** (dropdown **8 / 12 / 20 / 32 / 48 / 64 / 80 / 96 px**).
- [ ] Options ⬡, verrou, corbeille. **Pas de « T » (texte) ni de style de ligne.**

**Options — dialogue à 2 onglets seulement (Style, Visibilité)**
- [ ] **Style** : **Droite** = couleur + **opacité** ; **Épaisseur** (8 → 96 px).
- [ ] **Visibilité** : **bloc standard commun** (composant #7).
- [ ] **Pas d'onglet Texte ni Coordonnées.**

## Décisions
- Tracé **freehand** (drag), **2 poignées** d'extrémités.
- Options **réduites** : Style (couleur/opacité + épaisseur) + Visibilité. **Pas de Texte ni Coordonnées.**
- Épaisseurs : **8/12/20/32/48/64/80/96 px** ; opacité par défaut **~38 %** (effet surligneur).
- Réutilise le socle #4 **sauf** la mécanique de tracé (freehand).

## Plan technique
1. Bouton Surligneur ; type `brush`, capture du drag → polyligne (échantillonnage + lissage) → vérif : le trait suit la souris.
2. Modèle : `points:[{time,price}…]` (polyligne ancrée) + style `{color, opacity, width}` → vérif : persistance + suit pan/zoom.
3. Rendu **pinceau épais semi-transparent** (canvas, extrémités arrondies) → vérif : effet surligneur.
4. Poignées d'extrémités + **hit-test de la polyligne** (bande épaisse) → vérif : sélection + déplacement.
5. Options 2 onglets (Style : couleur/opacité + épaisseur · Visibilité) → vérif : appliquent + persistent.

## Notes / risques
- **Freehand** : capture des points, **lissage**, **hit-test d'une polyligne**, coût mémoire/persistance (beaucoup de points → décimer/simplifier).
- Dépend de **#4** (socle), interaction de tracé **distincte**.
