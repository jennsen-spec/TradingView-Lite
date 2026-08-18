# #2 — Watchlists (listes + sous-sections, sauvegardées)

**Statut** : 📥 Backlog *(brouillon — à affiner)* · **Points** : 13 · **Catégorie** : 💼 Portefeuille · **Priorité** : ⭐

## Objectif
Des listes de symboles sauvegardées, organisées en sous-sections, pour naviguer vite entre
ses valeurs suivies.

## Critères d'acceptation *(candidats)*
- [ ] Un panneau « Watchlist » affiche des symboles regroupés en sous-sections nommées.
- [ ] Ajouter / retirer un symbole ; cliquer un symbole charge le graphe.
- [ ] Créer / renommer / supprimer des listes et sous-sections.
- [ ] Réorganiser (drag & drop) symboles et sections.
- [ ] Persistance (retrouvé au rechargement).

## Questions ouvertes
- **Emplacement UI** : panneau latéral (gauche ? droite ?) repliable ?
- Contenu d'une **ligne** : juste le tick, ou tick + **dernier prix + variation %** ? (nécessite un
  fetch de quotes léger — endpoint à ajouter côté backend.)
- **Drag & drop** dès le v1, ou v1 = listes statiques (ajout/retrait) et réorg plus tard ?
- Persistance : **localStorage** ou **backend kv** (déjà prêt) ? (kv ouvre la voie au multi-appareils #25.)
- Plusieurs watchlists nommées, ou une seule avec des sous-sections ?

## Plan technique
*À compléter après refinement.* Piste : modèle arborescent (listes → sections → symboles),
lib drag & drop, panneau latéral. Backend kv déjà disponible.

## Notes / risques
- XL (13). Le drag & drop et le modèle arborescent sont le gros du travail → **découper** possible.
