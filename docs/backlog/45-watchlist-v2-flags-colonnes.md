# #45 — Watchlist v2 · flags & colonnes (Phase C)

**Statut** : 🧪 À valider · **Points** : 3 · **Catégorie** : 🎨 Cosmetic · **Taille** : S · **Priorité** : —

> **UAT** : déployé + vérifié en ligne. Flags (clic droit → 6 couleurs + retirer, rond coloré, persistant). Colonnes Dernier/Volume (menu ⋯), `/quotes` renvoie `volume`. **Compromis largeur** : les 2 colonnes + Chg% dans un volet ~300px → tickers longs ellipsés (« BTCX-… ») ; acceptable, mais candidat **Phase D** (volet redimensionnable / plus large, ou masquer le logo quand colonnes actives). Colonnes remises **off par défaut**.

## Objectif
Deux finitions du volet watchlist : **marqueurs de couleur** (flags) pour taguer des symboles, et **colonnes optionnelles** (Dernier prix, Volume) en plus du Chg%.

## Critères d'acceptation
- [ ] **Clic droit sur un symbole** → menu avec ~6 couleurs + « Retirer le marqueur » → pose/retire un **flag coloré** sur la ligne.
- [ ] Le flag s'affiche comme **petit rond coloré** avant le ticker ; persiste (dans l'item, sync cloud).
- [ ] Menu **⋯ → Colonnes** : cases **Dernier prix** et **Volume** (Chg% toujours affiché).
- [ ] Colonnes activées → visibles dans **l'entête** et **chaque ligne**, alignées à droite, compactes.
- [ ] **Volume** ajouté à l'endpoint `/quotes` (meta v8, pas de requête par ligne).
- [ ] Préférences de colonnes **persistées** (localStorage + cloud).
- [ ] Pas de régression Phase A/B (logos, Chg%, tri, volet détail, drag & drop).

## Décisions
- **Flags = clic droit** (réutilise le pattern du menu contextuel des sections). Palette fixe (rouge/orange/vert/bleu/violet/sarcelle) + retirer.
- **Colonnes** activées via **⋯ → Colonnes** (cases). Ordre d'affichage : Dernier · Volume · Chg%.
- **Volume dans `/quotes`** (`meta.regularMarketVolume`) — évite un appel détail par ligne. Prix « Dernier » = `price` déjà renvoyé.
- **Persistance colonnes** : clé `tvlike:wl-columns` (sync cloud, comme le reste).

## Questions ouvertes
- Sens du flag laissé libre à l'utilisateur (achat/vente/surveiller…) — pas de sémantique imposée.
- Largeur du volet : 3 colonnes numériques + logo + ticker = serré ; police compacte, on verra si un scroll horizontal est nécessaire (a priori non).

## Plan technique
1. **Modèle** — `WLItem.flag?: string` (hex) dans `collections.ts`. → vérif : persiste + resync.
2. **`/quotes` + volume** — ajouter `volume: meta.regularMarketVolume` (Edge Function + backend) ; `Quote.volume` côté front. → vérif : `/quotes` renvoie `volume`.
3. **Flags UI** — `WatchlistPanel` : `onContextMenu` sur les lignes symbole → menu couleurs (réutilise `.wl-menu`/`.wl-ctx`) ; `setFlag(itemId, color|null)`. Rendu : `.wl-flag` (rond coloré) avant le ticker. → vérif : pose/retrait, persistance.
4. **Colonnes** — état `cols {last, volume}` (persisté `tvlike:wl-columns`) ; menu ⋯ « Colonnes » (cases) ; entête + lignes rendent les cellules actives (compact FR). → vérif : toggle live, aligné.
5. **Styles** — `styles.css` : `.wl-flag`, cellules colonnes. → vérif : clair + sombre, pas de débordement.
6. **Déploiement** — Edge Function (volume) + push ; vérif en ligne.

## Notes / risques
- **Deux backends** : ajouter `volume` à `/quotes` **des deux** (parité).
- **Lié** : #43/#44 (réutilise `/quotes`, logo, fmt). Clôt l'épopée Watchlist v2 (A+B+C).
