# #64 — Sélection multiple : tout sélectionner, couper/coller, édition groupée

**Statut** : 🧪 À valider · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Compléter la sélection multiple existante (Ctrl/Cmd+clic, copier/coller décalé) :
tout sélectionner, couper, coller en place, et modifier d'un coup les paramètres
communs d'une sélection. User stories validées par Jean le 29/08.

## Critères d'acceptation
**US-1 — Tout sélectionner**
- [x] Clic droit sur un dessin → « Sélectionner tous les dessins » ; la sélection un à
      un (Ctrl/Cmd+clic) reste.
- [x] Ctrl/Cmd+A quand le graphique a le focus.

**US-2 — Couper**
- [x] « Couper » (menu + Ctrl/Cmd+X) : la sélection disparaît du graphique et va au
      presse-papier.

**US-3 — Coller au bon endroit**
- [x] Coller après COUPER : positions d'origine exactes (temps/prix), sélection posée
      sur les dessins collés.
- [x] Coller après COPIER : décalage actuel (~26 px) conservé, pour distinguer le
      duplicata.
- [x] Le presse-papier est limité au symbole d'origine (décision du 29/08) : coller sur
      un autre symbole ne fait rien (message discret).
- [x] Test d'acceptation de bout en bout (avec #63) : tout sélectionner → couper →
      restaurer un ensemble → coller → tout est là, aux bonnes places.

**US-4 — Paramètres communs en groupe**
- [x] Sélection multiple → le panneau de réglages montre l'intersection des paramètres
      partagés par les types sélectionnés (couleur, épaisseur, style de trait en tête) ;
      une modification s'applique à toute la sélection.
- [x] Les paramètres propres à un type (texte, niveaux d'une position…) n'apparaissent
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

## Journal du sprint
- 29/08 : implémenté. Presse-papier au niveau MODULE `{symbole, coupe, dessins}` (il
  survit au remontage du composant à chaque changement de symbole — sans quoi le
  garde-fou cross-symbole était muet) ; actions tout sélectionner / copier / couper /
  coller extraites et partagées entre raccourcis (Ctrl/Cmd+A·C·X·V) et menus. Clic
  droit sur un dessin → menu de sélection (Sélectionner tout, Couper, Copier, Coller,
  Supprimer) ; le menu du graphique gagne Sélectionner tout et Coller. Coller après un
  COUPER repose les dessins à leurs positions d'origine exactes (premier collage), puis
  cascade décalée ; coller hors symbole → toast discret. Barre contextuelle : sélection
  hétérogène → contrôles communs seuls (couleur/opacité/épaisseur/style), Options
  masqué ; l'application groupée existait déjà (styleSelected).
- Testé au preview sur les 9 dessins réels d'AAPL, scénario d'acceptation complet :
  Ctrl+A → Ctrl+X (0 dessin) → restaurer l'ensemble (#63) → Ctrl+V → **positions
  identiques aux originales** (vérifié point à point) ; copier/coller décalé (18→36,
  annulé) ; toast « Presse-papier de AAPL — coller est limité à son symbole » sur COST,
  rien collé ; barre mixte sans Options. État de Jean remis à l'identique (9 dessins),
  ensembles de test nettoyés. Deux bugs attrapés en route : réassignation d'une const
  (le presse-papier ne se remplissait pas) et le presse-papier d'instance perdu à la
  navigation.
