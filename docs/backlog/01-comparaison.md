# #1 — Comparaison d'une 2e action (base 100)

**Statut** : 📥 Backlog *(brouillon — à affiner)* · **Points** : 5 · **Catégorie** : 🎨 Cosmetic · **Priorité** : ⭐

## Objectif
Superposer une 2e action pour comparer les performances, normalisées en base 100.

## Critères d'acceptation *(candidats)*
- [ ] Ajouter une 2e action à comparer (via une recherche).
- [ ] Les deux séries sont **normalisées base 100** sur la période de référence → comparaison de % de perf.
- [ ] Une légende distingue les deux (nom + couleur).
- [ ] Retirer la comparaison revient à la vue normale.

## Questions ouvertes
- Base 100 **à partir de quand** ? (début de la période visible → recalcul au pan/zoom ; ou date fixe ?)
- **Normalisation base 100** (une seule échelle en %) — confirmé, plutôt que 2 échelles de prix ?
- **Combien** de comparaisons simultanées : 1 seule, ou plusieurs ?
- En mode comparaison, que deviennent **les bougies** et les indicateurs (SMA/RSI/Vol) : masqués, ou l'action principale reste en bougies et la 2e en ligne ?
- Alignement des dates entre 2 bourses (jours fériés différents) : quelle règle ?

## Plan technique
*À compléter après refinement.* Piste : fetch de la 2e série, alignement des dates,
transformation base 100, série ligne superposée. Réutilise `fetchCandles`.

## Notes / risques
- Rangé en Cosmetic mais touche la logique du graphe. L'alignement des dates entre bourses est le point délicat.
