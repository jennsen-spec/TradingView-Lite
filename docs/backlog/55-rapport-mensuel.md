# #55 — Rapport mensuel (page HTML archivée)

**Statut** : 🔍 Affiné · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : M
Épopée : [#47](47-epopee-un-seul-produit.md) · Prérequis : #53

## Objectif
Une page autonome par run, archivée, qui rend le système **auditable dans un an** : ce qui a été sélectionné,
ce qui a été écarté et pourquoi, et comment le run précédent s'est comporté face à ses références.

## Critères d'acceptation
- [ ] Page **autonome** (CSS et JS en ligne, **aucune ressource externe**), servie à `/rapport/<AAAA-MM>` et archivée.
- [ ] Lisible en **thème clair et sombre**, **sans défilement horizontal** (tableaux dans un conteneur qui défile seul).
- [ ] **En-tête** : date du run, **version de stratégie**, taille de l'univers, nombre de sélections.
- [ ] **Bandeau de régime** : quand `regime_ok` est faux, dire en clair que le protocole recommande les liquidités.
- [ ] **La sélection** : rang, `mom_12_1`, drapeau Weinstein, plan de trade complet.
- [ ] **Les écartés avec leur motif** — cette section a autant de valeur que les autres : elle montre que le filtre travaille.
- [ ] **Comparaison** : performance du run précédent contre **`XIU.TO`** et **`XWD.TO`**.
- [ ] **Pied de page** : protocole, limites connues, date des données, mention de l'ajustement des prix.
- [ ] **Interdits, vérifiés à la relecture** : score de confiance, probabilité de succès, rendement attendu, « forte conviction ». Le rapport présente des **niveaux et des filtres** ; la décision reste au lecteur.
- [ ] Si les niveaux stop/cible ne sont adossés à aucune mesure (sortie de #52), le rapport **le dit explicitement**.

## Décisions
- Le rapport est **produit par le pipeline**, pas rédigé : mêmes données que `reco.items`, aucune interprétation ajoutée.
- Un mois sans candidat produit **quand même un rapport** (voir #53).

## Questions ouvertes
- Archivage : dans le dépôt (`docs/rapports/`) ou servi depuis Supabase ? — à trancher au sprint selon le poids.

## Notes / risques
- La section « limites » doit rappeler que le rendement absolu mesuré est **biaisé par le survivant** et n'est **pas une prévision**. Seul l'**écart contre benchmark apparié** est défendable.
