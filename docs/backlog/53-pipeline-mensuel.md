# #53 — Pipeline mensuel (runs & recommandations)

**Statut** : 🔍 Affiné · **Points** : 8 · **Catégorie** : 💼 Portefeuille · **Taille** : L
Épopée : [#47](47-epopee-un-seul-produit.md) · Prérequis : #49, **accord de #52**

## Objectif
Produire, une fois par mois, un **run reproductible** : l'univers éligible, la sélection, et le plan de trade de chaque titre retenu.
Le **rythme est mensuel, pas quotidien** — c'est la seule cadence pour laquelle des chiffres existent ; un rapport quotidien
inviterait à agir plus souvent que la stratégie ne le prévoit et détruirait son avantage en frais et en bruit.

## Critères d'acceptation
- [ ] Tables `reco.runs` et `reco.items` créées avec RLS ; un run est **rejouable à l'identique** depuis ces tables.
- [ ] `runs` porte `run_date`, **`strategie`** (identifiant de version, ex. `mom12_1+weinstein+regime@v1`), `univers`, `eligibles`, **`regime_ok`**, `n_selection`.
- [ ] `items` porte rang, `mom_12_1`, `weinstein_ok`, clôture, **entrée/stop/cible**, `risque_pct`, `taille_pct`, `ratio`, ATR, RSI, volume $, `statut`.
- [ ] **Weinstein est un interrupteur, pas un critère de tri** : un titre qui échoue **n'est pas remplacé** par le suivant du classement — sa part reste en liquidités. *(Le remplacer inverse l'effet : pire baisse mesurée −57,4 % contre −47,5 %.)*
- [ ] **Régime global** : si moins de la moitié de l'univers éligible est au-dessus de sa MM200, le run est **intégralement en liquidités** — mais il **produit quand même un run** avec `regime_ok = false` et zéro sélection. *L'absence de recommandation est une information.*
- [ ] **Plafond de 20 % par ligne obligatoire** — sans lui un titre à stop serré produit des tailles absurdes (un titre bloqué sur un prix d'OPA sortait à 224 %).
- [ ] Statuts calculés : `dv_m < 0,5 M$` → `Liquidite insuffisante` · `atr_pct < 0,5` → `Prix fige` (profil d'OPA) · `cible <= entrée` → `Deja au plus haut` · sinon `Actif`.
- [ ] La **sélection est une interface remplaçable** : changer de règle validée ne touche pas la tuyauterie.
- [ ] **Dérogations journalisées** : quand Jean passe outre l'interrupteur, c'est enregistré — pour mesurer plus tard ce que son jugement coûte ou rapporte.
- [ ] Exécution **par lots** (le scan complet dépasse le timeout de 60 s) ; job **mensuel** séparé du job **quotidien** de mise à jour des cours.

## Niveaux du plan de trade
```
entrée      = ouverture de la séance suivant le run
stop        = min( plus_bas_10_séances − 0,25 × ATR14 , clôture − 1,5 × ATR14 )
cible       = plus_haut_52_semaines
risque_pct  = (entrée − stop) / entrée
taille_pct  = min( budget_risque_pct / risque_pct , 20 )
ratio       = (cible − entrée) / (entrée − stop)
```
Poche satellite **30 000 $** · `budget_risque_pct` par défaut **1,0**.

## Décisions
- **Mise à jour des données ≠ production de recommandations** : deux jobs distincts, le quotidien reste léger et gardé par le quota.
- Ordonnancement en **GitHub Action planifiée** (TypeScript) plutôt que pg_cron : versionné, testable, pas de timeout.

## Questions ouvertes
- **Ces niveaux sont-ils adossés à une mesure ?** Si #52 conclut que le stop dégrade la stratégie, soit on l'enlève, soit #54/#55 disent explicitement que c'est le garde-fou de Jean et non un résultat. **À trancher à la sortie de #52.**
- Déclenchement : automatique en fin de mois **et** bouton « lancer maintenant » — Jean veut les deux.

## Notes / risques
- `strategie` est ce qui permettra de mesurer plus tard la performance réelle des recommandations **par version** : ne jamais le laisser vide.
