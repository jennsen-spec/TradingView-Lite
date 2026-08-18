# #33 — Dessins : Flèche

**Statut** : ✅ Fait · **Points** : 2 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Outil **flèche** = un **Trait dont l'embout droit est Flèche** par défaut. Réutilise **intégralement**
le socle + Trait (#4) : tracé 2 clics, drag, barre contextuelle, dialogue Options, persistance.

## Critères d'acceptation
- [ ] Bouton **Flèche** dans la barre de dessins (à côté du Trait).
- [ ] Tracé = **2 clics** (début, fin), aperçu live — comme le Trait.
- [ ] À la création : embout gauche = **Normal**, embout droit = **Flèche**.
- [ ] Tout le reste **identique au Trait** : barre contextuelle (couleur/texte/épaisseur/style/verrou/corbeille), dialogue Options 4 onglets (Style avec embouts modifiables, Texte, Coordonnées, Visibilité), sélection/drag, persistance par symbole.
- [ ] Depuis les Options (Style › embouts), on peut retransformer la flèche en trait simple (Normal/Normal) et inversement — **même primitive**.

## Décisions
- La Flèche **n'est pas un type distinct** : c'est le type `trend` avec préréglage `rightCap = 'arrow'`. Même modèle, même rendu, mêmes options que #4.

## Plan technique
1. Ajouter le bouton Flèche à la barre ; à la création, instancier un `trend` avec embout droit = Flèche → vérif : le tracé produit une flèche.
2. Rien d'autre — tout est hérité du socle #4 → vérif : options/drag/persistance fonctionnent comme pour le Trait.

## Notes / risques
- Ticket volontairement **mince**. Bloqué tant que **#4** (socle + embouts Normal/Flèche) n'est pas fait.

## Dépendances
- **#4** (socle + Trait, gère déjà les embouts Normal/Flèche).
