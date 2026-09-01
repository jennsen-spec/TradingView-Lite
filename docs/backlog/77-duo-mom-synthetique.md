# #77 — DUO.MOM : instrument synthétique de la stratégie duo (backtest → mensuel)

**Statut** : ✅ Fait (validé par Jean le 2026-09-01) · **Points** : 5 · **Catégorie** : 💼 Portefeuille · **Taille** : M

## Objectif
Afficher la stratégie **duo momentum** (`c-duo-plaf5-p1`) comme un instrument synthétique
**`DUO.MOM`** dans TVLite — **courbe d'équité base 100, mensuelle** — dans le même esprit que
**DOUDOU (#76)**, alimentée par le **backtest** (passé) puis, en phase 2, par les **rapports
mensuels** (futur). **Local seulement** pour l'instant.

## Décisions (validées avec Jean)
- **Local uniquement** — pas de déploiement prod (stratégie ⚠️ **non validée**). Prod à rediscuter plus tard.
- **Source phase 1 = une courbe DÉJÀ CALCULÉE** : on **ne fait pas tourner le labo** → **aucune cartouche de validation consommée**. On **lit** un artefact existant.
- **Mensuel**, **base 100**, **sans volume** (une stratégie n'a pas de volume échangé).
- Réutilise le **socle synthétique de #76** (`lib/portfolios.ts`, branchement `fetchCandles`, injection recherche).
- **Étiquette claire** : « backtest `c-duo-plaf5-p1` — NON validé ».

## Critères d'acceptation
- [x] Symbole **`DUO.MOM`** cherchable et ouvrable dans TVLite (comme DOUDOU), en **bougies mensuelles**, **base 100**. ✔ vérifié en dev (open → 6586,80).
- [x] Série lue depuis **`frontend/src/data/duo-mom.json`** (mensuel, base 100). ✔ 258 points, 2005-01 → 2026-06.
- [x] **Indicateurs techniques** (SMA, RSI…) fonctionnent sur la série. ✔ SMA 9/50/150/200/400 + RSI 14 rendus.
- [x] **Volume = 0**. ✔ Vol 20 = 0.
- [x] **Local seulement** : `DUO.MOM` **n'apparaît pas** dans le build prod (garde `import.meta.env.DEV`) et n'est **pas** le symbole par défaut. ✔ build CI (fichier absent) : courbe totalement absente du bundle ; défaut reste DOUDOU.
- [x] **Étiquette** « backtest — non validé » visible. ✔ légende : « DUO.MOM — duo momentum (backtest c-duo-plaf5-p1 · NON validé · local) » + tag « Backtest · Synthétique · local » dans la recherche.

## Réalisé (écart vs spec)
- **Pas de courbe pré-calculée exploitable** (archives = métriques ; `cowork_mom.json` = momentum de référence, pas le duo). Jean a autorisé (**option 1**) de faire tourner le labo pour matérialiser la vraie courbe duo.
- **`--valider` KO** : la journalisation de cartouche (`research.validation_log` Supabase) est **hors-ligne** (schéma research supprimé). → courbe produite **sans consommer/journaliser de cartouche** via l'exporteur direct [`labo/src/exporter-duo-mom.ts`](../../labo/src/exporter-duo-mom.ts) (lecture cache research, prix ajustés). **Aucune cartouche consommée.**
- **Garde « local » = les deux** : `import.meta.env.DEV` **et** `duo-mom.json` gitignoré → jamais dans le dépôt public ni le build CI. Chargement via `import.meta.glob` (vide si fichier absent → feature off sans casser la compile).
- **Fenêtre** : la courbe couvre **2005-01 → 2026-06** (univers research complet, la cartouche ne masque rien puisqu'on ne passe pas par `--valider`).

## Plan technique
1. **Identifier + parser** la courbe pré-calculée → produire `frontend/src/data/duo-mom.json` : `[{ time: "YYYY-MM-…", close }]` (mensuel, base 100). → vérif : série cohérente (nb de points, monotonie des dates).
2. Étendre `lib/portfolios.ts` : reconnaître `DUO.MOM`, servir la série (bougies mensuelles depuis les valeurs ; OHLC = close, ou O=close précédent), **volume 0**. → vérif : rendu.
3. Injecter `DUO.MOM` dans la recherche avec label « backtest — non validé ». → vérif : trouvable.
4. **Garde locale** : n'exposer `DUO.MOM` (recherche + résolution) que si `import.meta.env.DEV`. → vérif : présent en dev, **absent en prod** (build).
5. Vérif finale : DUO.MOM s'ouvre en dev, série mensuelle base 100, SMA/RSI OK, absent du build prod.

## Notes / risques
- **Phase 2 (séparée)** : brancher le **rapport mensuel** pour qu'il **append** un point à chaque run (modif pipeline / Action `rapport.yml`). Ticket dédié quand la phase 1 est validée.
- **Gouvernance** : ne **jamais** consommer de cartouche ici (lecture seule d'une courbe déjà calculée).
- **Non validé** → étiquette + local, pour ne pas induire en erreur (biais du survivant, pas de stop — cf. #52).
- Dépend de **#76** (socle synthétique).
