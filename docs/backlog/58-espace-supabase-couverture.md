# #58 — Base saturée : déplacer les secteurs hors stratégie et inventorier ce qui manque

**Statut** : Affiné · **Points** : 8 · **Catégorie** : ⚙️ Technique · **Priorité** : ⭐ bloquant
**Plan vérifié le 26/08 (2ᵉ passe)** — trois défauts corrigés, voir Décisions.

## Objectif
La base opérationnelle est à **499 Mo sur 500** : le rafraîchissement quotidien sort sans rien
faire depuis le 22/08 et **le signal du 31 août ne pourra pas être calculé**. Libérer la place en
déplaçant les barres hors stratégie vers le second projet Supabase, **sans perturber les graphiques
TVLite ni les analyses du labo**, puis se donner un inventaire de ce qui manque en industrie + techno.

## Constat mesuré (26/08/2026)
| | |
|---|---|
| Taille du projet opérationnel | **499 Mo** (garde-fou du cron : 480 Mo ; limite du forfait : 500) |
| Dernière barre en base | **2026-08-21** — 906 des 911 tickers en retard |
| Cron `rafraichissement-cours` | s'exécute, se déclare « succeeded », traite **0 titre** |
| Table `bars` | 484 Mo · 2 907 903 barres · un seul index (la clé primaire, 107 Mo) |
| À conserver en opérationnel | **105 tickers** (94 duo + 5 références + 6 FNB sectoriels) = 424 166 barres ≈ **71 Mo** |
| À archiver (hors les 105, ≥ 2002) | 2 271 117 barres ≈ **378 Mo** → projet 2 à ~78 % |
| Second projet (`bsmcshezaofompkrmqii`) | 10 Mo sur 500 · **possède déjà une table `bars`** (schéma recherche, `instrument_id`) |
| Secteurs non résolus | **47 titres** — surtout FNB/fiducies, mais **CSCO.TO** (CDR techno) est dedans |
| Sauvegarde locale `labo/.cache/` | incomplète : 715 séries sur 911 (les < 253 barres n'y sont pas) |

## Décisions
- **Déplacer, pas supprimer ni figer.** Deux changements de convention en une semaine ont exigé de
  tout recalculer depuis les barres brutes ; des résultats figés seraient devenus incomparables.
- **`TRUNCATE` + rechargement, pas `DELETE`** *(correction de la 1ʳᵉ version du plan)*. Sur
  Postgres, `DELETE` ne rend pas l'espace au système — la preuve est dans la base : 405 744 lignes
  mortes, autovacuum passé, taille inchangée. `VACUUM FULL` exigerait 2× la place. Seul `TRUNCATE`
  libère immédiatement. Donc : tout exporter, vider, recharger les 105.
- **L'archive s'appelle `bars_ca`** *(défaut trouvé à la vérification)* : le projet 2 possède déjà
  une table `bars` au schéma recherche (`instrument_id smallint`). Créer « bars » l'écraserait ou
  entrerait en collision. Table neuve + politique RLS de lecture anonyme, comme la recherche.
- **Purger les tables d'état des tickers déplacés** *(fuite trouvée à la vérification)* :
  `refresh_cours` boucle sur `refresh_state`, qui garderait les 806 tickers déplacés — le cron les
  re-téléchargerait de Yahoo vers le projet 1 (~200 k lignes, ~35 Mo qui reviennent). Supprimer
  leurs lignes de `refresh_state`, `bars_coverage`, `dividends_state`, `backfill_queue`. Pour
  `bars_coverage` c'est aussi fonctionnel : une ligne de couverture sans barres ferait servir un
  **graphique vide** à TVLite au lieu de déclencher le re-téléchargement.
- **Archive limitée aux barres ≥ 2002-01-01.** L'interrupteur (XSP) n'existe pas avant avril 2002
  et la fenêtre mesurée commence en 2004 ; les indicateurs demandent au plus 252 barres d'amorce,
  donc un départ 2002 laisse les 13 courbes **strictement identiques** — c'est le critère qui le
  prouve. Économie : ~37 Mo, et le projet 2 reste sous 80 %. (Les 105 conservés gardent, eux,
  leur historique complet : le grand livre démarre en décembre 2002 avec amorce 2001.)
- **Étape 0 découplée de la migration** : `backfill_ticker` n'a **pas** de garde-fou de taille
  (vérifié dans sa définition — le garde-fou est dans `refresh_cours` seulement). On peut donc
  rafraîchir les 105 tickers du duo à la main dès maintenant : ~1 000 barres nouvelles, l'espace
  mort absorbe. **Le signal du 31 août est sauvé même si la migration glisse.**
- **TVLite n'est pas perturbé** : un ticker déplacé consulté dans l'app suit le chemin « cache
  absent » → re-téléchargement Yahoo → graphique normal (premier affichage plus lent). C'est pour
  ça que la purge doit être **rejouable** : elle redéplace ce que l'app réinsère.
- **Forfait gratuit conservé** (tranché le 26/08). Les deux projets plafonnent à 1 Go réunis.
- Partitionnement de `bars` : **non retenu** — sur une table finale de ~85 Mo avec purge
  rejouable, c'est de la complexité sans besoin.
- Seuil de volume : ne rien changer ici (décision de stratégie, ticket séparé).

## Critères d'acceptation
- [ ] **Étape 0** : la dernière barre des 105 tickers est à ≤ 2 jours ouvrables, et le cycle de
      fin de mois se calcule sans déclencher le garde-fou de fraîcheur — avant toute migration.
- [ ] Export complet vérifié : 911 tickers, 2 907 903 barres, relu et comptes conformes.
- [ ] Copie vers `bars_ca` prouvée : compte de barres **par ticker** identique des deux côtés
      avant toute suppression côté opérationnel.
- [ ] Base opérationnelle **sous 150 Mo** après rechargement ; projet 2 **sous 80 %**.
- [ ] Le rafraîchissement traite à nouveau 200 titres/jour et plus aucun des 105 n'est en retard
      de plus de 6 jours ; les tables d'état ne mentionnent plus les tickers déplacés.
- [ ] TVLite affiche un graphique correct pour un ticker déplacé (re-téléchargement, pas de vide).
- [ ] `npm run labo:comparer` lit `bars_ca` et produit les **13 courbes identiques** à aujourd'hui.
- [ ] Les 47 secteurs inconnus sont résolus ou explicitement exclus avec motif ; CSCO.TO récupéré.
- [ ] La purge rejouable existe, lancée deux fois de suite sans casse, planifiée mensuellement.
- [ ] Une commande d'inventaire liste les sociétés industrie/techno du TSX absentes de la base.

## Plan technique
0. **Débloquer le signal du 31 — sans rien supprimer** : `backfill_ticker(t, 1)` sur les 105
   tickers, à la main. → vérif : dernière barre du duo = veille ouvrable ; `calculerCycle` passe.
1. **Exporter depuis la base** (pas depuis `labo/.cache/`, incomplet) : les 911 tickers avec
   compte par ticker. → vérif : somme = 2 907 903.
2. **Résoudre les 47 secteurs** et figer la liste définitive à conserver (105 + CDR récupérés).
   → vérif : plus d'« Inconnu » parmi les titres passant volume ≥ 250 k$ et prix ≥ 1 $.
3. **Créer `bars_ca` + RLS lecture** sur le projet 2, copier les tickers hors liste, barres
   ≥ 2002 (script Node : lecture clé publishable, écriture clé service du projet 2 — la seule
   qu'il faudra fournir). → vérif **bloquante** : compte par ticker identique.
4. **`TRUNCATE public.bars`** puis rechargement des 105 depuis l'export. *(Fenêtre à risque de
   quelques minutes entre les deux — c'est pour ça que la vérif 3 est bloquante.)*
   → vérif : 105 tickers, comptes conformes, base ~100 Mo.
5. **Nettoyer les tables d'état** (`refresh_state`, `bars_coverage`, `dividends_state`,
   `backfill_queue`) des tickers déplacés ; remonter le garde-fou du cron à 400.
   → vérif : `refresh_cours(200, 400)` traite des titres ; TVLite re-télécharge un déplacé.
6. **Adapter `chargerMarket`** : duo depuis le projet 1, univers complet depuis `bars_ca`.
   → vérif : 13 courbes identiques au dixième.
7. **Purge rejouable** : fonction qui redéplace vers `bars_ca` ce que TVLite a réinséré (sur
   liste de conservation, PAS sur `accessed_at` — signal d'usage inexploitable), en `pg_cron`
   mensuel. → vérif : consulter un titre hors duo, relancer, état restauré.
8. **Inventaire** : annuaire TSX vs `bars_coverage` + `bars_ca`, manquants industrie/techno
   triés par volume, refus d'ajout si l'espace manque. → vérif : total cohérent avec TMX (~2 089).

## Questions ouvertes
- Où trouver un annuaire fiable des sociétés cotées au TSX, récupérable proprement ?
- La clé service du projet 2 : à fournir par Jean au moment de l'étape 3 (jamais commitée).

## Notes / risques
- **L'échec actuel est silencieux** — le cron se dit « succeeded » en ne faisant rien. La
  notification Telegram du backlog attraperait exactement ce cas : prioritaire.
- **Ne jamais faire d'opération qui grossit temporairement le projet 1** (copies internes,
  `VACUUM FULL`…) : à 499/500, le fournisseur peut passer le projet en lecture seule.
- La purge mensuelle par `DELETE` ne rétrécit pas le fichier — elle maintient l'espace mort
  réutilisable dans une table devenue petite. C'est le comportement voulu ; ne pas s'en alarmer.
- Élargir la couverture ne corrigera pas le biais du survivant (voir la réserve du document des
  courbes) : les tickers ajoutés seront eux aussi des survivants.
