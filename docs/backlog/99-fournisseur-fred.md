# #99 — Fournisseur FRED + catégorie Économie (enfant 2 de #97)

**Statut** : 🧪 À valider (UAT) · **Points** : 5 · **Catégorie** : ⚙️ Technique · **Taille** : M
**Parent** : [#97 — Épopée : Sources de marché](97-epopee-sources-de-marche.md)

## Objectif
Brancher un **deuxième fournisseur** — FRED, Federal Reserve Bank of St. Louis — pour les séries
macro que Yahoo n'a pas, à commencer par `US10Y-US02Y` de la capture du 05/09. C'est le ticket qui
prouve que le socle #98 tient : ajouter une source ne doit toucher ni Yahoo, ni le front, ni les
907 titres.

## Décisions
- **Routage par préfixe de ticker** : `FRED:T10Y2Y`. La route `/candles` existante dispatche, donc
  aucune nouvelle route, aucun nouveau contrat d'API, et l'agrégation hebdo/mensuelle est réutilisée
  telle quelle (`AGG` et `aggregate` de `yahoo.js` sont simplement exportés, pas recopiés).
- **Pas de clé** : lire une série FRED n'en demande pas. La clé ne servira qu'à la recherche par
  mots-clés, qui n'est pas de ce ticket — donc `US10Y-US02Y` marche sans que Jean se soit inscrit.
- **Historique borné à 30 ans** (`cosd`) : `DFF` remonte à 1954 et pèserait 26 000 points pour un
  graphique qui en montre 2 500.
- **Cache en mémoire côté Edge Function, pas dans `bars`.** Sept séries × ~7 700 points
  regonfleraient la base Supabase, déjà saturée une fois (audit du 31/08). Le backend Node, lui,
  utilise son cache SQLite habituel — il est local et gratuit.
- **Bougies plates en journalier assumées** : une série FRED n'a qu'une valeur par jour, donc
  open = high = low = close. En hebdo/mensuel, l'agrégation reconstitue de vraies bougies.

## Critères d'acceptation
- [x] `US10Y-US02Y` affiche **0,41** au 04/09/2026 — la valeur de la capture TradingView.
- [x] L'onglet **Économie** existe et filtre.
- [x] Chercher « courbe », « inversion », « chômage », « inflation », « fed » trouve la série.
- [x] La colonne des prix affiche **%** et non une devise.
- [x] SMA et RSI se calculent sur la série.
- [x] Les intervalles agrégés fonctionnent (mensuel : O 0,40 H 0,43 B 0,40 C 0,41).
- [x] `/quotes` mélange les deux fournisseurs dans une seule réponse.
- [x] Yahoo, les synthétiques et les 13 instruments de #98 sont inchangés.

## Recette — 05/09/2026

Les 7 séries livrées, bout en bout par le chemin de l'app :

| Symbole | Ticker | Points | Dernier |
|---|---|---|---|
| US10Y-US02Y | `FRED:T10Y2Y` | 7 676 | 04/09 = **0,41 %** |
| US10Y-US03M | `FRED:T10Y3M` | 7 676 | 04/09 = 0,87 % |
| US10Y | `FRED:DGS10` | 7 675 | 03/09 = 4,77 % |
| US02Y | `FRED:DGS2` | 7 675 | 03/09 = 4,34 % |
| FEDFUNDS | `FRED:DFF` | 11 204 | 03/09 = 3,63 % |
| USUNEMP | `FRED:UNRATE` | 367 | 08/2026 = 4,1 % |
| USCPI | `FRED:CPIAUCSL` | 366 | 07/2026 = 332,813 |

- Graphique : `US10Y-US02Y 0,41 ▼ −4,65 %`, légende « Courbe des taux US — 10 ans moins 2 ans »,
  SMA 9/50/150/200/400 calculées (0,43 · 0,41 · 0,48 · 0,52 · 0,50), unité **%**.
- Écart avec TradingView : la valeur est identique (0,410) ; la variation diffère (−4,65 % contre
  −5,09 %) parce que la clôture précédente de FRED est 0,43 et celle de TVC 0,432.
- `npx tsc -b` et `deno check` : aucune erreur.

## Notes / risques
- `curl` échoue sur le domaine FRED depuis ce Mac (HTTP/2, erreur 92) alors que `fetch` passe.
  Ne pas conclure à une indisponibilité en testant à la main avec `curl`.
- La recherche FRED par mots-clés (les ~800 000 séries) reste à faire et demandera la clé —
  ticket à part. Aujourd'hui le catalogue est celui de ce fichier, écrit à la main.
- `USCPI` est un **indice de niveau**, pas un taux d'inflation. Afficher l'inflation en %
  demanderait un calcul glissant sur 12 mois — hors périmètre, à décider si Jean le veut.
