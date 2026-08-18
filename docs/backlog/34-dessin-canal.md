# #34 — Dessins : Canal parallèle

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Outil **canal parallèle** : 2 droites parallèles (base + parallèle décalée), avec lignes
intermédiaires optionnelles et remplissage. Réutilise le **socle des dessins (#4)**.

## Critères d'acceptation

**Tracé & manipulation**
- [ ] **2 temps / 3 clics** : clic 1 = début base, clic 2 = fin base (**un côté**), clic 3 = **forme le canal** (parallèle décalée, même pente).
- [ ] Poignées aux extrémités + milieu → déplacer base, extrémités, largeur.
- [ ] Sélection, verrou, corbeille, **barre contextuelle** — socle #4.

**Options — Style**
- [ ] Liste de **lignes par niveau d'offset** : **0** et **1** = les 2 bords (**toujours affichés**, valeurs d'offset **éditables**) ; niveaux **optionnels** **-0.25 / 0.25 / 0.5 / 0.75 / 1.25** activables par **case**.
- [ ] Chaque ligne : **valeur d'offset** éditable + **couleur** + **style** (droite / traitillée / pointillée).
- [ ] **Prolonger** : dropdown à cases « Prolonger la ligne de gauche » / « … de droite ».
- [ ] **Arrière-Plan** : case + couleur/opacité — **remplissage** entre les lignes.

**Options — Texte**
- [ ] Couleur, taille, **Gras**, *Italique* ; zone de texte ; alignement **vertical** (Haut/Milieu/Bas) + **horizontal** (Gauche/Centre/Droite).

**Options — Coordonnées**
- [ ] **#1 (prix, date)** + **#2 (prix, date)** = les 2 points de la base.
- [ ] **Price offset** = décalage de prix définissant la parallèle.

**Options — Visibilité**
- [ ] **Bloc standard commun** à tous les dessins (Ticks/Secondes/…/Ranges, case + min→max) — composant #7.

## Décisions
- **3 clics** (2 base + parallèle au 3e). Bords **0 / 1** + niveaux d'offset optionnels.
- Style **enrichi** (multi-lignes d'offset + Arrière-Plan) vs Trait.
- Coordonnées = **2 points + Price offset**.
- **Visibilité = bloc standard commun** à tous les dessins (ne sera plus re-détaillé dans les tickets suivants).

## Questions ouvertes
- *(aucune — tranchées en refinement.)*

## Plan technique
1. Bouton Canal ; type `channel`, tracé 3 clics (base 2 pts + offset au 3e) → vérif : canal formé.
2. Modèle : base `[{time,price},{time,price}]` + `priceOffset` + config des lignes d'offset + background → vérif : parallèle correcte, suit le pan/zoom.
3. Rendu : 2 bords + lignes d'offset optionnelles + remplissage → vérif : niveaux cochés s'affichent.
4. Manipulation : poignées base / extrémités / largeur → vérif : drag met à jour l'offset.
5. Options Style (liste offsets + couleurs/styles + Prolonger + Arrière-Plan) · Texte · Coordonnées (+Price offset) · Visibilité → vérif : appliquent + persistent.

## Notes / risques
- Style **le plus riche** de la série (multi-lignes d'offset + fill).
- Dépend de **#4** (socle des dessins).
