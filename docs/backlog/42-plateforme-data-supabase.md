# #42 — Plateforme de données bourse partagée (TVLite + GCR sur Supabase)

Statut : 🏗️ En cours (Phase 1) · Épic **cross-projet** (TVLite + `goldencross-radar`)
Supabase : `cucshrxmtwwizzzqthcj` (« Golden Cross »)

## Objectif
Un Supabase unique comme couche **données/cache** pour les deux apps. TVLite déployé et
**fonctionnel** sur GitHub Pages. Worker GCR retravaillé pour **lire le cache** → moins d'appels
Yahoo (moins de risque de rejet, données plus rapides).

## Décisions actées
1. **Schéma DB** (migrations, tables `bars`/`bars_coverage`) possédé par `goldencross-radar` ; **chaque repo possède SES Edge Functions**.
2. **Dev local TVLite** : backend Node/SQLite gardé pour le dev, Edge Function en prod (`VITE_API_BASE` bascule).
3. ~~Cache borné 3 ans~~ → **remplacée** : **cache-union « gap-filling »**. Une seule table `bars` ; TVLite complète l'écart manquant chez Yahoo et le sauvegarde → le cache s'approfondit tout seul (jusqu'à 30 ans pour les titres consultés). Garde-fou stockage = **prune LRU** (purge des titres inactifs > 90 j).

## Phases
- **Phase 1 — TVLite en ligne (GCR non touché)** 🏗️
  - Edge Function `tvlite-api` (Deno) : port de `backend/src/yahoo.js` (candles + search), proxy live, CORS.
  - Frontend : `VITE_API_BASE` → URL fonction ; `api.ts` préfixe.
  - GitHub Pages : `base: '/TradingView-Lite/'`, workflow GHA build+deploy, activer Pages.
  - **DoD** : l'URL github.io charge les graphiques depuis n'importe quel réseau.
- **Phase 2 — Cache partagé (write-through)** ✅ **Fait**
  - Migration `0006_bars_shared_cache` (GCR) : tables `bars` (PK `ticker,interval,bar_date`) + `bars_coverage` (max_range/currency/name/accessed_at) ; RLS lecture publique / écriture service-role.
  - Edge Function `tvlite-api` v3 : read-through (couverture + fraîcheur 12 h, pagination) → sinon Yahoo → write-through upsert (`gap-filling`). Agrégats 1w/1mo servis depuis le 1d caché.
  - Rétention : `prune_bars_cache(idle_days)` + pg_cron hebdo (dimanche 4 h, > 90 j).
  - **Vérifié** : DOL.TO 2ᵉ chargement `cached:true` (2507 bougies complètes) ; 4229 barres écrites (historique complet depuis IPO 2009).
- **Phase 3 — Refacto worker GCR (sens 1)**
  - Backfill unique (2 ans TSX+TSXV) ; scan quotidien **incrémental** (lit le cache, fetch **delta** seulement).
  - Sortie inchangée (`cross_events`, `daily_bars`, push) ; **derrière flag + tests**.
  - **DoD** : run incrémental = mêmes `cross_events` qu'un run full de référence ; chute des appels Yahoo.
- **Phase 4 (plus tard) — Sens 2 : TVLite embarqué dans GCR**
  - Chart lite (2 SMA, RSI calculé client depuis le cache, volume, intervalles j/s/m, titre figé) lisant `bars` + `cross_events`.

## Points de vigilance
CORS (origine Pages) · endpoint `search` · **normalisation ticker** (upper, format Yahoo) ·
rétention/purge de la fenêtre glissante · **ne pas casser le worker** (flag + tests) ·
secrets/config GHA (URL fonction + clé publishable) · monitoring taille DB / egress (free → Pro).
