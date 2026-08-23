# Roadmap — TV-Like (backlog scrum)

**Échelle d'effort (story points, Fibonacci)** : 1–2 = trivial · 3 = petit · 5 = moyen · 8 = gros · 13 = très gros / incertain
**T-shirt** : XS / S / M / L / XL
**Catégories (colonne `Cat`)** : 🧩 Fonctionnalité · 💼 Portefeuille · 🎨 Cosmetic · ⚙️ Technique · 🚀 Publication · ⭐ = priorité
**Priorité = ordre des lignes** (haut = prochain). Déplacer un ticket = réordonner sa ligne.
**Process** : voir [`docs/WORKFLOW.md`](docs/WORKFLOW.md) · détail des tickets affinés dans [`docs/backlog/`](docs/backlog/) · statuts : 📥 Backlog → 🔍 Affiné → 🏗️ En cours → 🧪 À valider → ✅ Fait

---

## 🔍 Prêt (DoR)  *— affinés, priorisés par l'ordre*

> ⏸️ **#50 à #55 sont en pause** (décision du 22/08) : on remet l'analyse technique et le rapport mensuel de côté
> le temps d'assainir le socle. Le code du labo reste dans `labo/`, inoffensif. Résultats archivés dans
> [`docs/archive/labo-resultats-2026-08-22.md`](docs/archive/labo-resultats-2026-08-22.md).

### 🎯 Épopée [**#47 — Un seul produit**](docs/backlog/47-epopee-un-seul-produit.md)  *(~60 pts)*
> TVLite scrape la bourse canadienne, trie techniquement, dépose chaque mois une **collection** + des **positions longues justifiées**, et **Jean décide**.
> Principe : **le momentum trie, la technique raconte** — trois emplacements distincts (**trier** / **filtrer** / **interrupteur**).
> Absorbe **#39**, **#40**, **#41**, **#42**. Porte de validation en **#52** : rien d'exécutif avant l'accord.

| # | Item | Cat | Pts | Taille | ⭐ | Statut |
|---|------|:---:|:---:|:---:|:---:|---|
| [**48**](docs/backlog/48-reconciliation-cloud.md) | **Réconciliation cloud ↔ local** (cloud-clobber) — *bloquant #54* | ⚙️ | 5 | M | ⭐ | ✅ |
| [**49**](docs/backlog/49-terrain-unifie.md) | **Une seule base** — robots coupés, ancien monde jeté, 907 titres / 650 à historique complet + 20 ETF de référence | ⚙️ | 8 | L | ⭐ | 🧪 |
| [**50**](docs/backlog/50-labo-mesure-cli.md) | **Labo de mesure (CLI)** — trier/filtrer/interrupteur, benchmark apparié, cartouches | 💼 | 13 | XL | ⭐ | ⏸️ |
| [**51**](docs/backlog/51-page-recherche.md) | **Page « Recherche »** (lecture seule) — tableau comparatif des jeux de règles | 🧩 | 5 | M | | ⏸️ |
| [**52**](docs/backlog/52-exploration-decision-strategie.md) | **Exploration & décision de stratégie** — *porte, accord de Jean requis* | 💼 | 8 | L | ⭐ | ⏸️ |
| [**53**](docs/backlog/53-pipeline-mensuel.md) | **Pipeline mensuel** — `reco.runs` / `reco.items`, Weinstein en interrupteur | 💼 | 8 | L | | ⏸️ |
| [**54**](docs/backlog/54-restitution-tvlite.md) | **Restitution TVLite** — collection + dessins `longpos` **fusionnés** + panneau Reco | 🧩 | 8 | L | ⭐ | ⏸️ |
| [**55**](docs/backlog/55-rapport-mensuel.md) | **Rapport mensuel** (HTML autonome archivé) | 🧩 | 5 | M | | ⏸️ |
| [**57**](docs/backlog/57-divergence.md) | **Dessin « Divergence »** — une flèche dans l'indicateur + son miroir accroché aux bougies ; couleur par pente | 🧩 | 8 | L | ⭐ | 🧪 |
| [**56**](docs/backlog/56-rs-mansfield.md) | **Force relative (RS Mansfield)** — panneau dédié, référence réglable, cours ajustés | 🧩 | 8 | L | ⭐ | 🧪 |

## 📥 Backlog  *— pas encore affinés, priorisés par l'ordre*

| # | Item | Cat | Pts | Taille | ⭐ | Statut | Note |
|---|------|:---:|:---:|:---:|:---:|---|---|
| [**2**](docs/backlog/02-watchlists.md) | **Watchlists** (listes + sous-sections) | 💼 | 13 | XL | ⭐ | 📥 | Lib drag & drop ; modèle arborescent ; back kv déjà prêt. |
| [**1**](docs/backlog/01-comparaison.md) | **Comparaison d'une 2ᵉ action** (base 100) | 🎨 | 5 | M | ⭐ | 📥 | Alignement des dates entre 2 bourses ; base 100 / normalisation. |
| 29 | **Magnet price** (aimant) | 🧩 | 3 | S | | 📥 | Crosshair + mesure #27 s'aimantent à l'O/H/L/C. Défaut reste libre. |
| 31 | **Temps restant avant fermeture** | 🧩 | 3 | S | | 📥 | Compte à rebours jusqu'à la clôture de la bougie courante / de la séance (façon TradingView). À affiner : source des horaires de séance (Yahoo meta `currentTradingPeriod` ?), placement/affichage. |
| 12 | **Tracer une ligne de prix** | 🧩 | 3 | S | | 📥 | `createPriceLine` + persistance par symbole. |
| 13 | **Alerte selon SMA et/ou prix** | 🧩 | 5 | M | | 📥 | Déclenchement/persistance/notif ; sans #14, au rechargement seulement. |
| 3 | **Déplacer les panneaux** (RSI/Volume) | 🧩 | 8 | L | | 📥 | API panes v5 (moveToPane, réordonner) — **spike**. |
| — | **Aide au rebalancement de portefeuille** | 💼 | ? | — | | 📥 | Positions, allocations cibles, calcul des écarts. À spécifier. |
| 14 | **Données en temps réel** | ⚙️ | 13 | XL | | 📥 | Pas de flux gratuit fiable ; TSX licence payante ou API broker (IBKR/Questrade) — **spike**. |
| 37 | **ETF explorer** | 🧩 | ? | — | | 📥 | Explorer les ETF par **pays & devise**, par **catégorie & thème**. À spécifier. |
| 38 | **ETF breakdown** | 🧩 | ? | — | | 📥 | Afficher **toutes les actions d'un ETF** (composition), **heatmap**… À spécifier. |
| 39 | ~~Momentum portfolio~~ | 💼 | — | — | | 🗄️ | **Absorbé par [#47](docs/backlog/47-epopee-un-seul-produit.md)** → devient #53 + #54 (et la phase Disnat). |
| 40 | ~~Backtesting pro~~ | 💼 | — | — | | 🗄️ | **Absorbé par [#47](docs/backlog/47-epopee-un-seul-produit.md)** → devient #50 + #51. |
| [41](docs/backlog/41-golden-cross-screener.md) | ~~Screener Golden Cross~~ | 🧩 | — | — | | 🗄️ | **Absorbé par [#47](docs/backlog/47-epopee-un-seul-produit.md)** : la détection quotidienne de figures est abandonnée **comme signal d'achat** (mesurée −5,03/trade, la pire des douze variantes). Le moteur de scan survit dans #49/#53. |
| [42](docs/backlog/42-plateforme-data-supabase.md) | ~~Plateforme data partagée~~ | ⚙️ | — | — | | 🗄️ | **Absorbé par [#47](docs/backlog/47-epopee-un-seul-produit.md)** : Phase 1 livrée (TVLite en ligne). Sa décision « schéma DB possédé par `goldencross-radar` » **devient caduque** → passe à TVLite (#49). |
| — | **Disnat — quantités réelles** (phase 5) | 💼 | ? | — | | 📥 | Après #55. Calcul **mécanique** à partir des paramètres de Jean (liquidités, risque accepté, distance au stop → quantité). **Pas** de recommandation d'investissement. À spécifier. |
| — | **Délai de recherche de titre** | ⚙️ | ? | — | | 📥 | La recherche marque un temps désagréable. Hypothèse : lié à Yahoo, **pas** à Supabase — **à vérifier avant de spécifier**. Ne doit pas peser sur la décision de plan Supabase (#49). |
| 22 | **Déploiement sur Vercel** | 🚀 | ? | — | | 📥 | Build front + hébergement du backend proxy ; domaine. À spécifier. |
| 23 | **Compte utilisateur** (authentification) | 🚀 | ? | — | | 📥 | Auth (email / OAuth) ; base utilisateurs. |
| 24 | **Espace membre** | 🚀 | ? | — | | 📥 | Zone connectée : préférences, contenus liés au compte. |
| 25 | **Sync multi-appareils** | 🚀 | ? | — | | 📥 | Favoris, watchlists, dessins, layout liés au compte → retrouvés partout. |

---

## ✅ Fait
- **Dessin Rectangle** : outil rectangle façon TradingView — tracé 2 clics, **8 poignées** (4 coins + 4 milieux d'arêtes) pour redimensionner, **bordure** (couleur/épaisseur/style), **arrière-plan** (couleur/opacité), **ligne médiane** pointillée (couleur/style), **texte** centré, **Prolonger** gauche/droite, onglets Style/Texte/Coordonnées/Visibilité. *(Fichiers : `lib/drawings.ts`, `components/DrawingLayer.tsx`, `DrawingToolbar.tsx`, `DrawingOptions.tsx`, `lib/templates.ts`.)*
- **#46 Refonte visuelle** : logo/favicon (#10 bougies+loupe), **titre d'onglet live** (`SYM prix ▲/▼ %`), **volet redimensionnable** (240–520, mémorisé) + **colonnes adaptatives** (ticker prioritaire). Passe « chaleur » : radius adouci (8px), fond du volet allégé (`--bg`), **sélection bleu clair arrondie insérée**, pastille favori normale+sombre façon TradingView, entêtes de section légères, « Symbole » sans majuscules, séparateurs de tickers subtils, ombres douces, poids typo allégés. *(Fichiers : `styles.css`, `App.tsx`, `WatchlistPanel.tsx`, `index.html`, `public/favicon.svg`.)*
- **#45 Watchlist v2 · Phase C** : **flags de couleur** (clic droit, persistants) + **colonnes optionnelles** Dernier/Volume (menu ⋯) ; `volume` ajouté à `/quotes`. *(Fichiers : `WatchlistPanel.tsx`, `lib/collections.ts`, `lib/api.ts`, Edge Function + backend.)*
- **#44 Watchlist v2 · Phase B** : volet détail du symbole affiché (logo + nom, bourse · catégorie, prix + variation colorée, statut marché, **stats clés** Volume / Volume moyen (30) / Capitalisation, compact FR). Endpoint **`/quote-detail`** (v7 quote via **crumb** Yahoo + fallback v8 meta). *(Fichiers : `components/WatchlistDetail.tsx`, `WatchlistPanel.tsx`, `lib/api.ts`, Edge Function + backend `/quote-detail`.)*
- **#43 Watchlist v2 · Phase A** : logos réels par symbole (fallback monogramme coloré, détection du placeholder par taille), **Chg% du jour** coloré + **tri par section**, ligne active accentuée. Endpoint **`/quotes`** groupé (Edge Function + backend local, Yahoo v8 meta, cache 60 s, polling 60 s). *(Fichiers : `lib/logos.ts`, `components/SymbolLogo.tsx`, `components/WatchlistPanel.tsx`, `lib/api.ts`, `supabase/functions/tvlite-api/index.ts`, `backend/src/yahoo.js`+`index.js`.)*
- **Épopée Dessins** (#4 socle + Trait · #33 Flèche · #32 Trait vertical · #34 Canal parallèle · #35 Stabilo · #36 Supprimer-tous) : barre d'outils (6 outils), modèle ancré **temps+prix** (suit pan/zoom, cross-intervalle), sélection/multi-sélection/drag, poignées, **barre contextuelle** + **dialogue Options** (Style/Texte/Coordonnées/Visibilité, fenêtre déplaçable, panel au-dessus de tout + fond bloquant), **double-clic → Options**, **texte le long du trait** (pivoté), **canal** (3 clics, 4 coins + 2 poignées de hauteur, niveaux + remplissage), **surligneur** freehand, **copier/coller** décalé, **« Définir par défaut »** par outil (Trait/Flèche distincts), persistance par symbole. *(Fichiers : `lib/drawings.ts`, `components/Drawing*.tsx` + `VisibilityEditor.tsx`, câblage `Chart.tsx`/`App.tsx`, `styles.css`.)*
- **Thème clair par défaut** (sombre mémorisable) · horodatage MàJ raccourci · bouton refresh : seule l'icône tourne.
- Graphique bougies japonaises · SMA 50 (bleu) + SMA 200 (orange) · Volume · RSI 14 · Backend proxy Yahoo Finance + cache SQLite
- **#8 Modale de recherche** façon TradingView : recherche tick/nom, suggestions live, tick + nom complet + bourse + type (FR), filtres par catégorie, surlignage, clavier
- **#6 Boutons A (auto-échelle) + L (log) par panneau** : au survol, actif en surbrillance, état par panneau persistant
- **#5 RSI façon TradingView** : bande ombrée 30–70 (primitive custom), lignes 30/50/70, ligne violette + moyenne mobile (SMA 14) or adoucie
- **#11 Devise** en haut de la colonne des prix (USD/CAD…), dynamique, affichage seul
- **#15 Zoom vertical (drag)** sur l'axe des prix (A off)
- **#17 Recherche scrollable** : endpoint Yahoo `lookup` (~40 résultats, listings étrangers type MSFT.TO, bourses en noms lisibles)
- **#18 Filtre par pays** : ligne « Pays » après une catégorie → vue « Sources » (drapeaux, régions, dynamique)
- **#20 Zoom vertical** : **molette sur la colonne des prix** (façon TradingView, sans touche) OU ⌘/Ctrl + molette de n'importe où ; **illimité et ancré sur le curseur** (via `autoscaleInfoProvider` + `scaleMargins:0`) ; coupe le mode A ; complément du drag sur l'axe (#15)
- **#21 Détail du panneau** : légende dynamique en haut-gauche de chaque panneau (valeurs à la date du curseur via crosshair) — tick + OHLC + variation, SMA 200/50, Vol, RSI + MA
- **#19 Grille verticale de temps dans le futur** : barres « whitespace » futures (cadence réelle jours ouvrés/sem/mois) + **extension dynamique illimitée** — plus on scrolle à droite, plus le futur s'affiche (2027, 2028…) sur le même rythme que le passé. Buffer rallongé automatiquement à l'approche du bord (`subscribeVisibleLogicalRangeChange`).
- **#10 Changer d'intervalle** : accès rapide favoris (barre) + menu déroulant à étoiles (`IntervalSelector.tsx`, localStorage). Intervalles : intraday **5m/15m/30m/1h** (backend renvoie des timestamps ; heure affichée sur l'axe), **1J/1S/1M/3M** natifs, agrégés **4h** (depuis 1h, fenêtres horloge), **6mo/12mo** (depuis mensuel, semestre / année civile — agrégation backend O/H/L/C/Vol). **SMA restent en JOUR** quel que soit l'intervalle (calculées sur le journalier, alignées en escalier).
- **#27 Shift + clic = mesure %** : outil de mesure façon TradingView. **Shift + clic** démarre (le rectangle suit le curseur), **clic** fige la mesure (reste affichée), **clic** la ferme. Rectangle teinté (vert hausse / rouge baisse) + étiquette variation absolue, %, nb de barres. Mesure **ancrée aux données** (prix + position) → suit le pan/zoom. `mousedown` intercepté en capture (pas de pan pendant la mesure).
- **Crosshair libre** : le crosshair passe en `CrosshairMode.Normal` → le prix affiché sur l'axe suit le **niveau du curseur** (et non la donnée la plus proche). L'aimant sur les données = feature « Magnet price » (voir backlog).
- **Hauteurs de panneaux persistantes** : les stretch factors des panneaux (prix / volume / RSI) sont sauvegardés en localStorage (`tvlike:pane-stretch`) après chaque redimensionnement et restaurés à la création → le layout est conservé d'une session/rechargement à l'autre.
- **Contrôles d'indicateurs au survol** *(préambule au #7)* : au survol de la légende d'un indicateur (SMA 200, SMA 50, Volume, RSI, + futurs #9), 3 boutons apparaissent — **œil** (afficher/masquer, la série passe `visible:false` + ligne grisée), **réglages** (⚙ → ouvre la pop-up de paramètres), **corbeille** (supprime la série de l'affichage). Registre `INDICATORS` (id → seriesKeys). Hors scope (barrés) : source `{}` et menu `•••`.
- **#7 Paramètres d'indicateurs — SMA + Volume + RSI** : pop-up ⚙ (`IndicatorSettings.tsx`) à 3 onglets, aperçu **live**, **D'accord** (sauve+persiste localStorage `tvlike:indicator-settings`) / **Annuler** (restaure le snapshot). **SMA** : Longueur, Plage temporelle · couleur+opacité+épaisseur+style. **Volume** : Longueur MA · Style liste (En croissance / En chute / Volume MA) via **bouton couleur → pop-up couleur** (`ColorButton.tsx`). **RSI** : Longueur RSI + Longueur MA + Plage temporelle · Style liste (RSI, RSI-based MA, Upper/Middle/Lower Band avec **couleur + valeur** 70/50/30, Background Fill) — les niveaux/bande sont pilotés en direct (price lines + primitive de bande). **Visibilité** : onglet commun (minutes/jours/semaines/mois, case + min→max). *(Reporté : dégradés overbought/oversold du RSI.)*
- **#28 Moyenne mobile du volume** : ligne « Vol {longueur} » sur le panneau volume (série `volumeMa`, SMA du volume, longueur réglable via les params Volume), valeur affichée dans la légende. *(fait avec #7 Volume)*
- **Réglages divers** : logo TradingView retiré (`layout.attributionLogo: false`) ; molette = **zoom horizontal** sur le graphe, **zoom vertical** uniquement sur la colonne des prix (le raccourci ⌘/Ctrl+molette a été retiré).
- **SMA 9 (violet)** ajoutée aux moyennes mobiles (journalière, réglable via ⚙ comme les autres SMA).
- **Persistance de la vue** : le chart n'est cadré qu'**une seule fois** (premier chargement) ; ensuite le zoom/pan de l'utilisateur est **toujours conservé** — changement de réglage d'indicateur, Annuler, changement de symbole ET d'intervalle (`hasFittedRef`, réinitialisé à la création du chart). Un panneau se recadre à la demande avec le bouton **A**.

---

## Notes d'équipe
- **⭐ Priorité actuelle** : **Épopée [#47](docs/backlog/47-epopee-un-seul-produit.md) — Un seul produit**, dans l'ordre **#48 → #49 → #50 → #51 → #52 (porte) → #53 → #54 → #55**. *(Épopée Dessins livrée.)*
- **Dépendances** :
  - **#48 bloque #54** — sans réconciliation, tout ce que le pipeline écrit meurt au rechargement suivant.
  - **#49 précède #50** — le labo a besoin des deux univers de données en place.
  - **#52 est une porte** : #53/#54/#55 ne figent aucun paramètre avant l'accord de Jean.
  - **Parallélisation** : #52 est du *temps de Jean* → #53/#54 peuvent être construits pendant, à condition que la **sélection soit une interface remplaçable**.
  - Hors épopée : #3 = **spike** API Lightweight Charts (moveToPane) · #13 pleinement utile avec #14.
- **Statut de la stratégie** : ⚠️ **non validée**. Les 12 familles de figures techniques sont négatives sur la période de sélection ; seul le **momentum transversal** tient des deux côtés du découpage — et il **n'a jamais été testé avec un stop**. C'est l'objet de #52.
- **Modèle** : **Fable** pour #50 et #52 (raisonnement statistique — une erreur de méthode ne lève pas d'exception, elle produit un joli tableau). Modèle plus léger suffisant pour le câblage une fois le ticket précis.
- **Total restant** : **~106 pts** (dont ~60 pour l'épopée #47 ; hors Publication non estimée).
