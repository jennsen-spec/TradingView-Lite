# #49 — Terrain unifié (un dépôt, un Supabase, quatre schémas)

**Statut** : 🔍 Affiné · **Points** : 8 · **Catégorie** : ⚙️ Technique · **Taille** : L
Épopée : [#47](47-epopee-un-seul-produit.md) · Prérequis de #50

## Objectif
Supprimer l'éparpillement : **un dépôt**, **un projet Supabase**, des schémas nommés par **fonction** et non par produit.
L'app Golden Cross Radar est retirée ; son moteur de scraping (déjà dans Postgres) est conservé et rapatrié sous gouvernance TVLite.

## Critères d'acceptation
- [ ] Les objets Supabase sont rangés en **4 schémas** : `market` (barres, tickers, file de backfill) · `research` (backtests) · `reco` (runs, items) · `app` (`tvlite_prefs`). Plus aucun objet ne porte un nom de produit.
- [ ] Les **migrations SQL sont versionnées dans `TradingView-Lite`** (`supabase/migrations/`) — la propriété du schéma passe de `goldencross-radar` à TVLite (annule la décision 1 de [#42](42-plateforme-data-supabase.md)).
- [ ] Le **backfill tourne toujours** après la réorganisation (pg_cron `backfill-ca`), avec son garde-fou de quota.
- [ ] L'app en prod (GitHub Pages + `tvlite-api`) **fonctionne à l'identique** après migration — aucune régression de candles/search/quotes/prefs.
- [ ] Le dépôt `goldencross-radar` et le worker sont **inventoriés puis archivés** ; ce qui méritait d'être gardé est dans TVLite.
- [ ] `research` est **reconstructible par un script versionné** du dépôt (`npm run research:build`) — le vider n'est pas une perte.
- [ ] La base reste **sous 450 Mo** en régime opérationnel, ou s'arrête proprement en le signalant.

## Décisions
- **Plan gratuit conservé.** `research` est un **schéma jetable** : on le remplit jusqu'à ~450 Mo pour #50/#52, puis on le **vide** en gardant les résultats (quelques Ko). Condition non négociable : la reconstruction est **du code**, pas une manip.
- **Swing Mastery** (106 titres, 22 ans, ajusté dividendes) est rapatriée dans `research` : **c'est la seule donnée qui couvre 2008**.
- Le **moteur de scraping reste en Postgres** (`backfill_ticker` + extension `http` + pg_cron) — il marche, il est serverless, on n'y touche pas.
- Toucher volontairement le plafond de 500 Mo fait partie du plan : c'est ce qui tranchera la question Pro (voir Questions ouvertes).

## Inventaire mesuré — 21 août 2026  *(lecture seule, aucune modification)*

**Le plan gratuit tient. Les 760 Mo de Swing Mastery étaient un mirage.**

| | Mo | Détail |
|---|---:|---|
| Golden Cross — total base | **334** / 500 | dont `bars` 314 Mo (1,64 M lignes, 2 313 tickers) |
| Golden Cross — `daily_bars` | 8 | 35 k lignes — **doublon présumé** de `bars` |
| Swing Mastery — total | 760 | dont `ta_ca_daily` 466 Mo + `bars` 279 Mo |
| Swing Mastery — **ce dont on a besoin** | **41** | les **467 502 barres des 106 titres canadiens** |
| **Projection après rapatriement** | **≈ 375** / 500 | ~125 Mo de marge |

Pourquoi 41 Mo et non 760 :
- **`ta_ca_daily` (466 Mo) ne se migre pas.** C'est une table **dérivée** — 38 colonnes d'indicateurs recalculables depuis `bars`, stockées à ~800 octets/ligne (colonnes `text` répétées à chaque ligne). Le labo #50 calcule ses indicateurs **en TypeScript** : il n'en a pas l'usage.
- **238 Mo des `bars` de Swing Mastery ne sont pas canadiens** (3,19 M lignes au total, 467 k pour les 106 titres CA). Hors sujet pour une stratégie canadienne.

**Le backfill est TERMINÉ** — 604/604, file vide, dernière activité 19h12 le 21/08, données à jour au 21/08.
*(Le brief annonçait « 406 faits, 198 restants » : il a fini depuis.)*

**Univers réel — corrige le brief** : sur 2 313 tickers, **505 ont ≥ 5 ans** d'historique et **450 ≥ 8 ans**
(le brief disait 336 et 299). En revanche **35 seulement atteignent 10 ans** → le pan-canadien
ne couvre bien qu'un seul régime de marché, comme prévu.

## Questions ouvertes
- **`cron.backfill-ca` tourne toutes les minutes sur une file vide** (no-op vérifié : plus aucune ligne dans `backfill_log` depuis 19h12). Le brief prévoyait de le désactiver une fois la file vide. **Non touché** — décision de Jean, réversible en une ligne.
- `daily_bars` (35 k lignes, 8 Mo) fait-elle doublon avec `bars` ? Gain faible, mais à trancher.
- Ajouter `adj_close` (dividendes) : coût en Mo à mesurer. Avec ~125 Mo de marge c'est désormais envisageable — l'écart est de 3 à 5 pts/an sur pipelines, télécoms et FPI, nombreux dans les résultats.
- Le **délai de recherche de titre** dans TVLite est-il lié à Supabase ? Hypothèse : non (la recherche tape Yahoo). **À vérifier — ticket séparé**, ne doit pas peser sur la décision de plan.

## Plan technique
1. Inventaire : lister les objets des deux projets Supabase + le contenu de `goldencross-radar` et du worker. → vérif : un tableau « objet → schéma cible → sort ».
2. Migrations `supabase/migrations/` créant les 4 schémas et déplaçant les objets. → vérif : `tvlite-api` répond toujours en prod.
3. Script `research:build` (backfill profond + indicateurs) et `research:drop`. → vérif : drop puis rebuild redonne les mêmes lignes.
4. Rapatrier Swing Mastery dans `research`. → vérif : 467 502 lignes présentes, prix ajustés dividendes.
5. Archiver `goldencross-radar` + worker. → vérif : plus aucune écriture externe sur la base.

## Notes / risques
- **Dépassement de quota = base en lecture seule = app cassée.** Tout script qui écrit en masse doit avoir un garde-fou de taille avant la première insertion, pas après.
- #42 avait prévu un **prune LRU** (purge des titres inactifs > 90 j) — à réactiver comme soupape opérationnelle.
