# #41 — Screener Golden Cross (TSX/TSX-V, scan quotidien)

**Statut** : 🔍 Affiné · **Points** : 13 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : XL · **Priorité** : —

## Objectif
Détecter chaque jour de bourse **toutes les actions du TSX + TSX-V qui viennent de former un golden cross** (la moyenne mobile 50 j franchit au-dessus de la 200 j) et les afficher dans l'app. Un scan **serveur** tourne 1×/jour, persiste les signaux, et un panneau front les liste (+ marqueur sur le chart). Le signal est **global** (identique pour tous les futurs utilisateurs) → un seul scan/jour sert tout le monde.

> **Contexte** : un POC complet a déjà été construit et validé hors-repo dans `~/dev/golden-cross-tsx/` (algo, univers TMX, filtre volume, corrections de bugs). Ce ticket = **porter ce POC dans l'app** (Node/SQLite + front). Voir § Références.

## Critères d'acceptation
- [ ] Un **job planifié** tourne les jours de bourse (lun–ven) ~18h00 heure de l'Est, **dans le process backend**, et écrit dans la table `golden_cross_signals`.
- [ ] Le scan couvre **tout le TSX (`.TO`) + TSX-V (`.V`)** via l'annuaire TMX (~3700 symboles bruts), **ETF/fonds exclus** (~2300 actions restantes).
- [ ] SMA calculées sur le **close brut (non ajusté dividendes)** — cohérent avec les bougies affichées ; **aucun** faux positif type BAM/HHL/HHLE (cf. § Notes).
- [ ] Filtre de liquidité : **volume $ moyen (close×volume) sur 20 séances ≥ 100 000 CAD** (constante configurable ; défaut = 100k, décidé au refinement).
- [ ] Ligne de résumé du message au format **« {liquides} / {actions} · filtré par volume ≥ 100k$ »** (ex. `685 / 2307 · filtré par volume ≥ 100k$`).
- [ ] Détection stricte : golden cross **le jour du scan uniquement** — `diff = sma50 − sma200`, croisement si `diff[veille] ≤ 0` **et** `diff[jour] > 0`.
- [ ] Endpoint `GET /api/signals/golden-cross` renvoie les signaux récents (ticker, bourse, date, close, sma50, sma200, volume $) + méta du dernier run.
- [ ] Panneau front **« Signaux Golden Cross »** : liste des signaux, **clic sur une ligne → charge le symbole dans le chart** (réutilise le flux d'ouverture de symbole existant).
- [ ] Aucune **re-notification** : un même (ticker, date) n'apparaît qu'une fois (clé primaire).
- [ ] Le scan **ne bloque pas** l'API pendant son exécution (~2–4 min) et journalise un résumé (`scanné=N`, `liquides=M`, `signaux=K`).

## Décisions
- **Réutiliser Yahoo** (source déjà en place dans `backend/src/yahoo.js`) pour le v1 — **même source que le POC**, donc pas de nouvelle intégration data. La montée en charge (feed payant) = **hors scope**, dépend de **#14** (temps réel / licence).
- **Univers = annuaire TMX**, pas Yahoo lookup. URLs :
  - `https://www.tsx.com/json/company-directory/search/tsx/%5E*` → suffixe `.TO`
  - `https://www.tsx.com/json/company-directory/search/tsxv/%5E*` → suffixe `.V`
  - Conversion classes/units : `X.A` → `X-A` (avant d'ajouter le suffixe).
  - Exclusion ETF/fonds par **nom** (le JSON TMX n'a pas de champ type) : rejeter si le nom contient `" ETF"`, `"FUND"`, `" INDEX"`, `" ETN"`.
- **Job in-process obligatoire** : `db.js` ouvre SQLite **sans WAL, mono-process**. Un process de scan séparé qui écrirait le même fichier risquerait un verrou. → Le scan tourne **dans le backend** via `node-cron` (nouvelle dépendance). *(Alternative externe = imposerait WAL ou une 2ᵉ DB → repoussé.)*
- **Fetch dédié, hors cache** : le scan récupère `range=2y&interval=1d` par symbole avec un **pool de concurrence** (~10 en parallèle), **sans écrire dans `ohlcv_cache`** (éviter de gonfler le cache de 2300 lignes ; les données de scan sont éphémères, seuls les **signaux** persistent). Réutiliser `getTimeSeries()` en boucle = alternative plus simple mais pollue le cache et reste séquentielle → écarté.
- **Devise** : univers 100 % TSX/TSXV = CAD → **pas de conversion FX** pour le filtre volume.
- **Scope v1** = job + table + endpoint + panneau liste. **Marqueur sur le chart** (`setMarkers`) = inclus si le temps le permet, sinon extrait en sous-ticket.

## Questions ouvertes
- **Backend 24/7** : `node-cron` ne tire que si le process tourne à l'heure dite. En local (backend lancé à la demande) le run peut être manqué → prévoir un **rattrapage au démarrage** (« dernier run > 24h ? alors scanne »). À trancher : rattrapage auto vs bouton manuel « Scanner maintenant ». Devient un non-sujet avec **#22** (déploiement, backend hébergé).
- **Fenêtre horaire vs DST** : viser 22:00 UTC (=18h ET l'été / 17h ET l'hiver, toujours après clôture 16h ET) — cron UTC fixe, acceptable. Confirmer.
- **Seuil volume** (défaut **100 k$**, décidé au refinement) et **exclusion ETF** : à terme réglables par l'utilisateur (curseur/toggle) → lié à un futur réglage, hors v1.
- **Croisements marginaux** : un cross « du jour » a forcément SMA50 à peine > SMA200 (normal). Option future : exiger une **pente SMA50 positive** pour filtrer les whipsaws. Hors v1.

## Plan technique
1. **Univers TMX** — `backend/src/universe.js` : `fetchUniverse()` → récupère les 2 annuaires TMX, applique conversion suffixe + exclusion ETF, renvoie `[{ticker, exchange}]` (~2300). Mettre en cache 24h dans `kv_store` (clé `golden_cross:universe`) pour éviter 2 requêtes TMX à chaque run. → vérif : longueur ~2300, contient `DOL.TO`, `BIG.V`, **exclut** `TCSH.TO`, `HHL.TO`.
2. **Fetch prix** — dans `scan.js` : `fetchDailyRaw(symbol)` appelle le même endpoint que `yahoo.js` (`CHART` v8, `range=2y&interval=1d`, header UA), extrait `timestamp`, `indicators.quote[0].close` (**brut**) et `.volume`. Pool de concurrence ~10 (petit ordonnanceur maison ou `p-limit`). 429/erreur → retry léger puis skip. → vérif : `DOL.TO` renvoie ≥ 210 closes.
3. **Détection** — `detect(candles)` : SMA50/200, `diff`, golden cross si `diff[n-2] ≤ 0 && diff[n-1] > 0` ; volume $ = moyenne 20 dernières `close×volume` ; garder si `≥ 100_000` (constante `MIN_ADDV`). Renvoie `{close, sma50, sma200, avgDollarVolume, crossDate}` ou `null`. → vérif : sur un jeu figé, retrouve les mêmes hits que le POC (`~/dev/golden-cross-tsx/daily_scan.py`).
4. **Table** — dans `db.js`, ajouter :
   ```sql
   CREATE TABLE IF NOT EXISTS golden_cross_signals (
     ticker TEXT NOT NULL, exchange TEXT NOT NULL, cross_date TEXT NOT NULL,
     close REAL NOT NULL, sma50 REAL NOT NULL, sma200 REAL NOT NULL,
     avg_dollar_volume REAL NOT NULL, currency TEXT, detected_at INTEGER NOT NULL,
     PRIMARY KEY (ticker, cross_date)
   );
   ```
   Méta du dernier run stockée dans `kv_store` (clé `golden_cross:last_run` = `{ran_at, scanned, liquid, signals}`). → vérif : insert idempotent (ON CONFLICT DO NOTHING).
5. **Orchestration** — `scan.js` `runScan()` : univers → fetch (pool) → detect → upsert signaux + méta ; log `scanné/liquides/signaux`. → vérif : exécution manuelle `runScan()` remplit la table.
6. **Scheduler** — dans `index.js`, `node-cron` `0 22 * * 1-5` appelle `runScan()` ; + rattrapage au démarrage si `last_run` > 24h (selon décision Q ouverte). `runScan()` non bloquant (async, pas de `await` bloquant l'`app.listen`). → vérif : cron déclenche ; l'API répond pendant le scan.
7. **Endpoint** — `index.js`, sur le modèle de `/api/candles` (prepared stmt + try/catch → 400) :
   `GET /api/signals/golden-cross?since=YYYY-MM-DD&limit=50` → `{ signals: [...], lastRun: {...} }`, triés `cross_date DESC`. → vérif : renvoie les lignes insérées.
8. **Front — panneau** — `frontend/src/` : composant `GoldenCrossPanel.tsx` qui `fetch('/api/signals/golden-cross')`, liste `ticker · nom · date · close CAD · vol`, **clic → ouvre le symbole** (réutiliser le handler de sélection de symbole de `App.tsx`). Placement : à définir (onglet/volet latéral). → vérif : la liste s'affiche, le clic change le chart.
9. **(Optionnel) Marqueur chart** — au chargement d'un symbole présent dans les signaux, poser un marqueur sur la série bougies : `candleSeries.setMarkers([{ time: cross_date, position:'belowBar', color:'#26a69a', shape:'arrowUp', text:'GC' }])`. → vérif : flèche visible à la bonne date sur `DOL.TO`.

## Notes / risques
- **⚠️ Bug corrigé à ne pas réintroduire** : calculer les SMA sur le **close ajusté des dividendes** décale la SMA200 et crée de **faux golden cross en avance** (constaté sur BAM, HHL, HHLE dans le POC). `yahoo.js` utilise déjà `q.close` (brut) → **utiliser la même donnée brute** dans le scan. Ne jamais basculer sur `adjclose`.
- **ETF/fonds** : sans l'exclusion, les ETF de liquidités (TCSH, TUSD… NAV plat ~50 $) génèrent des croisements permanents parasites. L'exclusion par nom est le garde-fou v1 ; `mapType()` (quoteType Yahoo) pourrait affiner plus tard.
- **Rate limit Yahoo** : le 429 apparaît sur des requêtes rapides répétées. Le POC l'évitait en **batch** ; ici le **pool de concurrence borné (~10) + petit retry** joue le même rôle. Ne pas monter la concurrence agressivement.
- **Perf/robustesse** : ~2300 fetches ≈ 2–4 min. Couverture données Yahoo ~87 % (TSX-V le maillon faible) — le filtre volume absorbe les trous. Un symbole en échec = skip, pas d'arrêt du run.
- **Montée en charge (hors scope, à anticiper)** : signaux **globaux** → 1 scan/jour sert N utilisateurs à coût ~nul. Mais `node:sqlite` mono-fichier/mono-process et Yahoo à la demande ne tiendront pas le multi-utilisateur : migration **Postgres** (lié **#23** compte / **#25** sync) + **feed de données fiable** (lié **#14**) + **worker hébergé** (lié **#22**). Le découplage table `golden_cross_signals` ↔ API ↔ UI rend cette migration transparente pour le front.

## Références
- **POC validé (source de l'algo)** : `~/dev/golden-cross-tsx/`
  - `daily_scan.py` — implémentation de référence (univers TMX + fetch batch + filtre volume + détection, `auto_adjust=False`, exclusion ETF).
  - `build_universe.py` — récupération/normalisation de l'univers TMX → `universe_full.txt`.
  - `universe_full.txt` — snapshot des ~3696 tickers TSX+TSXV (format Yahoo).
- **Code app référencé** :
  - `backend/src/yahoo.js` — endpoint Yahoo `CHART` (l.5), header UA (l.7), parsing `q.close/q.volume` (l.124-135), `getTimeSeries()` (l.79).
  - `backend/src/db.js` — ouverture SQLite `~/.tvlike/tvlike.db` sans WAL (l.7-14), schéma `ohlcv_cache`/`kv_store` (l.16-31).
  - `backend/src/index.js` — pattern endpoints + prepared stmts (l.16-53).
  - Front : SMA 9/50/200 **déjà calculées en journalier** (voir ROADMAP « SMA restent en JOUR »), rendu bougies via `lightweight-charts`.
- **Backlog lié** : #13 (Alerte SMA/prix — mécanisme de notif réutilisable), #14 (Données temps réel — feed), #22 (Déploiement — backend 24/7), #23/#25 (Compte / Sync — multi-utilisateur).
