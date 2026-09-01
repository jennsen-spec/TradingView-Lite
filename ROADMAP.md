# Roadmap — TV-Like (backlog scrum)

**Échelle d'effort (story points, Fibonacci)** : 1–2 = trivial · 3 = petit · 5 = moyen · 8 = gros · 13 = très gros / incertain
**T-shirt** : XS / S / M / L / XL
**Catégories (colonne `Cat`)** : 🧩 Fonctionnalité · 💼 Portefeuille · 🎨 Cosmetic · ⚙️ Technique · 🚀 Publication · ⭐ = priorité
**Priorité = ordre des lignes** (haut = prochain). Déplacer un ticket = réordonner sa ligne.
**Process** : voir [`docs/WORKFLOW.md`](docs/WORKFLOW.md) · détail des tickets affinés dans [`docs/backlog/`](docs/backlog/) · statuts : 📥 Backlog → 🔍 Affiné → 🏗️ En cours → 🧪 À valider → ✅ Fait

**Les 3 sections** : **[1 · 🔍 Prêt (DoR)](#1--prêt-dor)** · **[2 · 📥 Backlog](#2--backlog)** · **[3 · 🗂️ Autre](#3--autre)** (livré / clos / abandonné).

---

# 1 · 🔍 Prêt (DoR)
*Affinés, prêts à sprinter, priorisés par l'ordre.*

| # | Item | Cat | Pts | Taille | ⭐ | Statut | Note |
|---|------|:---:|:---:|:---:|:---:|---|---|
| — | *Rien en attente* | | | | | | Les tickets affinés récents (#76, #79, #80) ont tous été livrés → voir [§3 Livrés](#-livrés-ex-backlog--ex-dor). |

---

# 2 · 📥 Backlog
*Priorisé : NOW / THEN / LATER (l'ordre fait foi).*

| # | Item | Cat | Pts | Taille | Note |
|---|------|:---:|:---:|:---:|---|
| **⚡ NOW** | | | | | |
| 70 | **Responsive — vue Mobile / iPad** | 🧩 | 13 | XL | Adapter TVLite au tactile : layout (toolbar, volets, modales), interactions au doigt, ruptures téléphone/iPad. À affiner : v1 consultation seule, ou dessin tactile aussi ? |
| **⏭️ THEN** | | | | | |
| 23 | **Compte utilisateur** (authentification) | 🚀 | ? | — | Auth (email / OAuth) ; base utilisateurs. |
| 24 | **Espace membre** | 🚀 | ? | — | Zone connectée : préférences, contenus liés au compte. |
| 25 | **Sync multi-appareils** | 🚀 | ? | — | Favoris, watchlists, dessins, layout liés au compte → retrouvés partout. |
| 22 | **Déploiement sur Vercel** | 🚀 | ? | — | Build front + hébergement backend proxy ; domaine. Plan gratuit. Vérifier que l'adresse du rapport mensuel (`frontend/public/`) survit. |
| **🗓️ LATER** | | | | | |
| 82 | **Analyse Technique & Backtest SYNTH** | 💼 | 8 | L | [ticket](docs/backlog/82-analyse-technique-backtest-synth.md). Faire de l'analyse technique sur les instruments SYNTH (surtout MOM.SYNTH quotidien) et **backtester** des règles de timing (entrée/sortie du portefeuille) : filtre SMA 200j/400j, RSI, croisements, swing… → trouver le meilleur positionnement vs buy-and-hold. Attention overfitting + redondance avec l'interrupteur MM150. Dépend de #79. |
| 83 | **PrtFlio Backtest + Overlay TVLite** | 💼 | ? | — | [ticket](docs/backlog/83-prtflio-backtest-overlay-tvlite.md). *Placeholder — à recadrer.* L'outillage : backtester des stratégies de portefeuille (labo) + **overlay** du résultat dans TVLite. Axe *outil*, distinct de #82 (l'*exploration*) ; les deux se recoupent, à cadrer ensemble. |
| 78 | **Fusion cloud par entrée (« 48-bis »)** | ⚙️ | 5 | M | Suite de l'audit du 31/08 : la fusion ne sauve que les collections entièrement nouvelles — une **modification** d'une collection existante côté perdant est jetée (perte possible dès aujourd'hui). À faire : rang fusionnable par collection, arbitrage entrée par entrée, insertion à la bonne position, fiabiliser l'arbitre d'horloges client/serveur. |
| 75 | **Agent Gemini Built-in** (migration Telegram) | ⚙️ | ? | — | À spécifier. Agent Gemini intégré remplaçant / prolongeant la notif Telegram (#66). |
| 67 | **Revue périodique du glissement d'exécution** | 💼 | 5 | M | Prix obtenus vs ouverture du backtest ; 1re échéance hiver 2026-27, à répéter. La stratégie ne tolère que ~0,9 %/entrée. |
| 1 | **Comparaison d'une 2ᵉ action** (base 100) | 🎨 | 5 | M | Alignement des dates entre 2 bourses ; base 100 / normalisation. |
| 12 | **Tracer une ligne de prix** | 🧩 | 3 | S | `createPriceLine` + persistance par symbole. |
| 31 | **Temps restant avant fermeture** | 🧩 | 3 | S | Compte à rebours jusqu'à la clôture de la bougie / séance. Source des horaires à affiner. |
| 29 | **Magnet price** (aimant) | 🧩 | 3 | S | Crosshair + mesure #27 s'aimantent à l'O/H/L/C. Défaut reste libre. |
| 13 | **Alerte selon SMA et/ou prix** | 🧩 | 5 | M | Déclenchement/persistance/notif ; sans temps réel, au rechargement seulement. |
| 3 | **Déplacer les panneaux** (RSI/Volume) | 🧩 | 8 | L | API panes v5 (moveToPane) — spike. |

---

# 3 · 🗂️ Autre
*Livré · clos · abandonné.*

## ✅ Livrés (ex-backlog / ex-DoR)
- **Synthétiques & stratégie** : [#76](docs/backlog/76-ordre-collections.md) Réordonner les collections · [#76](docs/backlog/76-portefeuille-synthetique.md) Portefeuille perso en bougies (**EQ.SYNTH**, panier actuel base 100) · [#77](docs/backlog/77-duo-mom-synthetique.md) **MOM.SYNTH** instrument synthétique du duo (backtest → prod) · [#79](docs/backlog/79-duo-mom-phase2-append.md) MOM.SYNTH phase 2 (quotidien, public, auto-actualisé, point courant live) · [#80](docs/backlog/80-fiche-detail-synthetiques.md) Fiche détail des synthétiques.
- **Autres ex-backlog** : #2 Watchlists (Collections) · #58 Base saturée · #59 Rapport 17 h · #60 Inventaire univers · #61 Conformité moteur · #62 Poids dérivants · #63 Ensembles de dessins · #64 Sélection multiple · #65 Mesure unités durée.
- **Clos par décision** : [#81](docs/backlog/81-mom-synth-supabase.md) MOM.SYNTH sur Supabase — évalué, **écarté** (on garde l'approche actuelle client-side, portable dev/prod).
- **🗄️ Absorbés par [#47](docs/backlog/47-epopee-un-seul-produit.md)** : #39 · #40 · #41 · #42.

## 🎯 Épopée [#47 — Un seul produit](docs/backlog/47-epopee-un-seul-produit.md)  *(~60 pts)* — ✅ close le 29/08/2026
> TVLite scrape la bourse canadienne, trie techniquement, dépose chaque mois une **collection** + des **positions longues justifiées**, et **Jean décide**.
> Principe : **le momentum trie, la technique raconte** — trois emplacements distincts (**trier** / **filtrer** / **interrupteur**). Absorbe **#39-42**. Porte de validation en **#52**.
>
> Le chemin réel a différé du plan (duo sectoriel, pas de stops, pas de tables `reco.*`) : consigné ticket par ticket. #51 est 🚫 caduc (besoin servi par les artefacts). Résultats du labo archivés dans [`docs/archive/labo-resultats-2026-08-22.md`](docs/archive/labo-resultats-2026-08-22.md).

| # | Item | Cat | Pts | Taille | ⭐ | Statut |
|---|------|:---:|:---:|:---:|:---:|---|
| [**48**](docs/backlog/48-reconciliation-cloud.md) | **Réconciliation cloud ↔ local** (cloud-clobber) — *bloquant #54* | ⚙️ | 5 | M | ⭐ | ✅ |
| [**49**](docs/backlog/49-terrain-unifie.md) | **Une seule base** — robots coupés, ancien monde jeté, 907 titres / 650 à historique complet + 20 ETF de référence | ⚙️ | 8 | L | ⭐ | ✅ |
| [**50**](docs/backlog/50-labo-mesure-cli.md) | **Labo de mesure (CLI)** — trier/filtrer/interrupteur, benchmark apparié, cartouches | 💼 | 13 | XL | ⭐ | ✅ |
| [**51**](docs/backlog/51-page-recherche.md) | **Page « Recherche »** (lecture seule) — tableau comparatif des jeux de règles | 🧩 | 5 | M | | 🚫 |
| [**52**](docs/backlog/52-exploration-decision-strategie.md) | **Exploration & décision de stratégie** — *porte franchie : duo top-10, interrupteur séance entière, protocole v4* | 💼 | 8 | L | ⭐ | ✅ |
| [**53**](docs/backlog/53-pipeline-mensuel.md) | **Pipeline mensuel** — réalisé autrement : cycle + Action 17 h 30 + conformité #61 | 💼 | 8 | L | | ✅ |
| [**54**](docs/backlog/54-restitution-tvlite.md) | **Restitution TVLite** — collection livrée ; `longpos`/panneau caducs (pas de stops) | 🧩 | 8 | L | ⭐ | ✅ |
| [**55**](docs/backlog/55-rapport-mensuel.md) | **Rapport mensuel** — réalisé autrement : rapport.html publié par l'Action, archivé par git | 🧩 | 5 | M | | ✅ |
| [**57**](docs/backlog/57-divergence.md) | **Dessin « Divergence »** — une flèche dans l'indicateur + son miroir accroché aux bougies ; couleur par pente | 🧩 | 8 | L | ⭐ | ✅ |
| [**56**](docs/backlog/56-rs-mansfield.md) | **Force relative (RS Mansfield)** — panneau dédié, référence réglable, cours ajustés | 🧩 | 8 | L | ⭐ | ✅ |

## 🚫 Wont-do  *— abandonnés (0 commencé), gardés pour trace*

| # | Item | Cat | Motif |
|---|------|:---:|---|
| 14 | ~~Données en temps réel~~ | ⚙️ | Pas de flux gratuit fiable ; TSX licence payante ou API broker — spike sans issue. |
| 68 | ~~Aide au rebalancement de portefeuille~~ | 💼 | Pas de poids cible du portefeuille (`portefeuille/README.md`) → aucun rééquilibrage à calculer. |
| 69 | ~~Purge mensuelle des réinsertions TVLite~~ | ⚙️ | Base à 17,6 % du quota, garde-fou du cron à 400 Mo suffit. |
| 74 | ~~Backtest des combinaisons d'ETF~~ (ZEQT·HXS·VMO) | 💼 | Pas de fenêtre longue commune (ZEQT 2022, VMO 2016, HXS 2011). |
| 71 | ~~Disnat — quantités réelles~~ (phase 5) | 💼 | Abandonné (0 commencé). |
| 72 | ~~Délai de recherche de titre~~ | ⚙️ | Abandonné (0 commencé). |
| 73 | ~~Revue de l'interrupteur à séance entière~~ | 💼 | À rejuger informellement à la revue d'hiver si besoin. |
| 66 | ~~Notification Telegram du rapport mensuel~~ | 🚀 | Abandonné (décision 2026-09-01) — la voie Telegram est remplacée par l'agent intégré (#75). |

## ✅ Fait (fonctionnalités livrées)
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
- **Rafraîchissement des cours (prod)** : le bouton ↻ force un fetch Yahoo (contourne le cache Edge 12 h) ; l'Edge Function réécrit le cache. *(Fichiers : `lib/api.ts`, `supabase/functions/tvlite-api/index.ts`.)*

## 📌 Notes d'équipe
- **⭐ Priorités : à revoir** (session dédiée à venir). ⭐ actuellement épinglés au backlog : #1 Comparaison · #67 Revue du glissement · #22 Vercel.
- **Épopée [#47](docs/backlog/47-epopee-un-seul-produit.md) close** (29/08) : produit unique en place — TVLite + signal / rapport / collection mensuels **100 % cloud**, Jean décide (5 000 $ engagés, 1er signal réel le 31/08). Détail ticket par ticket #48→#57.
- **Dépendances restantes** :
  - **#3** = **spike** API Lightweight Charts (`moveToPane`).
  - **#13** (alerte) : sans flux temps réel (**#14 en 🚫 wont-do**), déclenchement **au rechargement** seulement.
- **Stratégie** : porte #52 franchie → **duo momentum top-10** (Industrials + Technology), **sans stop**, interrupteur séance entière, **protocole v4**. Caveats assumés : rendement absolu **biaisé par le survivant** (seul l'écart vs benchmark apparié est défendable) ; le **glissement d'exécution** est le facteur le plus dangereux → revue #67 (hiver 26-27).
- **Modèle** : pour les tickets à **raisonnement statistique** (labo / backtest), préférer **Fable** — une erreur de méthode ne lève pas d'exception, elle produit un joli tableau.
- **Total restant** : **~35 pts** (backlog ouvert ; #22-25 non estimés). Épopées Dessins + #47 livrées.
