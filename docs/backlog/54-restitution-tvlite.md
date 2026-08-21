# #54 — Restitution dans TVLite (collection + dessins + panneau Reco)

**Statut** : 🔍 Affiné · **Points** : 8 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : L · **Priorité** : ⭐
Épopée : [#47](47-epopee-un-seul-produit.md) · Prérequis : **#48** (bloquant), #53

## Objectif
Le moment « un seul produit » : le run mensuel arrive **dans TVLite**. Une collection, un dessin **Position longue**
pré-rempli sur chaque titre retenu, un panneau qui explique. L'aller-retour avec l'app Golden Cross disparaît ici.

## Critères d'acceptation
- [ ] Une commande `creer_collection_mensuelle(run_id)` crée la collection **« Reco AAAA-MM »** avec les titres sélectionnés.
- [ ] Un dessin **`longpos`** est généré par titre, portant entrée/stop/cible du run.
- [ ] **Fusion, jamais remplacement** : `tvlike:drawings:<TICKER>` contient les dessins faits à la main (51 traits, 11 surligneurs, 2 fib) — **les écraser serait une perte irréversible**. On ajoute au tableau ; un dessin généré d'un run précédent est remplacé **par son `id`**.
- [ ] Les `id` générés sont **préfixés** (`d-reco-<run_id>-<ticker>`) pour être distinguables des dessins manuels et nettoyables proprement.
- [ ] Le style vient du modèle **« Suggest AI »** lu dans `tvlike:tpl-presets:longpos` — **pas de valeurs dupliquées en dur** : si Jean modifie son modèle, les dessins suivent.
- [ ] `account` et `risk` (mode `pct`) sont alimentés **depuis les paramètres du run** (30 000 $ / 1 %) — l'outil calcule lui-même la taille. Rien codé en dur.
- [ ] Les **deux `points` portent le prix d'entrée** ; le second point cale l'étendue horizontale sur la **date du prochain rebalancement**.
- [ ] Un **panneau « Reco »** dans TVLite liste la sélection du run (rang, momentum, drapeau Weinstein, plan, statut) et **remplace l'app Golden Cross** ; clic sur une ligne → charge le symbole dans le graphique.
- [ ] Quand `regime_ok = false`, le panneau **dit en clair** que le protocole recommande les liquidités.
- [ ] Le **justificatif** est factuel (rang, momentum, position vs MM150, RSI, distance au stop, R:R). **Interdits** : score de confiance, probabilité de succès, rendement attendu, « forte conviction ».
- [ ] Jean peut **marquer les titres retenus** (les drapeaux de couleur existants servent de shortlist) et **ajuster les niveaux à la main** — la poignée d'entrée du `longpos` fait déjà ce geste.
- [ ] Aucune autre clé `tvlike:` n'est touchée.

## Décisions
- Format `tvlike:collections` : `value` est une **chaîne** contenant un tableau JSON ; tous les `id` uniques dans le document (`wl-<unique>`, items `section` / `symbol`).
- Le justificatif long va dans le **panneau** ; le `longpos` garde ses statistiques compactes (`compact: true`).

## Questions ouvertes
- Le champ `text.value` du dessin doit-il porter une phrase courte de justification, ou rester vide ? — à voir sur un rendu réel, le graphique se charge vite.

## Plan technique
1. Générateur TS : run → collection + dessins (lecture du preset « Suggest AI »). → vérif : le JSON produit valide le schéma relevé en base.
2. Fusion par `id` côté écriture (s'appuie sur #48). → vérif : un ticker avec 5 dessins manuels en a 6 après, pas 1.
3. Panneau « Reco » (liste + clic → symbole + bandeau régime). → vérif : le run s'affiche sans passer par l'app Golden Cross.
4. Test bout en bout : run → collection → 2 rechargements → dessins et dessins manuels tous présents.

## Notes / risques
- **#48 est un prérequis dur.** Sans la réconciliation, tout ce que ce ticket écrit meurt au rechargement suivant.
