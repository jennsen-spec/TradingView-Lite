# #9 — Ajout / suppression d'indicateurs

**Statut** : ✅ Fait · **Points** : 8 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : ⭐

> **Sprint (fait)** — vérifié en browser : défaut identique (SMA 9/50/200 + Vol + RSI) ; bouton 📊 Indicateurs + chevron ; pop-up (recherche, filtre Favoris, 2 colonnes Nom | switch) ; ajout d'une 2ᵉ/3ᵉ SMA (couleurs distinctes) ; ⚙ par instance (longueur indépendante) ; corbeille retire l'instance ; chevron = ajout rapide des favoris ; Volume/RSI retirés puis ré-ajoutés ; persistance (`tvlike:indicators`) après reload. **Impl** : SMA en liste dynamique (`smaOrder`), Volume/RSI singletons présents/absents (mono), séries SMA créées/détruites dynamiquement (pane 0), machinerie panneaux inchangée. **Placement** : bouton « **＋ Indicateurs** » dans la **barre d'outils**, à droite des intervalles (rendu par Chart via un portail React dans un slot de la barre). Icône = caractère monochrome « + » (pas d'emoji). *(ajusté suite retour UAT)*

## Objectif
Ajouter/retirer des indicateurs depuis l'UI (bouton + pop-up façon TradingView) sans qu'ils
soient codés en dur, et pouvoir avoir **plusieurs SMA** simultanées. S'appuie sur le registre
`INDICATORS` et les schémas de params (#7 fait).

## Critères d'acceptation
- [x] Bouton **📊 Indicateurs** + **chevron** dans la barre d'outils.
- [x] Clic bouton → pop-up (titre, barre de recherche, bouton filtre **Favoris**) ; zone résultats en **2 colonnes : Nom | Favoris (switch Oui/Non)**.
- [x] Par défaut tous les types listés ; la recherche filtre par nom ; le filtre Favoris n'affiche que les favoris.
- [x] Clic sur un **Nom** ajoute une instance du type (série + légende + ⚙ + corbeille, avec défauts).
- [x] Clic **chevron** → dropdown listant **seulement les favoris** ; clic = ajout rapide.
- [x] **Plusieurs SMA** coexistent (ex. 9 + 21 + 50), chacune réglable/supprimable indépendamment.
- [x] La **corbeille** retire l'instance proprement (série + légende + prefs).
- [x] Le ⚙ (`IndicatorSettings`, #7) ouvre les réglages **de l'instance visée**.
- [x] Au **premier chargement** (sans prefs), setup identique à aujourd'hui : SMA 9/50/200 + Volume + RSI.
- [x] Instances + réglages + favoris **persistent** (localStorage **global**) ; rechargement fidèle.
- [x] RSI et Volume limités à **une instance chacun** (leur pane existant).

## Décisions
- **Types** = existants seulement (SMA, Volume, RSI). MACD/Bollinger/EMA → plus tard.
- **Refactor** ids fixes (`sma9/sma50/sma200/rsi/volume`) → **liste d'instances** `[{instanceId, type, settings}]`.
- **SMA multi-instances** ; **RSI/Volume mono-instance**. Panes dynamiques + déplacement/réordonnancement de panes = **hors scope → #3**.
- **Overlay vs pane** = auto selon le type (SMA→prix, RSI/Volume→pane). Futur nouveau type au catalogue → demander le pane par défaut à l'ajout au catalogue.
- **Persistance globale** (pas par symbole). Favoris = par type.

## Questions ouvertes
- Libellés exacts des types dans la liste (« Simple Moving Average »/« SMA », « Volume », « RSI »/« Indice de force relative ») → à confirmer en sprint (cosmétique).
- Clé localStorage unique (ex. `tvlike:indicators`) et migration/abandon de l'ancienne `tvlike:indicator-settings` (#7) → à trancher à l'implémentation.

## Plan technique
1. Étendre `INDICATORS` en **catalogue de types** `{label, paneMode, defaultSettings, compute, createSeries}` → vérif : 3 types déclarés, defaults = valeurs actuelles.
2. État `instances: [{instanceId, type, settings}]` + `favorites: type[]`, remplace la logique par id fixe (hidden/removed/settings). Défaut = SMA 9/50/200 + Vol + RSI → vérif : premier chargement identique à aujourd'hui.
3. Rendu **piloté par la liste** (création/suppression série + légende + ⚙ + corbeille par `instanceId`) → vérif : ajout/suppr d'une 2ᵉ/3ᵉ SMA OK.
4. Bouton « Indicateurs » + chevron dans la barre → vérif : visibles, cliquables.
5. Pop-up catalogue (recherche, filtre favoris, 2 colonnes Nom | switch) → vérif : filtre + ajout au clic.
6. Dropdown favoris (chevron) → vérif : n'affiche que les favoris, ajout rapide.
7. Persistance globale (instances + settings + favoris) → vérif : reload fidèle.
8. Brancher `IndicatorSettings` (#7) **par instance** → vérif : ⚙ édite la bonne instance.

## Notes / risques
- Gros refactor (ids fixes → instances) : régression possible sur #7 (réglages), légendes et contrôles au survol.
- RSI/Volume mono-instance = garde-fou tant que #3 (panes dynamiques) n'est pas fait.
- Prévoir un fallback propre de migration localStorage si l'ancienne clé est présente.
