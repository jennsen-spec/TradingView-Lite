# #79 — DUO.MOM phase 2 : append mensuel (backtest → live, publié)

**Statut** : 🧪 À valider · **Points** : 5 · **Catégorie** : 💼 Portefeuille · **Taille** : M

## Réalisé (2026-09-01) — plus simple que le plan
Au lieu d'un **append incrémental** dans `page.ts` + backfill par replay, on **re-génère toute la
courbe** à chaque rapport : l'exporteur [`labo/src/exporter-duo-mom.ts`](../../labo/src/exporter-duo-mom.ts)
recalcule 2004→dernier mois via le moteur (convention backtest, net de frais, interrupteur séance),
donc le nouveau mois complet apparaît tout seul et le **backfill est inhérent** (aucune logique dédiée).
- **Public + auto** : `duo-mom.json` **suivi par git** (dé-gitignoré), garde `import.meta.env.DEV` **retirée**
  → DUO.MOM visible en prod (vérifié dans le build). Reste **non défaut** (DOUDOU) et **étiqueté « NON validé »**.
- **Action** `rapport.yml` : nouveau pas *Actualiser la courbe DUO.MOM* (`npm run duo:export`, non bloquant)
  quand le signal change ; `duo-mom.json` ajouté au `git add` du commit mensuel.
- **Nature des points** : OHLC mensuel, live réel du panier (retenus), convention backtest — conforme aux décisions.
- **Point provisoire du mois en cours** (ajout 2026-09-01) : la convention « vente à l'ouverture suivante » fait que le
  dernier mois n'est finalisé qu'à l'ouverture du mois d'après → le mois courant manquait. On ajoute un point **provisoire**
  (mark-to-market) : le panier tenu ce mois-ci (sélectionné au dernier signal, via `calculerCycle`) valorisé jour par jour
  jusqu'à la dernière clôture. Il se recalcule/finalise seul au prochain rapport. L'historique garde la convention documentée.
- Reste ouvert (nice-to-have) : repère visuel de la frontière backtest↔live sur le graphe.

## Objectif
Faire **vivre** DUO.MOM : à chaque **rapport mensuel** (Action `rapport.yml`), calculer le
**rendement réalisé du mois** et **ajouter un point** à la courbe d'équité, dans la continuité
du backtest (#77). DUO.MOM passe de **local figé** à **public auto-actualisé**.

## Décisions (validées avec Jean, 2026-09-01)
- **Auto / publié** : l'Action calcule et **commite** le point du mois → DUO.MOM s'actualise seul
  et devient **visible en prod**. ⚠️ **Inverse la garde local-only de #77** (choix assumé) :
  - on **retire** `duo-mom.json` du `.gitignore` (fichier suivi) ;
  - on **retire** la garde `import.meta.env.DEV` de `portfolios.ts`.
  - Le garde-fou « non validé » reste l'**étiquette** (nom + légende + tag recherche). Les titres
    détenus sont **déjà publics** via `portefeuille/etat.json` → pas de nouvelle fuite.
- **Points = live réel du panier** : rendement **équipondéré** des `detenus` du cycle précédent,
  aux **prix réels**, **cash → ret = 0** si l'interrupteur MM150 est coupé (`investi=false`).
  Équité chaînée : `equite_n = equite_(n-1) × (1 + ret_mois)`, en partant du **dernier point du
  backtest** (base 100 → 6586,80 à 2026-06).
- **Convention alignée sur le backtest** : rendement mesuré **exécution à l'ouverture de la séance
  suivante, glissement compté** (pas clôture→clôture). → **réutiliser** la logique de rendement du
  labo (`moteur.ts` / `courbes.ts`), pas de calcul maison, pour que la jointure soit cohérente.
- **Backfill** des mois déjà écoulés depuis la frontière (2026-06 → aujourd'hui) : on **rejoue** le
  signal de chaque fin de mois (`calculerCycle --signal <date>`) pour reconstituer le panier détenu,
  puis on chaîne les rendements réels. `etat.json` n'a qu'un cycle → le backfill vient du **replay**,
  pas de `etat.json`.
- **Frontière backtest → live marquée** : le raccord peut faire une **marche** (le backtest research
  est gonflé par le biais du survivant). On matérialise la date de bascule (2026-06) de façon lisible.

## Critères d'acceptation
- [ ] `duo-mom.json` est **suivi par git** (plus gitignoré) et sert de **socle** committé (courbe backtest #77, fin 2026-06).
- [ ] DUO.MOM est **visible en prod** (garde `import.meta.env.DEV` retirée), toujours **base 100 mensuel**, **volume 0**, étiquette **« NON validé »** conservée. **N'est pas** le symbole par défaut (reste DOUDOU).
- [ ] Quand l'Action publie un **nouveau signal**, un point `{time: <fin de mois>, close}` est **ajouté** à `duo-mom.json` et **committé** dans le même commit que `rapport.html` / `etat.json`.
- [ ] Le `close` ajouté = équité chaînée à partir du **rendement réalisé** du panier détenu (équipondéré, prix réels, **convention backtest** exécution-ouverture-suivante ; **0** si cash). → vérif : recalcul manuel d'un mois = même valeur.
- [ ] **Backfill** : les mois écoulés depuis 2026-06 (rejoués via `calculerCycle`) sont présents dans `duo-mom.json` avant le premier append automatique.
- [ ] **Idempotent** : re-passage sans nouveau signal → **aucun point ajouté** (pas de doublon de date).
- [ ] La **frontière** backtest/live (2026-06) est repérable (a minima documentée dans le `_note` du JSON ; repère visuel = *nice-to-have*).

## Plan technique
1. **Dé-garder** : retirer `duo-mom.json` du `.gitignore` ; committer la courbe socle ; retirer le `import.meta.env.DEV` de `lib/portfolios.ts` (garder `import.meta.glob` → robuste si fichier absent). → vérif : DUO.MOM apparaît dans un build prod local.
2. **Rendement mensuel** — un helper labo qui, pour une fin de mois donnée, rejoue le signal
   (`calculerCycle`) et renvoie le **rendement réalisé** du panier détenu à la **convention backtest**
   (exécution à l'ouverture suivante, glissement compté), `0` si cash. → **réutiliser** `moteur.ts` /
   `courbes.ts` (`rendementsStrategie`) plutôt que réimplémenter. → vérif : sur un mois, == la valeur du moteur.
3. **Backfill** : parcourir les fins de mois de **2026-07 → mois courant**, calculer chaque rendement (étape 2),
   chaîner depuis 6586,80, et écrire ces points dans `duo-mom.json`. → vérif : dates continues, pas de trou après 2026-06.
4. **Append incrémental** dans `labo/src/page.ts` (déjà exécuté par l'Action) : au signal courant, lire la
   dernière équité de `duo-mom.json`, append `{time: signal, close: round(equite×(1+ret))}`, réécrire trié +
   **dédoublonné par date**. → vérif : 1 point de plus, date = signal ; re-run sans nouveau signal = pas de doublon.
5. **Commit** : ajouter `frontend/src/data/duo-mom.json` au `git add` de l'étape *Publier* de `rapport.yml`
   (garde « signal changé » déjà en place). → vérif : dry-run `workflow_dispatch`.
6. **Vérif finale** : recalcul manuel d'un mois == point produit ; courbe continue après 2026-06 ; DUO.MOM visible en build prod local.

## Questions ouvertes
- **Repère visuel de la frontière** : simple note dans `_note` (retenu par défaut), ou vrai marqueur sur le graphe (demande une modif `Chart`, hors périmètre M) ? — à trancher au sprint.

## Notes / risques
- **Dépend de #77** (socle) et touche l'**Action de prod** (`rapport.yml`) → tester en `workflow_dispatch` avant de compter dessus.
- **Non validé en prod** : l'étiquette doit rester bien visible ; ne pas laisser croire à un instrument tradable validé (biais du survivant, pas de stop — cf. #52).
- **Aucune cartouche** consommée ici (append live, pas de `--valider`). Rappel : la journalisation cartouche est de toute façon hors-ligne (`research.validation_log` supprimée).
