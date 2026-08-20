# #44 — Watchlist v2 · volet détail (Phase B)

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : 🎨 Cosmetic · **Taille** : M · **Priorité** : —

> **UAT** : déployé + vérifié en ligne. `/quote-detail` (Edge Function v7, crumb OK). AAPL → Apple Inc. · NasdaqGS · Action · 311,30 USD · −1,75% · Après-bourse · Vol 32,92 M · Vol moyen 56,63 M · Cap 4,54 Bn. HXS.TO (ETF) → cap « — » (gracieux). Se met à jour au changement de symbole. Backend local `/api/quote-detail` ajouté (non redémarré ici).

## Objectif
Ajouter en bas du volet watchlist un **panneau détail du symbole affiché** (façon TradingView) : logo + nom, bourse + catégorie, **prix + variation**, **statut du marché**, et **stats clés** (Volume, Volume moyen (30), Capitalisation).

## Critères d'acceptation
- [ ] Sous la liste, un panneau montre le **symbole courant** (celui du chart) : logo + ticker + **nom complet**.
- [ ] Ligne méta : **bourse** · **catégorie** (Action/ETF/Fonds…).
- [ ] **Prix** en gros + **devise** + **variation** (absolue + %) colorée (vert/rouge).
- [ ] **Statut marché** : pastille + texte (« Marché ouvert » vert / « Fermé » / « Pré-marché » / « Après-bourse »).
- [ ] **Stats clés** : **Volume**, **Volume moyen (30)**, **Capitalisation** — formatées compact FR (K / M / Md), « — » si indisponible.
- [ ] Se met à jour quand on change de symbole (clic sur une ligne → chart → panneau).
- [ ] Fonctionne en ligne (Supabase) ; **dégradation gracieuse** si les stats riches manquent (affiche ce qu'on a + « — »).

## Décisions
- **Stats = Volume + Volume moyen (30) + Capitalisation** *(choix Jean, « comme sur ton screenshot »)*.
- **Source = v7 `quote` avec crumb** (nouvel endpoint `/quote-detail?symbol=X`) : la liste garde son `/quotes` léger en v8 (Phase A), seul le symbole **sélectionné** paie le coût du crumb. Fallback gracieux si le crumb échoue.
- **Panneau = symbole du chart** (`currentSymbol`), pas une sélection séparée — cohérent avec le reste de l'app.

## Questions ouvertes
- **Capitalisation vs AUM** : v7 `quote.marketCap` existe pour actions et beaucoup d'ETF ; sinon « — ». (AUM précis des fonds = `quoteSummary` — repoussé si non nécessaire.)
- **Crumb** : cookie Yahoo + `getcrumb` mis en cache ~1 h côté serveur ; à surveiller (consentement UE, rotation).

## Plan technique
1. **Crumb** — Edge Function + backend : `getCrumb()` (GET cookie `fc.yahoo.com` → `v1/test/getcrumb`), caché ~1 h. → vérif : renvoie un crumb non-HTML.
2. **Endpoint `/quote-detail?symbol=X`** — v7 `quote?symbols=X&crumb=…` (cookie) → `{ symbol, longName, exchange, quoteType, currency, price, change, changePct, prevClose, marketState, volume, avgVolume, marketCap }`. Cache ~60 s. → vérif : `curl` renvoie les stats pour `AAPL` et un ETF.
3. **Front `api.ts`** — `fetchQuoteDetail(symbol)` + type `QuoteDetail`.
4. **Front — panneau** — dans `WatchlistPanel`, sous `.wl-body` : `WatchlistDetail` chargé sur `currentSymbol`. Logo + nom, bourse·catégorie, prix+variation, statut marché, stats (fmt compact FR). → vérif : change avec le symbole.
5. **Styles** — `styles.css` : `.wl-detail*`. → vérif : clair + sombre.
6. **Déploiement** — Edge Function + push ; vérif en ligne.

## Notes / risques
- **Deux backends** : ajouter `/quote-detail` **aux deux** (parité, comme `/quotes`).
- **Crumb fragile** : si indisponible, le panneau retombe sur les champs de `/quotes` (prix/variation) + « — » pour volume moyen / capitalisation. Ne jamais casser l'affichage.
- **Lié** : #43 (Phase A, réutilise logo + fmt), #45 (Phase C — flags & colonnes).
