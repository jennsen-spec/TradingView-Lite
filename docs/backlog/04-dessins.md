# #4 — Dessins : socle + outil Trait (ligne de tendance)

**Statut** : ✅ Fait · **Points** : 13 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : ⭐

> **Note sprint (1er jet)** : livré sans le **texte** (onglet Texte + rendu du label pivoté le long du trait) — reporté en finition, à faire juste après validation du socle. Ajout hors-spec validé en cours de sprint : **fenêtre Options déplaçable** (glisser par l'en-tête). Fichiers : `lib/drawings.ts`, `components/{DrawingLayer,DrawingToolbar,DrawingContextBar,DrawingOptions,VisibilityEditor}.tsx`, câblage dans `Chart.tsx`/`App.tsx`, styles dans `styles.css`.

## Objectif
Poser le **socle des dessins** (barre d'outils, modèle ancré aux données, rendu, sélection/drag,
barre contextuelle, dialogue d'options, persistance) et livrer le **1ᵉʳ outil : le Trait**
(ligne de tendance) façon TradingView. Les autres outils (#32 vertical, #33 flèche, #34 canal,
#35 stabilo) réutiliseront ce socle.

## Critères d'acceptation

**Socle**
- [ ] Barre de dessins **horizontale, à droite de « ＋ Indicateurs »**, **responsive** : affiche tous les outils, et **repli en dropdown** (overflow) si la place manque ; contient au moins **Curseur** (crosshair, défaut) + **Trait**.
- [ ] Curseur (défaut) = mode sélection, aucun dessin.
- [ ] Dessins **ancrés temps+prix** → suivent pan/zoom. Persistance **par symbole** (`tvlike:drawings:<symbol>`). Visibles sur **tous les intervalles** (filtrés par l'onglet Visibilité).
- [ ] Sélection par **clic** (hit-test), poignées visibles ; **drag** du segment entier **ou** d'une extrémité.
- [ ] **Sélection multiple** : **Cmd/Ctrl-clic** ajoute à la sélection ; **déplacement groupé** ; la **corbeille de la barre contextuelle supprime tous les dessins sélectionnés** d'un coup.
- [ ] **Clic droit** sur un dessin → barre contextuelle.
- [ ] **Verrou** (empêche le déplacement), **Corbeille** (supprime le dessin / la sélection). *(Le « supprimer tous » = clic droit → #36.)*
- [ ] `mousedown` intercepté en capture pendant dessin/drag (pas de pan).

**Trait — tracé**
- [ ] **Clic** pour débuter, **clic** pour finir → segment (aperçu live entre les 2 clics).

**Trait — barre contextuelle** (raccourcis vers les options les plus utilisées)
- [ ] ✏️ **Couleur du trait** + opacité (palette).
- [ ] **T** Couleur du texte.
- [ ] **Épaisseur** 1 / 2 / 3 / 4 px.
- [ ] **Style** Droite / Traitillée / Pointillée.
- [ ] ⬡ **Options** → dialogue complet.
- [ ] 🔓 Verrou · 🗑️ Corbeille.
- [ ] **Exclus** : ⏰ Alarme, ••• (3 points), ⊞+ / « Espace » (modèles).

**Trait — dialogue Options** (onglets **Style / Texte / Coordonnées / Visibilité** ; Annuler / D'accord ; titre renommable)
- [ ] **Style** : couleur (+ opacité) ; **embout gauche & droit** chacun **Normal / Flèche** ; **Prolonger** (ne pas / gauche / droite). *Exclus : Point médian, Étiquettes de prix, bloc INFO (Stats…).*
- [ ] **Texte** : couleur, taille, **Gras**, *Italique* ; zone de texte multiligne ; alignement **vertical** (Haut/Milieu/Bas) + **horizontal** (Gauche/Centre/Droite). Le texte s'affiche **le long du trait**.
- [ ] **Coordonnées** : points **#1** et **#2** éditables **(prix, date)**.
- [ ] **Visibilité** : Ticks / Secondes / Minutes / Heures / Jours / Semaines / Mois / Ranges (case + min→max) — **réutilise le composant du #7**.

## Décisions
- Découpage : ce ticket = **socle + Trait**. Autres outils = tickets séparés (**#32** Trait vertical, **#33** Flèche, **#34** Canal, **#35** Stabilo).
- Barre de dessins **horizontale**, à droite d'« Indicateurs », **responsive** (overflow → dropdown).
- **Coordonnées en (prix, date)** — pas en index de barre (l'index change selon l'intervalle).
- **Sélection multiple** (Cmd/Ctrl-clic) + **déplacement groupé** ; la corbeille de la barre contextuelle agit sur **toute la sélection**.
- « Supprimer tous les dessins » **hors socle** → **clic droit (#36)** ; un dessin **verrouillé n'est pas supprimé** par la suppression groupée.
- Ancrage **temps+prix**, persistance **par symbole**, visible tous intervalles (piloté par l'onglet Visibilité).
- Barre contextuelle = **raccourcis** vers les options les plus utilisées ; ⬡ Options = éditeur complet (mêmes propriétés sous-jacentes).
- Embout **Flèche** géré ici → l'outil Flèche (#33) en découlera.
- **Exclus** : Alarme, •••, modèles/« Espace », Point médian, Étiquettes de prix, bloc INFO.

## Questions ouvertes
- *(aucune — tranchées en refinement.)*

## Plan technique
1. Barre de dessins (portail dans la toolbar, à droite d'Indicateurs) + état `activeTool` → vérif : Trait sélectionnable, Curseur par défaut.
2. Modèle `drawings: [{id, type:'trend', points:[{time,price}], style, text, visibility, locked}]` par symbole → vérif : persistance + reload fidèle.
3. Primitive de pane : rendu de tous les dessins (time/price → px via `timeScale`/`priceScale`), aperçu pendant le tracé → vérif : trait tracé, suit pan/zoom.
4. Interaction : 2 clics ; hit-test ; poignées ; drag extrémité/segment ; garde-fou `mousedown` capture → vérif : déplacement extrémités + segment entier.
5. Barre contextuelle (clic droit) + raccourcis (couleur/texte/épaisseur/style) + verrou + corbeille + « Tout effacer » → vérif : chaque raccourci modifie le trait en direct.
6. Dialogue Options 4 onglets (réutilise le pattern `IndicatorSettings` #7 ; onglet Visibilité réutilisé) → vérif : Style/Texte/Coordonnées/Visibilité appliquent + persistent ; Annuler restaure.
7. Rendu du **texte le long du trait** (rotation selon l'angle, alignements) → vérif : label positionné/aligné correctement.

## Notes / risques
- **Le plus gros ticket** de la série : il porte le socle. Hit-testing précis + drag + texte rotationné = principal risque.
- Réutilise les primitives existantes (bande RSI #5, mesure #27) et le composant Visibilité (#7).
- Cloisonner dessin vs pan/crosshair selon `activeTool` / sélection.
