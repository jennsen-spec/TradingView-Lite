# #42 — Plateforme de données bourse partagée (TVLite + GCR sur Supabase)

Statut : 🏗️ En cours (Phase 1) · Épic **cross-projet** (TVLite + `goldencross-radar`)
Supabase : `cucshrxmtwwizzzqthcj` (« Golden Cross »)

## Objectif
Un Supabase unique comme couche **données/cache** pour les deux apps. TVLite déployé et
**fonctionnel** sur GitHub Pages. Worker GCR retravaillé pour **lire le cache** → moins d'appels
Yahoo (moins de risque de rejet, données plus rapides).

## Décisions actées
1. **Schéma DB** (migrations, table `bars`) possédé par `goldencross-radar` ; **chaque repo possède SES Edge Functions**.
2. **Dev local TVLite** : backend Node/SQLite gardé pour le dev, Edge Function en prod (`VITE_API_BASE` bascule).
3. **Cache TVLite borné** à ~3 ans en `1d` ; historique profond (amorçage SMA ~30 ans) = fetch Yahoo **transitoire, non caché**.

## Phases
- **Phase 1 — TVLite en ligne (GCR non touché)** 🏗️
  - Edge Function `tvlite-api` (Deno) : port de `backend/src/yahoo.js` (candles + search), proxy live, CORS.
  - Frontend : `VITE_API_BASE` → URL fonction ; `api.ts` préfixe.
  - GitHub Pages : `base: '/TradingView-Lite/'`, workflow GHA build+deploy, activer Pages.
  - **DoD** : l'URL github.io charge les graphiques depuis n'importe quel réseau.
- **Phase 2 — Cache partagé (write-through)**
  - Migration `bars` (PK `ticker,interval,bar_date` ; RLS lecture publique / écriture service-role ; ticker normalisé upper).
  - Edge Function : lit le cache d'abord → sinon Yahoo → upsert (`ON CONFLICT DO UPDATE`).
  - Job de rétention (purge > fenêtre).
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
