# #98 — Socle multi-fournisseurs (enfant 1 de #97)

**Statut** : 🧪 À valider (UAT) · **Points** : 8 · **Catégorie** : ⚙️ Technique · **Taille** : L
**Parent** : [#97 — Épopée : Sources de marché](97-epopee-sources-de-marche.md)

## Objectif
Poser le **registre d'instruments** et la **résolution par fournisseur** : un symbole TVLite porte
son nom, sa catégorie, son fournisseur et le ticker de ce fournisseur. Yahoo cesse d'être « la »
source pour devenir la première d'une liste. Livrer avec les instruments Yahoo des captures du
05/09, pour que le socle soit vérifiable et pas de la plomberie invisible.

## Décisions
- **Le registre vit côté client** (`lib/instruments.ts`), résolu au bord dans `lib/api.ts` — même
  patron que les synthétiques (`isSynthetic()` / `syntheticHits()` dans `portfolios.ts`). Motif :
  une seule implémentation, alors qu'un registre backend devrait être écrit deux fois (Node **et**
  Edge Function). Les fournisseurs qui exigent un serveur (FRED, multpl) auront leur route en #97-2/3.
- **Onglets calqués sur TradingView** : « Contrats à terme » et « Forex ». Pas d'onglet « Matières
  premières » — TradingView n'en a pas, l'or et le pétrole sont des contrats à terme.
- **Le symbole affiché reste le symbole TVLite** : le graphique montre `GOLD`, la donnée vient de
  `GC=F`. La source est lisible dans la ligne de résultat.
- Un symbole absent du registre passe **inchangé** vers Yahoo — les 907 titres ne bougent pas.

## Critères d'acceptation
- [x] `GOLD`, `SILVER`, `USOIL`, `BRENT`, `CAC40`, `SPX`, `TSX`, `VIX`, `XWD`, `USDCAD`, `EURUSD`,
      `EURCAD` s'affichent avec bougies, SMA et RSI.
- [x] Chercher « or », « argent », « pétrole », « cac », « huard » (en français) trouve l'instrument.
- [x] Les onglets **Contrats à terme** et **Forex** existent et filtrent.
- [x] Un future Yahoo hors registre (ex. `HO=F`) est atteignable via l'onglet Contrats à terme.
- [x] La bourse affichée est lisible (« COMEX », « NYMEX »), plus le code brut `CMX`/`NYM`.
- [x] Le ticker Yahoo reste visible dans la ligne de résultat — on doit voir d'où vient le cours.
- [x] Une action ordinaire (`AAPL`), un ETF (`ZEQT.TO`) et les synthétiques sont inchangés.

## Plan technique
1. `lib/instruments.ts` : type `Instrument`, catalogue, `resolveTicker()`, `instrumentHits()`.
2. `lib/api.ts` : résolution dans `rawFetchCandles`, `fetchQuotes`, `fetchQuoteDetail` ; la réponse
   reconserve le symbole TVLite. → vérif : `GOLD` renvoie la courbe de `GC=F`.
3. `SymbolSearch.tsx` : injection des entrées du registre (comme `syntheticHits`), deux onglets.
4. `backend/src/yahoo.js` **et** `supabase/functions/tvlite-api/index.ts` : `mapType()` sort
   `future` et `currency` de la catégorie `"autre"` (bug : aucun onglet ne l'affiche) ; ajout des
   codes `CMX`, `NYM`, `CBT`, `CME`, `NYB` aux tables `EXCHANGES` et `EXCHANGE_COUNTRY`.

## Notes / risques
- `fetchCandles` est appelée en interne avec de vrais tickers (`ETF_TICKERS`, panier duo) :
  la résolution doit être **neutre** sur un symbole absent du registre.
- Ne pas toucher `DrawingLayer.tsx` : les dessins sont indexés par symbole affiché, donc par le
  symbole TVLite — c'est le comportement voulu, un dessin sur `GOLD` suit `GOLD`.

---

## Recette — 05/09/2026 (à valider par Jean)

Vérifié dans le navigateur sur `localhost:5173`, backend Node + Yahoo.

**Les 13 instruments du registre**, tous à ~2 500 bougies journalières (10 ans), clôture du 04/09 :

| Symbole | Ticker | Clôture | Symbole | Ticker | Clôture |
|---|---|---|---|---|---|
| SPX | `^GSPC` | 7 718,60 USD | GOLD | `GC=F` | 4 429,80 USD |
| CAC40 | `^FCHI` | 8 278,77 EUR | SILVER | `SI=F` | 66,05 USD |
| TSX | `^GSPTSE` | 36 513,80 CAD | USOIL | `CL=F` | 91,48 USD |
| VIX | `^VIX` | 14,53 USD | BRENT | `BZ=F` | 96,28 USD |
| XWD | `XWD.TO` | 124,25 CAD | USDCAD | `CAD=X` | 1,3837 CAD |
| EURUSD | `EURUSD=X` | 1,1621 USD | CADEUR | `CADEUR=X` | 0,6220 EUR |
| EURCAD | `EURCAD=X` | 1,6069 CAD | | | |

- **Chemin complet** : sélectionner USOIL dans la recherche déclenche
  `GET /api/candles/CL%3DF` (affichage **et** source SMA 30 ans) ; l'onglet du navigateur
  affiche `USOIL 91,48`. Le symbole TVLite est ce qu'on voit, le ticker ce qu'on interroge.
- **Recherche en français** : « argent » → SILVER · « cac » → CAC40 · « huard » → USDCAD, CADEUR ·
  « volatilité » → VIX · « monde » → XWD · « pétrole » → USOIL, BRENT (avant les actions pétrolières).
- **Onglets** : « Contrats à terme » ne laisse que GOLD, BRENT et `OJ=F` — donc un future Yahoo
  **hors registre** reste atteignable, ce qui était le point du correctif.
- **Bourses** : `OJ=F` s'affiche « ICE US » au lieu du code brut `NYB`.
- **Source visible** : chaque entrée du registre porte son badge « yahoo · GC=F ».
- **Doublon supprimé** : chercher « gold » ne renvoie plus GOLD *et* GC=F.
- **Quotes** : `fetchQuotes(['GOLD','USDCAD','CAC40','AAPL'])` répond indexé par symbole TVLite —
  la watchlist retrouvera ses lignes. CAC40 à −0,09 %, identique à la capture TradingView du 05/09.
- **Témoins inchangés** : `AAPL` (2 514 bougies), `ZEQT.TO` (1 148), et les synthétiques tirent
  toujours leurs 5 ETF directement. `resolveTicker` est neutre hors registre.
- `npx tsc -b` : aucune erreur.

**Non couvert** : les codes de bourse chinois (`SHZ`, `SHH`) et `DXE` (Cboe Europe) restent
non traduits — hors périmètre de ce ticket, signalé pour l'enfant « catalogue ».
