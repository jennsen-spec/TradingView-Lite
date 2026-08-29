# #65 — Mesure : choisir les unités de la durée (année / mois / jour)

**Statut** : 🧪 À valider (sprint du 29/08) · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : S

## Objectif
Sous « Échelle de temps » (onglet **Mesure** d'un Trait / d'une Flèche), trois cases —
**Année**, **Mois**, **Jour** — pour choisir les unités affichées dans la durée.
Aujourd'hui la décomposition est imposée : « 16 ans et 9 mois », « 9 mois et 2 jours ».

## La question de fond — et la réponse retenue
Décocher une unité, ça veut dire quoi ? Deux lectures opposées, et **une seule est honnête** :

| | « 16 ans et 9 mois », **Année** décochée |
|---|---|
| Masquer la partie | « 9 mois » → **faux**, la durée affichée n'est plus la bonne |
| **Reporter sur l'unité inférieure** | « 201 mois » → **retenu** |

D'où la règle en deux temps :
- Une unité **plus grande** décochée est **reportée** sur la plus grande unité encore cochée
  (16 ans + 9 mois → 201 mois). La durée reste exacte.
- Une unité **plus petite** décochée est **tronquée** (9 mois et 2 jours, Jour décoché → « 9 mois »).
  On tronque, on n'arrondit pas : c'est cohérent avec la marche calendaire existante.

## Critères d'acceptation
- [ ] Trois cases **Année / Mois / Jour** apparaissent sous « Échelle de temps », en retrait, et sont **désactivées** quand « Échelle de temps » est décochée.
- [ ] Les trois sont **cochées par défaut** → l'affichage actuel est inchangé pour tous les dessins existants.
- [ ] **Report** vérifié : « 16 ans et 9 mois » sans Année donne « 201 mois » ; sans Année ni Mois, le total en jours.
- [ ] **Troncature** vérifiée : « 9 mois et 2 jours » sans Jour donne « 9 mois ».
- [ ] On **ne peut pas décocher les trois** : la dernière cochée est désactivée (sinon la durée disparaîtrait sans le dire).
- [ ] Le réglage est porté par le dessin, suit **« Définir par défaut »** (modèles) et survit au rechargement.
- [ ] Les dessins enregistrés **avant** ce ticket s'affichent comme avant (champs absents = tout coché).

## Décisions
- **Périmètre : le dessin seulement.** La mesure **Shift + clic** (#27) garde son comportement
  automatique — elle n'a pas de dialogue d'options, et lui en ajouter un est un autre sujet.
- **En dessous du jour, rien ne change** : une mesure intraday continue d'afficher heures/minutes
  via `fmtDuration`. Les trois cases ne portent que sur la durée civile.
- Champs ajoutés à `MeasureConfig` : `durY` / `durM` / `durD`, défaut `true`, lus avec `?? true`
  pour ne pas casser l'existant.

## Questions ouvertes
- Faut-il **arrondir** plutôt que tronquer (« 9 mois et 25 jours » sans Jour → « 10 mois ») ?
  Tronquer est retenu par défaut ; à rediscuter si l'écart gêne Jean à l'usage.

## Plan technique
1. `MeasureConfig` + `defaultMeasure` : trois booléens. → vérif : un dessin ancien se relit sans changement.
2. `dureeEntre(t0, t1, unites)` : report vers l'unité inférieure, puis troncature.
   → vérif : les trois cas du tableau des critères, sur des dates connues.
3. Onglet Mesure : les trois cases, en retrait, désactivées si « Échelle de temps » est décochée,
   et verrou sur la dernière cochée. → vérif : impossible de tout décocher.
4. Recette sur le graphique + rechargement. → vérif : le libellé suit, le réglage persiste.

## Notes / risques
- `dureeEntre` est **partagée** avec la mesure Shift + clic ([`DrawingLayer`](../../frontend/src/components/DrawingLayer.tsx)).
  Le nouveau paramètre doit être **optionnel** et par défaut « tout affiché », sinon on modifie #27 sans le vouloir.
- Le report en jours d'une longue durée donne un grand nombre (« 6118 jours ») : c'est voulu, mais
  à regarder une fois en vrai pour vérifier que ça ne déborde pas de l'étiquette.

## Journal du sprint — 29/08
**Renuméroté #58 → #65** : le n° 58 était déjà pris (« Base saturée », en cours depuis le 26/08) —
collision créée à la rédaction du 28/08, corrigée avant le sprint.

**Fait, tel que planifié** : `durY`/`durM`/`durD` optionnels sur `MeasureConfig` (lus `?? true`) ·
`dureeEntre(t0, t1, unites?)` : une unité plus grande décochée n'est pas extraite (elle **coule**
dans l'inférieure = report), une plus petite est tronquée · les trois cases sous « Échelle de
temps », désactivées quand elle est décochée, verrou sur la dernière cochée. La mesure Shift+clic
(#27) appelle `dureeEntre` sans le paramètre : comportement inchangé.

**Cas limite tranché** (absent du ticket) : quand la troncature ne laisse rien (« 12 jours » sans
Jour), on affiche « 0 mois » plutôt que rien — même esprit que le verrou : la durée ne disparaît
jamais en silence.

**Vérifié** : 11 cas de dates connues (dont les trois du ticket : 201 mois · 9 mois · total en
jours ; et la marche fin de mois 31 janv. + 1 mois) · recette navigateur sur AAPL (flèche 2020→2025 :
« 5 ans, 2 mois et 20 jours » → sans Année « 62 mois et 20 jours » → sans Mois « 1906 jours »
avec Jour verrouillé → sans Jour « 5 ans et 2 mois ») · réglage conservé après rechargement complet ·
flèche de test supprimée, les 9 dessins AAPL de Jean intacts · `tsc` propre. « Définir par défaut »
suit sans code : les modèles copient l'objet `measure` entier.
