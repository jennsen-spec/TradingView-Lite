# #26 — Dernière MàJ des données + bouton refresh

**Statut** : ✅ Fait · **Points** : 2 · **Catégorie** : 🎨 Cosmetic · **Priorité** : ⭐

> **Sprint (fait)** — Backend : `getTimeSeries(…, fresh)` renvoie `fetchedAt` (heure du fetch) et le param `?fresh=1` contourne+réécrit le cache. Front : cluster haut-droite « Dernière MàJ des données : jj-mm-aaaa à hh:mm » (heure locale) + bouton **↻** (spin pendant chargement, désactivé). Vérifié : `fetchedAt` présent, `fresh=1` → cached:false, le bouton émet `&fresh=1`. Affichage à la minute → un refresh dans la même minute montre le même texte (la valeur avance quand même).

## Objectif
Afficher quand les prix du symbole affiché ont été chargés pour la dernière fois, et un
bouton pour forcer un rechargement frais (contournement du cache backend).

## Critères d'acceptation
- [x] Cluster en **haut à droite** (au niveau de la barre d'intervalle, mais côté droit).
- [x] Texte **« Dernière MàJ des données : jj-mm-aaaa à hh:mm »** pour le **symbole courant**, à l'**heure locale de l'utilisateur** (24 h). Se met à jour au changement de symbole/intervalle.
- [x] Bouton **refresh** (icône double flèche circulaire ↻) recharge le **symbole + intervalle courants**.
- [x] Le refresh **force le contournement + la réécriture** du cache backend (`fresh=1`).
- [x] L'horodatage **avance à l'heure du fetch** même si Yahoo n'a pas de nouvelle donnée (ex. week-end : valeurs identiques, mais « Dernière MàJ » à jour).
- [x] État visuel pendant le chargement (spinner / bouton désactivé).

## Décisions
- **Portée** = symbole + intervalle **courants** uniquement. **Pas de « refresh all »** (retiré du scope).
- **Horodatage** = `fetched_at` (heure du fetch), affiché à l'**heure locale du navigateur**, format `jj-mm-aaaa à hh:mm` (24 h).
- **`fresh=1`** côté backend : ignore le cache **et** le réécrit (repart pour 12 h).
- Points inchangés (**2**, XS).

## Questions ouvertes
- `fetched_at` géré **par (symbole, intervalle)** (chaque intervalle a son entrée de cache) — à confirmer à l'implémentation.

## Plan technique
1. Backend : exposer `fetched_at` (déjà stocké au cache) dans la réponse `getTimeSeries` → vérif : champ présent dans la réponse.
2. Backend : param `fresh=1` → saute la lecture du cache, refetch Yahoo, réécrit l'entrée → vérif : un appel `fresh=1` renvoie des données re-fetchées et met à jour `fetched_at`.
3. Front : cluster UI en haut à droite (texte + bouton ↻), date formatée en heure locale → vérif : affiché, format correct, suit le symbole.
4. Front : le bouton déclenche le fetch `fresh` du (symbole, intervalle) courant, état loading, puis met à jour le texte avec le `fetched_at` retourné → vérif : clic recharge, horodatage avance (même le week-end).

## Notes / risques
- Petit (2), mais touche le backend (nouveau param + exposition de la date).
- `fetched_at` par intervalle : bien viser l'entrée de cache correspondant à l'intervalle affiché.
