# #100 — Filet de sécurité du rapport (alerte d'échec + répétition générale)

**Statut** : 🧪 À valider · **Points** : 3 · **Catégorie** : ⚙️ · **Priorité** : ⭐

Demandé et lancé en prod par Jean le 30/09/2026, après l'incident ci-dessous.

## Incident du 27 au 29/09/2026
Le contrôle de fraîcheur du workflow triait les ~650 000 barres journalières pour trouver
la dernière : la requête a fini par dépasser le `statement_timeout` de 3 s du rôle `anon`
(erreur 500 → `curl` code 22). **Trois passages en échec, aucune alerte** : le pré-rapport
du 29/09 n'est jamais parti, et Jean l'a découvert par le silence. Cause profonde côté
process : #96 a été clos **sans passage réel sur GitHub** (le `workflow_dispatch` prévu au
plan n'a jamais été fait). Correctif immédiat : `fd351b6` — la fraîcheur se lit sur la
dernière barre de **SPY** (clé primaire, 0,25 s).

## Objectif
Qu'un échec du rapport ne puisse plus passer en silence, et qu'on sache **avant** la date
butoir si la chaîne marchera.

## Critères d'acceptation
- [ ] Tout passage du workflow « Rapport mensuel » en échec envoie une notification push **« TVLite — rapport en ÉCHEC »** avec la date et l'heure.
- [ ] Le **22 de chaque mois** (18 h 30 à Toronto l'été), une répétition générale fait tourner la chaîne sur les vraies données : contrôle de fraîcheur, inventaire, rapport, pré-rapport, présence du secret de notification.
- [ ] La répétition **ne publie rien** : aucun commit, `rapport.html`, marqueurs et `etat.json` intacts ; notification **« TVLite — répétition OK »** si tout passe, « en ÉCHEC » sinon.
- [ ] Lancement manuel possible : Actions → Rapport mensuel → Run workflow, cases `repetition` et `simuler_echec`.
- [ ] Le passage normal du soir J est inchangé.
- [ ] **Preuve** : liens des passages GitHub réels (répétition et échec simulé) ci-dessous.

## Décisions
- **Le 22** : hors de la fenêtre de cron 25→2, donc aucun double passage ; laisse 3 jours pour corriger avant le pré-rapport le plus précoce (25 février).
- **`--sortie`** pour la répétition : c'est déjà le mode « n'écrit que la page demandée » de #96.
- **Pas de notification de succès du soir J** : la notification « nouveau rapport » en tient lieu. Seul l'échec est ajouté.
- **Règle de process** : aucune automatisation n'est déclarée livrée sans un passage réel sur GitHub, lien dans le ticket.

## Vérifications faites
- *(à compléter avec les liens des passages)*

## Notes / risques
- Un soir où GitHub ne lance pas du tout le cron (panne, retard > fenêtre), il n'y a pas d'échec à signaler, donc pas d'alerte. La répétition du 22 ne couvre pas ce cas ; en septembre, les passages ont bien été lancés (avec 3 h de retard).
- La répétition d'août/septembre n'aurait pas forcément vu le timeout : il dépend de la charge de la base au moment de la requête. Le correctif SPY supprime la cause ; l'alerte couvre le reste.
