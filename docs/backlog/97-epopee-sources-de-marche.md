# #97 — Épopée : Sources de marché

**Statut** : 🔍 Affiné · **Points** : ~34 (estimé) · **Catégorie** : ⚙️ Technique · **Taille** : XL

## Objectif
TVLite ne lit qu'une source — Yahoo Finance — et n'affiche que ce que son moteur de recherche
veut bien renvoyer. Conséquence : des instruments que Jean suit tous les jours sur TradingView
sont inaffichables ici, et ceux qui le sont restent introuvables faute de savoir leur ticker Yahoo.
Introduire un **registre d'instruments** et un **routage par fournisseur** : Yahoo devient un
fournisseur parmi d'autres, et n'importe quelle série — marché, macro, valorisation — devient un
symbole TVLite de plein droit.

## Le déclencheur — constat du 05/09/2026
Captures de la section « ANALYSE TECHNIQUE » de la watchlist TradingView *Investing 2026*.
Les 10 lignes, vérifiées une par une contre les sources réelles le 05/09 :

| TradingView | Équivalent TVLite | État |
|---|---|---|
| XWD | `XWD.TO` | ✅ déjà chargeable |
| SPX | `^GSPC` | ✅ déjà chargeable |
| QQQ | `QQQ` | ✅ déjà chargeable |
| TLT | `TLT` | ✅ déjà chargeable |
| CAC40 | `^FCHI` | ✅ déjà chargeable |
| GOLD | `GC=F` | ✅ déjà chargeable (clôtures du 04/09 : 4 429,80 vs 4 427,90 spot, **0,04 %**) |
| USOIL | `CL=F` | ✅ déjà chargeable (91,48 vs 91,23) |
| VIX | `^VIX` | ✅ déjà chargeable |
| US10Y-US02Y | FRED `T10Y2Y` | ❌ fournisseur absent — testé : **0,41**, identique à TradingView |
| SP500_PE_RATIO_MONTH | multpl.com | ❌ fournisseur absent — testé : **26,36**, identique à TradingView |

**Huit lignes sur dix sont déjà chargeables aujourd'hui** : le mur n'est pas la donnée, c'est que
rien dans TVLite ne dit que « GOLD » se charge sous `GC=F`. Deux défauts annexes constatés :

- `mapType()` range `future` et `currency` dans une catégorie `"autre"` **pour laquelle aucun
  onglet n'existe** (`backend/src/yahoo.js`) — les résultats existent et sont inatteignables.
- Les codes de bourse `CMX`, `NYM`, `CBT`, `CME`, `NYB` manquent aux tables `EXCHANGES` et
  `EXCHANGE_COUNTRY` → code brut affiché, pays « Autre ».

## Décisions actées (refinement du 05/09)
- **Un registre d'instruments, pas une table d'alias.** Écarté explicitement par Jean : « j'ai
  l'impression que c'est un workaround ». Un instrument TVLite porte son nom, sa catégorie, son
  fournisseur et le ticker de ce fournisseur — comme `TVC:GOLD` chez TradingView est un nom
  au-dessus d'un flux, pas une redirection.
- **Le patron existe déjà** : `EQ.SYNTH` et `MOM.SYNTH` sont des symboles TVLite natifs injectés
  dans la recherche par `syntheticHits()` (`lib/portfolios.ts`, `components/SymbolSearch.tsx`).
  L'épopée finit ce dessin au lieu de le contourner.
- **Six fournisseurs** : Yahoo (défaut), FRED, multpl, Banque du Canada (Valet), BCE via
  Frankfurter, CoinGecko. Tous testés joignables le 05/09.
- **La source est affichée dans les résultats de recherche et changeable**, façon TradingView
  (« on changera plus tard si ça ne le fait pas »). Construite **en dernier** : voir Notes.
- **L'or reste `GC=F`** — mesuré à clôtures comparables, l'écart avec le spot est de 0,04 %
  (4 429,80 contre 4 427,90 le 04/09), pas le ~1 % annoncé au refinement : ce chiffre-là
  comparait le prix live du future à la clôture de la capture. Aucune lecture technique n'est affectée.
  Au passage, c'est le contrat coté au NYMEX/COMEX, pas la cotation d'un courtier CFD.
- **Clé FRED** : Jean crée un compte gratuit et pose `FRED_API_KEY` dans `backend/.env`
  (ignoré par git, `.gitignore:8` — le dépôt est public). Secret Supabase côté prod.

## Critères d'acceptation (épopée)
- [ ] Les **10 lignes** du tableau ci-dessus s'affichent dans TVLite avec bougies, SMA et RSI.
- [ ] `US10Y-US02Y` affiche 0,41 au 04/09/2026 ; `SP500_PE_RATIO_MONTH` affiche 26,36.
- [ ] Chaque résultat de recherche **indique sa source**.
- [ ] Les onglets **Contrats à terme**, **Forex** et **Économie** existent et filtrent.
- [ ] Chercher « gold », « pétrole » ou « CAC 40 » mène à l'instrument sans connaître le ticker.
- [ ] Une collection « Analyse technique » reprend les 10 lignes, prête à l'emploi.
- [ ] **Les 907 titres et les synthétiques existants sont inchangés** — Yahoo reste le défaut.

## Ordre de travail (enfants)
*Numérotés au moment de leur écriture — un numéro n'existe que quand le fichier existe.*

1. **Socle multi-fournisseurs** *(8)* — registre d'instruments, routage, Yahoo ramené au rang de
   fournisseur. **Bloquant pour tout le reste.**
2. **FRED + catégorie Économie** *(5)* — débloque `US10Y-US02Y` et l'onglet macro.
3. **multpl** *(3)* — le PE du S&P 500.
4. **Catalogue + onglets** *(5)* — Contrats à terme / Forex / Économie, collection livrée,
   correction des codes de bourse manquants.
5. **Banque du Canada + BCE + CoinGecko** *(5)*.
6. **Recherche multi-source et choix de la source** *(8)*.

**Après l'étape 2, les 10 lignes des captures fonctionnent.** Le reste est de l'ouverture.

## Questions ouvertes
- Le catalogue initial n'est pas figé : Jean a indiqué que les 10 lignes sont **un échantillon**.
  Le reste de sa liste TradingView est à collecter avant l'enfant 4.
- Découpage validé sur le principe, mais les enfants n'ont pas encore de spec propre.
- `TWELVE_DATA_API_KEY` dort dans `backend/.env` et `.env.example` sans être référencée nulle part
  dans le code. Twelve Data ferait le XAU/USD spot — 7ᵉ fournisseur possible, à trancher.

## Hors périmètre
Temps réel (voir #14, wont-do) · les courtiers CFD (OANDA, FXCM, Capital.com… : ce sont des
cotations d'intermédiaires du même sous-jacent, pas des sources distinctes) · les alertes.

## Notes / risques
- **multpl est du grattage de page HTML.** Ça marche aujourd'hui, ça cassera le jour où le site
  changera sa mise en page. C'est le prix d'une donnée que personne ne publie proprement —
  TradingView la tire du même endroit. Prévoir un garde-fou et un échec silencieux.
- **Le sélecteur de source n'aura d'intérêt que pour les devises.** Nos six fournisseurs ne se
  recouvrent presque pas : GOLD, USOIL, CAC40, SPX, VIX n'auront qu'une ligne (Yahoo) ; seul
  USD/CAD en aura trois (Yahoo, Banque du Canada, BCE) — et là l'écart taux officiel / taux de
  marché est réel. D'où la place en dernier dans l'ordre : Jean juge sur pièce avant les 8 points.
- **Double implémentation** : tout fournisseur doit exister côté backend Node **et** côté Edge
  Function Supabase (`supabase/functions/tvlite-api/index.ts`) — c'est déjà le cas pour Yahoo.
- La recherche FRED exige la clé ; **la lecture des séries, non**. Un échec de clé doit dégrader
  vers un catalogue figé, pas casser la recherche.
- `curl` échoue sur FRED depuis ce Mac (HTTP/2, erreur 92) alors que `fetch` de Node passe :
  utiliser `fetch`, ne pas conclure à une indisponibilité.
