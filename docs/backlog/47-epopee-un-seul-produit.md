# #47 — Épopée : Un seul produit

**Statut** : 🔍 Affiné (épopée) · **Points** : ~60 · **Catégorie** : 💼 Portefeuille · **Taille** : XXL · **Priorité** : ⭐

## Objectif
Réunir le scraper, l'analyse technique et l'interface graphique en **un seul produit — TVLite** :
il scrape la bourse canadienne, trie techniquement, dépose chaque mois une **collection** + des
**positions longues justifiées** sur les graphiques, et **Jean décide**.
Fini l'aller-retour avec l'app Golden Cross. Fini les bases nommées par produit.

## Le principe qui structure tout
**Le momentum trie, la technique raconte.** Mais **Jean décide de ce qui trie et de ce qui filtre** — il est l'analyste.
Le moteur de règles a **trois emplacements distincts**, parce qu'un même critère donne des résultats opposés selon sa place :

| Emplacement | Portée | Produit |
|---|---|---|
| **TRIER** | tous les titres, comparés | un classement |
| **FILTRER** | un titre isolément | oui/non pour lui |
| **INTERRUPTEUR** | le marché entier | on joue ce mois-ci, oui/non |

Preuve mesurée (Weinstein MM150) : en **tri** → pire baisse −57,4 % · en **filtre** → −47,5 % · en **filtre + interrupteur** → −36,8 %.
Weinstein ne choisit pas de meilleurs titres ; **son seul apport est de faire sortir du marché**.

## Décisions actées
- **Un dépôt** : `TradingView-Lite` (il a déjà l'Action GitHub et l'Edge Function).
- **Un projet Supabase** (`cucshrxmtwwizzzqthcj`), schémas au lieu de noms de produits : `market` · `research` · `reco` · `app`.
- **L'app Golden Cross Radar est abandonnée** ; le **moteur de scraping est conservé** (il est déjà dans Postgres, pas dans l'app).
- **Curseur SQL/TS** : Postgres garde **l'ingestion** ; **backtest, sélection et génération passent en TypeScript** dans le dépôt, lancés par GitHub Action.
- **Plan Supabase gratuit conservé** → `research` est un **schéma jetable** (voir #49). **Mesuré le 21/08 : le gratuit tient** — le rapatriement ne coûte que **41 Mo** (467 502 barres CA), pas 760, car `ta_ca_daily` est dérivée et 238 Mo de barres ne sont pas canadiennes. Projection **≈ 375 Mo / 500**.
- **Seuil de liquidité : 500 k$/jour**, appliqué **à l'identique** au backtest et au scan (+ plancher de prix, voir #52).
- **Poche satellite : 30 000 $** · budget de risque par défaut **1 %** · plafond par ligne **20 %**.
- **Labo** : CLI d'abord, page de lecture ensuite (#50 puis #51).
- **Jean peut passer outre l'interrupteur.** Le système **journalise ses dérogations** pour mesurer plus tard ce que son jugement coûte ou rapporte.
- **Aucun texte du produit ne promet une performance** : ni score de confiance, ni probabilité, ni rendement attendu.

## Ordre de travail
1. **#48** Réconciliation cloud (bloquant — sans lui rien de ce qu'écrit le pipeline ne survit)
2. **#49** Terrain unifié (prérequis données du labo)
3. **#50** Labo de mesure (CLI) → **#51** Page « Recherche »
4. **#52** Exploration & **décision de stratégie** ← *porte de validation, accord de Jean requis*
5. **#53** Pipeline mensuel → **#54** Restitution TVLite → **#55** Rapport mensuel

**Parallélisation** : #52 est du **temps de Jean**. #53/#54 peuvent être construits pendant, à condition que la
**sélection soit une interface remplaçable** — on branche la règle validée sans retoucher la tuyauterie.

## Ce que cette épopée absorbe
- **#41** Screener Golden Cross → la détection quotidienne de figures est abandonnée comme signal d'achat (mesurée −5,03, la pire des douze). Le moteur de scan survit dans #49/#53.
- **#42** Plateforme data partagée → sa Phase 1 est livrée (TVLite en ligne). Sa décision « le schéma DB est possédé par `goldencross-radar` » **devient caduque** : il passe à TVLite (#49).
- **#39** Momentum portfolio → devient #53 + #54 (+ phase Disnat, plus tard).
- **#40** Backtesting pro → devient #50 + #51.

## Hors périmètre
Cours swing interactif · Disnat / quantités réelles (phase 5, à ouvrir après #55) · temps réel.

## Notes / risques
- **La stratégie n'est pas validée.** Rien d'exécutif ne se construit sur des paramètres non mesurés : c'est le sens de la porte #52.
- **Le stop et la cible du `longpos` ne sont adossés à aucune mesure** aujourd'hui (le protocole momentum n'a jamais été testé avec un stop). Soit #52 les mesure, soit #54/#55 disent explicitement que ce sont les garde-fous de Jean.
- **Modèle recommandé** : Fable pour #50/#52 (raisonnement statistique — une erreur de méthode est invisible) ; un modèle plus léger suffit pour le câblage une fois le ticket précis.
