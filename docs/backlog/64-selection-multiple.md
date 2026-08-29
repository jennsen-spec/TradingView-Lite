# #64 — Sélection multiple : tout sélectionner, couper/coller, édition groupée

**Statut** : 🏗️ En cours · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Compléter la sélection multiple existante (Ctrl/Cmd+clic, copier/coller décalé) :
tout sélectionner, couper, coller en place, et modifier d'un coup les paramètres
communs d'une sélection. User stories validées par Jean le 29/08.

## Critères d'acceptation
**US-1 — Tout sélectionner**
- [ ] Clic droit sur un dessin → « Sélectionner tous les dessins » ; la sélection un à
      un (Ctrl/Cmd+clic) reste.
- [ ] Ctrl/Cmd+A quand le graphique a le focus.

**US-2 — Couper**
- [ ] « Couper » (menu + Ctrl/Cmd+X) : la sélection disparaît du graphique et va au
      presse-papier.

**US-3 — Coller au bon endroit**
- [ ] Coller après COUPER : positions d'origine exactes (temps/prix), sélection posée
      sur les dessins collés.
- [ ] Coller après COPIER : décalage actuel (~26 px) conservé, pour distinguer le
      duplicata.
- [ ] Le presse-papier est limité au symbole d'origine (décision du 29/08) : coller sur
      un autre symbole ne fait rien (message discret).
- [ ] Test d'acceptation de bout en bout (avec #63) : tout sélectionner → couper →
      restaurer un ensemble → coller → tout est là, aux bonnes places.

**US-4 — Paramètres communs en groupe**
- [ ] Sélection multiple → le panneau de réglages montre l'intersection des paramètres
      partagés par les types sélectionnés (couleur, épaisseur, style de trait en tête) ;
      une modification s'applique à toute la sélection.
- [ ] Les paramètres propres à un type (texte, niveaux d'une position…) n'apparaissent
      qu'en sélection homogène de ce type.

## Décisions
- Presse-papier **limité au symbole** (Jean, 29/08).
- Couper/coller est le mécanisme d'« ajout » à la restauration d'un ensemble (#63).

## Plan technique
1. `clipboardRef` gagne `{ symbole, coupe: boolean }` ; « couper » = copie profonde +
   suppression + marqueur. → vérif : Ctrl+X fait disparaître, le presse-papier est plein.
2. Coller : si `coupe` → recréation aux coordonnées d'origine (nouveaux ids), sinon
   décalage existant ; refus silencieux si symbole ≠ origine. → vérif : couper/coller
   = positions identiques au pixel ; copier/coller = décalé.
3. « Sélectionner tout » au menu contextuel + Ctrl/Cmd+A (dessins du symbole courant,
   dessins système inclus dans la sélection mais voir #63 pour les ensembles).
   → vérif : compte de sélection = compte de dessins.
4. Édition groupée : le panneau de réglages accepte une sélection ; propriétés
   communes par intersection des types (matrice type→propriétés) ; application en lot,
   une seule écriture localStorage + sync. → vérif : 3 dessins hétérogènes → couleur
   commune modifiable ; 2 flèches → tous leurs réglages.

## Notes / risques
- La divergence (paire flèche+miroir) se sélectionne déjà par paire : le couper/coller
  doit garder la paire cohérente.
- Ctrl/Cmd+A ne doit pas voler la sélection de texte quand un champ de saisie a le focus.
