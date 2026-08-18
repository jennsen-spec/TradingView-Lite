# #32 — Dessins : Trait vertical (ligne verticale)

**Statut** : ✅ Fait · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Outil **ligne verticale** : 1 clic pose une verticale **pleine hauteur** (traverse tous les panes)
à un temps donné. Réutilise le **socle des dessins (#4)**.

## Critères d'acceptation

**Tracé & manipulation**
- [ ] **1 clic** pose la ligne (un temps/bar) ; **drag horizontal** pour déplacer.
- [ ] Ligne **pleine hauteur**, traverse **tous les panes** (prix, volume, RSI).
- [ ] Sélection, verrou, corbeille, **barre contextuelle** — hérités du socle #4.

**Options — Style**
- [ ] Couleur + **style de ligne** (droite / traitillée / pointillée).
- [ ] **Prolonger** (case) — étend la ligne (au-delà de la zone des bougies / marges).
- [ ] **Étiquette horaire** (case) — affiche l'étiquette date/heure au bas de la ligne.
- [ ] *(Pas d'embouts, ni Point médian / Étiquettes de prix / bloc INFO.)*

**Options — Texte**
- [ ] Couleur, taille, **Gras**, *Italique* ; zone de texte multiligne.
- [ ] Alignement **vertical** (Haut/Milieu/Bas) + **horizontal** (Gauche/Centre/Droite).
- [ ] **Orientation du texte : Horizontal / Vertical** *(spécifique à la ligne verticale)*.

**Options — Coordonnées**
- [ ] **`#1`** : un seul point **(date)** éditable.

**Options — Visibilité**
- [ ] Ticks / Secondes / Minutes / Heures / Jours / Semaines / Mois / Ranges (case + min→max) — **composant #7**.

## Décisions
- **1 point d'ancrage** (temps/bar), **pleine hauteur tous panes**.
- Différences vs Trait : pas d'embouts ; Style = **Prolonger + Étiquette horaire** ; Texte ajoute **Orientation** (H/V) ; Coordonnées = **1 date**.
- Réutilise le socle #4 (barre contextuelle, sélection/drag, persistance, dialogue Options 4 onglets).

## Questions ouvertes
- *(aucune — tranchées en refinement.)*

## Plan technique
1. Bouton Ligne verticale dans la barre ; type `vline`, 1 point `{time}` → vérif : 1 clic pose la ligne.
2. Rendu **pleine hauteur** (traverse les panes) via primitive → vérif : ligne sur prix+volume+RSI, suit le pan/zoom horizontal.
3. Options : Style (couleur/style/Prolonger/Étiquette horaire) · Texte (+Orientation H/V) · Coordonnées (1 bar) · Visibilité → vérif : appliquent + persistent.
4. Drag horizontal + rendu de l'étiquette horaire (date au bas) → vérif : déplacement + label.

## Notes / risques
- **Rendu multi-panes** (pleine hauteur) : à valider avec l'API panes (comme le crosshair).
- Dépend de **#4** (socle des dessins).
