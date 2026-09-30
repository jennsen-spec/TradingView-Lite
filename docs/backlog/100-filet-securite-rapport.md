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
dernière barre de **SPY** (clé primaire, 0,25 s), remplacé le même jour par **XSP.TO** : c'est la référence de l'interrupteur, cotée à Toronto comme l'univers du duo — SPY suit le calendrier américain (Memorial Day du 31/05/2027 = fin de mois où Toronto est ouverte).

## Objectif
Qu'un échec du rapport ne puisse plus passer en silence, et qu'on sache **avant** la date
butoir si la chaîne marchera.

## Critères d'acceptation
- [x] Tout passage du workflow « Rapport mensuel » en échec envoie une notification push **« TVLite — rapport en ÉCHEC »** avec la date et l'heure.
- [x] Le **22 de chaque mois** (18 h 30 à Toronto l'été), une répétition générale fait tourner la chaîne sur les vraies données : contrôle de fraîcheur, inventaire, rapport, pré-rapport, présence du secret de notification.
- [x] La répétition **ne publie rien** : aucun commit, `rapport.html`, marqueurs et `etat.json` intacts ; notification **« TVLite — répétition OK »** si tout passe, « en ÉCHEC » sinon.
- [x] Lancement manuel possible : Actions → Rapport mensuel → Run workflow, cases `repetition` et `simuler_echec`.
- [x] Le passage normal du soir J est inchangé.
- [x] **Preuve** : liens des passages GitHub réels (répétition et échec simulé) ci-dessous.

## Décisions
- **Le 22** : hors de la fenêtre de cron 25→2, donc aucun double passage ; laisse 3 jours pour corriger avant le pré-rapport le plus précoce (25 février).
- **`--sortie`** pour la répétition : c'est déjà le mode « n'écrit que la page demandée » de #96.
- **Pas de notification de succès du soir J** : la notification « nouveau rapport » en tient lieu. Seul l'échec est ajouté.
- **Règle de process** : aucune automatisation n'est déclarée livrée sans un passage réel sur GitHub, lien dans le ticket.

## Vérifications faites
- **Répétition réelle sur GitHub, 30/09 15 h 12** : [run 36764034111](https://github.com/jennsen-spec/TradingView-Lite/actions/runs/36764034111) — succès en 55 s, rapport + pré-rapport générés, **aucun commit** (`origin/main` inchangé), notification « répétition OK » : `envoyees:3, echecs:0`.
- **Échec simulé sur GitHub, 30/09 15 h 13** : [run 36764173409](https://github.com/jennsen-spec/TradingView-Lite/actions/runs/36764173409) — en échec comme prévu, aucune étape de publication lancée, notification « rapport en ÉCHEC » : `envoyees:3, echecs:0`.
- **Répétition sur XSP.TO, 30/09 15 h 23** : [run 36765292841](https://github.com/jennsen-spec/TradingView-Lite/actions/runs/36765292841) — succès, notification `envoyees:3`.
- **Soir J, 30/09 17 h 45** : [run 36781458341](https://github.com/jennsen-spec/TradingView-Lite/actions/runs/36781458341) — signal 2026-08-31 → **2026-09-30**, toutes les étapes en succès (rapport, DUO.MOM, publication `6054b62`, notification `envoyees:3`, libellés de la collection), alerte d'échec non déclenchée. Clôtures du rapport recoupées avec Yahoo sur 9 titres (XSP.TO 76,72 · AMD.TO 110,45 · HMM-A.TO 28,17…) : identiques au centime — les barres de mi-séance du 30/09 ont bien été remplacées.

## Notes / risques
- Un soir où GitHub ne lance pas du tout le cron (panne, retard > fenêtre), il n'y a pas d'échec à signaler, donc pas d'alerte. La répétition du 22 ne couvre pas ce cas ; en septembre, les passages ont bien été lancés (avec 3 h de retard).
- La répétition d'août/septembre n'aurait pas forcément vu le timeout : il dépend de la charge de la base au moment de la requête. Le correctif SPY supprime la cause ; l'alerte couvre le reste.
