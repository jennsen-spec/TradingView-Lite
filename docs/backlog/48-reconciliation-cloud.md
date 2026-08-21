# #48 — Réconciliation cloud ↔ local (cloud-clobber)

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : ⚙️ Technique · **Taille** : M · **Priorité** : ⭐ (bloquant #54)
Épopée : [#47](47-epopee-un-seul-produit.md)

## Objectif
L'app traite `localStorage` comme source de vérité et pousse son état vers Supabase à l'ouverture **sans réconcilier** :
toute écriture faite côté serveur est **écrasée au rechargement suivant**. Tant que ce n'est pas corrigé, ni les
collections mensuelles ni les dessins générés ne peuvent survivre.

> Reproduit en session : une collection insérée dans `tvlite_prefs` disparaît quelques minutes plus tard.

## Critères d'acceptation
- [ ] Une **collection insérée côté serveur** apparaît après rechargement **et survit à un second rechargement** (cache vidé).
- [ ] Un **dessin inséré côté serveur** dans `tvlike:drawings:<TICKER>` apparaît **sans effacer** les dessins manuels du même ticker.
- [ ] Une modification faite **dans l'app** continue de gagner sur une valeur distante **plus ancienne** (pas de régression du sens local → cloud).
- [ ] Deux onglets ouverts ne se détruisent plus mutuellement leurs collections.
- [ ] Aucune clé `tvlike:` hors périmètre n'est touchée (`indicators`, `theme`, `fib-presets`, `tpl-default:*`, `tpl-presets:*`, `wl-columns`).

## Décisions
- **Arbitrage par `updated_at`** : la colonne existe dans `tvlite_prefs` mais n'est pas utilisée. Au démarrage, comparer l'horodatage distant au local ; si le distant est plus récent, l'adopter.
- **Fusion par `id`, pas remplacement de tableau** — pour les **collections** (`tvlike:collections`) et pour les **dessins** (`tvlike:drawings:<TICKER>`). Une entrée présente à distance et absente en local doit **apparaître**, pas disparaître.
- Une suppression volontaire reste une suppression : elle est portée par l'horodatage, pas par l'absence.

## Questions ouvertes
- Faut-il un marqueur de suppression (tombstone) pour qu'un dessin supprimé localement ne « ressuscite » pas depuis le cloud ? — à trancher au sprint selon ce que montre `cloudPrefs.ts`.

## Plan technique
1. Lire `frontend/src/lib/cloudPrefs.ts` + le chargement au démarrage → cartographier qui écrase qui. → vérif : le sens d'écrasement est documenté dans le ticket.
2. Ajouter la lecture/écriture de `updated_at` et l'arbitrage au chargement. → vérif : une valeur distante plus récente est adoptée.
3. Fusion par `id` pour collections et dessins (fonction commune). → vérif : test des 3 cas — distant seul, local seul, les deux.
4. Rejouer le test d'acceptation complet (insertion serveur → 2 rechargements avec vidage de cache). → vérif : la collection est toujours là.

## Notes / risques
- Piège de test connu (mémoire projet) : l'app en cours d'exécution re-sauvegarde son état vers le cloud. Pour injecter une donnée de test, poser `localStorage` **et** le cloud, **puis** recharger.
