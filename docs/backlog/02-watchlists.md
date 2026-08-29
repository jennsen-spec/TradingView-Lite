# #2 — Watchlists (listes + sous-sections, sauvegardées)

**Statut** : ✅ Fait — constaté à l'affinage (29/08/2026) · **Points** : 13 · **Catégorie** : 💼 Portefeuille · **Priorité** : ⭐

## Objectif
Des listes de symboles sauvegardées, organisées en sous-sections, pour naviguer vite entre
ses valeurs suivies.

## Critères d'acceptation *(candidats)*
- [x] Un panneau « Watchlist » affiche des symboles regroupés en sous-sections nommées.
- [x] Ajouter / retirer un symbole ; cliquer un symbole charge le graphe.
- [x] Créer / renommer / supprimer des listes et sous-sections.
- [x] Réorganiser (drag & drop) symboles et sections.
- [x] Persistance (retrouvé au rechargement).

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

---

## Clôture — 29/08/2026 : déjà livré, sous le nom « Collections »
À l'affinage, constat : **tout existe déjà** dans le panneau Collections
(`frontend/src/components/WatchlistPanel.tsx` + `WatchlistDetail.tsx`), construit par touches au fil
des tickets précédents. Les critères candidats, un à un : sections nommées ✓ · ajouter/retirer un
symbole, clic → graphique ✓ · créer/renommer/supprimer listes **et** sections (menus clic droit) ✓ ·
drag & drop ✓ · persistance localStorage + cloud (`tvlike:collections`, fusion #48) ✓.
Les questions ouvertes se sont tranchées toutes seules en construisant : volet latéral · ligne avec
**prix + variation** (volet détail) · drag & drop dès maintenant · persistance **cloud** (multi-appareils) ·
**plusieurs listes nommées, chacune avec sections** — les deux à la fois.
