# #43 — Watchlist v2 · logos + Chg% live (Phase A)

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : 🎨 Cosmetic · **Taille** : M · **Priorité** : —

> **UAT** : déployé et vérifié en ligne — `/quotes` (Edge Function v6) OK, logos réels (US) + fallback monogramme (ETF canadiens), Chg% coloré, tri par section. Backend local `/api/quotes` ajouté (non redémarré ici → à retester en dev au besoin).

## Objectif
Enrichir le volet watchlist (`WatchlistPanel.tsx`) façon TradingView : chaque ligne affiche un **logo**, le **ticker** et sa **variation du jour (Chg%)** colorée, avec **tri** par variation. C'est la 1ʳᵉ des 3 phases (B = volet détail #44, C = flags de couleur #45).

## Critères d'acceptation
- [ ] Chaque ligne de symbole montre : **logo** (à gauche) · **ticker** · **Chg% du jour** coloré (vert hausse / rouge baisse), aligné à droite.
- [ ] Le **logo** vient d'un fournisseur réel par ticker ; si indisponible → **monogramme** (initiale + couleur dérivée du ticker). **Jamais** d'image cassée.
- [ ] Le **Chg%** est la variation journalière = `(dernier close − close veille) / close veille`, récupérée via un **endpoint `/quotes` groupé** (pas 1 requête par ligne côté front).
- [ ] Clic sur l'entête **« Chg% »** → **trie** les symboles **dans chaque section** (les sections restent groupées), bascule croissant/décroissant ; un 3ᵉ clic revient à l'ordre manuel (drag & drop).
- [ ] La **ligne active** (symbole affiché) garde sa mise en évidence (barre d'accent à gauche).
- [ ] Fonctionne sur le **site déployé (Supabase)** ET en **local** (endpoint ajouté aux deux backends).
- [ ] Les quotes sont **mises en cache** côté serveur (~60 s) et **rafraîchies** pendant que le volet est ouvert (cadence à confirmer, cf. Q ouverte).
- [ ] Pas de régression : sections repliables, drag & drop, renommer/supprimer, favoris — tout continue de marcher.

## Décisions
- **Chg% = version LIVE colorée** — supersède l'ancienne colonne « CHG% » retirée (elle était **statique/vide**, donc « désuète » ; ici elle est live et utile, comme TradingView). *(Décidé avec Jean.)*
- **Source Chg% = Yahoo v8 `chart`** (`range=5d&interval=1d`), **sans `crumb`** — on prend les 2 derniers closes + `meta.currency` / `meta.marketState`. On **évite volontairement** l'API v7 `quote` (batch mais exige cookie+crumb, cf. galère GCR) ; les stats riches (volume moyen, capitalisation) qui *imposent* v7/quoteSummary sont repoussées en **Phase B (#44)**.
- **Logos = vrais logos** *(choix Jean)* via `<img>` + **fallback monogramme** sur `onError`. Logique 100 % front (pas de proxy image).
- **Fallback = monogramme** *(confirmé Jean)* : quand aucun logo n'est trouvé, afficher le **monogramme coloré de la maquette** (initiale(s) du ticker + couleur dérivée du ticker), pas d'icône générique. C'est le rendu par défaut garanti.
- **Tri par section** : on ne mélange pas les sous-catégories ; on trie à l'intérieur. Défaut = ordre manuel conservé.
- **Périmètre Phase A** = logos + Chg% + tri + polish ligne active. **Volet détail = #44**, **flags de couleur = #45**.

## Questions ouvertes
- **Fournisseur de logos** : la couverture **TSX / ETF canadiens** (`.TO`, `.V`) est le vrai risque. Clearbit exige le **domaine** (pas le ticker). Pistes par ticker : FMP `image-stock`, CDN type `assets.parqet.com`… → **à évaluer** ; démarrer avec **1 fournisseur + fallback monogramme** (fallback déjà tranché, cf. Décisions), gérer le **suffixe de bourse** (retirer `.TO`/`.V` ou le mapper selon le fournisseur). La couverture n'est plus bloquante grâce au fallback : là où le logo manque, monogramme.
- **Cadence de rafraîchissement** : à l'ouverture du volet seulement, ou **polling ~60 s** tant qu'ouvert ? (proposition : polling 60 s, coupé quand le volet est fermé.)
- **Devise** : afficher la devise près du Chg% ? (non en Phase A ; réservé au volet détail #44.)

## Plan technique
1. **Endpoint `/quotes`** — `supabase/functions/tvlite-api/index.ts` **et** `backend/src/` (parité). `GET /quotes?symbols=A,B,C` → pour chaque symbole : Yahoo v8 `chart` `range=5d&interval=1d`, extraire `close` (2 derniers non-null) + `meta.currency`/`meta.marketState` → `{ symbol, price, prevClose, changePct, currency, marketState }`. **Pool de concurrence** borné (~8), **cache mémoire ~60 s** par symbole. → vérif : `curl '/quotes?symbols=DOL.TO,AAPL'` renvoie 2 objets avec `changePct`.
2. **Lib front `quotes.ts`** — `fetchQuotes(symbols)` (dédup, appel groupé) ; petit hook/état dans `WatchlistPanel` pour charger les quotes de la collection courante + **rafraîchir** (cf. cadence). → vérif : ouverture du volet peuple les Chg%.
3. **Composant `SymbolLogo.tsx`** — `<img src={logoUrl(sym)} onError={() => setFailed(true)}>` ; si `failed` → monogramme (`<span>` couleur = hash du ticker, initiale(s)). `logoUrl()` gère le suffixe de bourse. → vérif : un ticker sans logo affiche le monogramme, pas d'icône cassée.
4. **`WatchlistPanel.tsx`** — refondre `.wl-row` : `SymbolLogo` + `.wl-sym` + **cellule Chg%** (`.wl-chg up/dn`). Entête `.wl-cols` : ajouter **« Chg% » cliquable** (état de tri `none|asc|desc`), tri **par section** au rendu du `body`. Garder drag & drop / remove au survol. → vérif : tri bascule, sections intactes.
5. **Styles** — `styles.css` : `.wl-row` (grille logo/sym/chg), `.wl-logo`/monogramme, `.wl-chg.up`/`.dn`, entête triable, barre d'accent ligne active. → vérif : rendu propre clair **et** sombre.
6. **Vérif finale** — déployé (Supabase) + local ; watchlist avec ~10 symboles mixtes (US + TSX) ; logos présents ou monogrammes ; Chg% cohérents avec le marché.

## Notes / risques
- **Deux backends** : le site en ligne (GitHub Pages) tape **Supabase** (`tvlite-api`), le dev tape **`backend/`**. Ajouter `/quotes` **aux deux** pour la parité (comme les autres routes).
- **Coût requêtes** : N symboles = N appels v8 côté serveur ; borné par le pool + cache 60 s. Une watchlist de 30 symboles reste raisonnable. Un vrai batch (1 requête) nécessiterait v7/crumb → repoussé.
- **Logos** = principal inconnu (couverture TSX). Le fallback monogramme garantit un rendu correct quoi qu'il arrive ; c'est le filet de sécurité.
- **CSP** : le site GitHub Pages n'a pas la CSP stricte des artifacts → les `<img>` externes chargent normalement.
- **Lié** : #44 (Phase B — volet détail : nom, bourse, prix, statut marché, **stats clés** Volume / Volume moyen (30) / Capitalisation) · #45 (Phase C — flags de couleur, colonnes optionnelles) · réutilise l'endpoint quotes (étendu en B).
