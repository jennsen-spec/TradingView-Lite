# #48 — Réconciliation cloud ↔ local (cloud-clobber)

**Statut** : 🧪 À valider (UAT) · **Points** : 5 · **Catégorie** : ⚙️ Technique · **Taille** : M · **Priorité** : ⭐ (bloquant #54)
Épopée : [#47](47-epopee-un-seul-produit.md)

## Objectif
L'app traite `localStorage` comme source de vérité et pousse son état vers Supabase à l'ouverture **sans réconcilier** :
toute écriture faite côté serveur est **écrasée au rechargement suivant**. Tant que ce n'est pas corrigé, ni les
collections mensuelles ni les dessins générés ne peuvent survivre.

> Reproduit en session : une collection insérée dans `tvlite_prefs` disparaît quelques minutes plus tard.

## Critères d'acceptation
- [x] Une **collection insérée côté serveur** apparaît après rechargement **et survit à un second rechargement** (cache vidé).
- [x] Un **dessin inséré côté serveur** dans `tvlike:drawings:<TICKER>` apparaît **sans effacer** les dessins manuels du même ticker.
- [x] Une modification faite **dans l'app** continue de gagner sur une valeur distante **plus ancienne** (pas de régression du sens local → cloud).
- [x] Deux onglets ouverts ne se détruisent plus mutuellement leurs collections.
- [x] Aucune clé `tvlike:` hors périmètre n'est touchée (`indicators`, `theme`, `fib-presets`, `tpl-default:*`, `tpl-presets:*`, `wl-columns`).

## Décisions
- **Arbitrage par `updated_at`** : la colonne existe dans `tvlite_prefs` mais n'est pas utilisée. Au démarrage, comparer l'horodatage distant au local ; si le distant est plus récent, l'adopter.
- **Fusion par `id`, pas remplacement de tableau** — pour les **collections** (`tvlike:collections`) et pour les **dessins** (`tvlike:drawings:<TICKER>`). Une entrée présente à distance et absente en local doit **apparaître**, pas disparaître.
- Une suppression volontaire reste une suppression : elle est portée par l'horodatage, pas par l'absence.

## Questions ouvertes — tranchées au sprint
- **Tombstones : pas nécessaires.** Remplacés par une **mémoire des `id` déjà vus** (`tvlite__sync_seen`, hors `tvlike:` donc jamais synchronisée). Une entrée dont l'`id` a déjà été vu localement puis retirée est une **suppression volontaire** → on ne la réintroduit pas. Une entrée dont l'`id` n'a jamais été vu est une **création ailleurs** → on l'adopte. Vérifié dans les deux sens.

## Limite connue (assumée)
Au **tout premier** rapprochement d'une clé, il n'existe aucune mémoire d'`id` : on ne peut pas distinguer
« créé localement et pas encore synchronisé » de « supprimé ailleurs avant que la mémoire existe ».
**Choix retenu : on garde l'entrée locale** — ne jamais perdre un dessin fait à la main prime sur
ressusciter une suppression. Le cas s'est produit pendant les tests (un dessin de test est réapparu
sur AAPL) et se corrige de lui-même dès que la mémoire des `id` est constituée : dès le deuxième
rapprochement, les suppressions tiennent. À revoir seulement si Jean observe une réapparition gênante.

## Plan technique
1. Lire `frontend/src/lib/cloudPrefs.ts` + le chargement au démarrage → cartographier qui écrase qui. → vérif : le sens d'écrasement est documenté dans le ticket.
2. Ajouter la lecture/écriture de `updated_at` et l'arbitrage au chargement. → vérif : une valeur distante plus récente est adoptée.
3. Fusion par `id` pour collections et dessins (fonction commune). → vérif : test des 3 cas — distant seul, local seul, les deux.
4. Rejouer le test d'acceptation complet (insertion serveur → 2 rechargements avec vidage de cache). → vérif : la collection est toujours là.

## Notes / risques
- Piège de test connu (mémoire projet) : l'app en cours d'exécution re-sauvegarde son état vers le cloud. Pour injecter une donnée de test, poser `localStorage` **et** le cloud, **puis** recharger.
