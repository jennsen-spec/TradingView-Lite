# #36 — Dessins : supprimer tous (clic droit)

**Statut** : ✅ Fait · **Points** : 2 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Supprimer **tous** les dessins d'un coup depuis le **menu contextuel du graphique** (clic droit).
*(Supprimer une sélection multiple se fait via le socle #4 : Cmd/Ctrl-clic + corbeille de la barre contextuelle.)*

## Critères d'acceptation
- [ ] **Clic droit sur le graphique** → menu contextuel avec **« Supprimer N dessins »** (N = nombre de dessins **supprimables** ; entrée masquée/désactivée si 0).
- [ ] « Supprimer N dessins » retire **tous** les dessins du symbole courant, **sauf les dessins verrouillés** (ils restent).
- [ ] **Pas de confirmation** (suppression directe).
- [ ] Après suppression, l'état **persiste** (localStorage) — reload fidèle.

## Décisions
- Suppression « tous » via **menu contextuel** (clic droit) uniquement — pas de bouton toolbar.
- **Dessins verrouillés épargnés** ; **N** = nombre de dessins non verrouillés.
- **Pas de confirmation**, **pas d'Undo** (hors scope).
- La suppression **sélective** (plusieurs dessins) = **socle #4** (Cmd/Ctrl-clic + corbeille de la barre contextuelle) — **pas** d'entrée clic-droit dédiée.

## Plan technique
1. Entrée « Supprimer N dessins » dans le menu contextuel clic droit du graphe ; compter les dessins **non verrouillés** → vérif : compte correct, action les vide (verrouillés conservés).
2. Persistance après suppression → vérif reload.

## Notes / risques
- Dépend de **#4** (socle + menu contextuel du graphe + multi-sélection).
