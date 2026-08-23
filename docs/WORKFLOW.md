# Workflow — TV-Like

Trois phases. Le dépôt git est le point de synchro (les conversations ne se parlent pas
directement, mais partagent ces fichiers). **Chaque conversation est autonome sur tout le
cycle d'un ticket** (DoR, sprint, DoD) — aucune n'est réservée au DoR ni au DoD ; éviter
seulement d'écrire le même fichier au même moment.

## Statuts d'un ticket
- 📥 **Backlog** — pas encore affiné (juste une ligne dans `ROADMAP.md`).
- 🔍 **Affiné** (Ready) — objectif + critères d'acceptation validés. Prêt à sprinter,
  mais **PAS** automatiquement dans un sprint.
- 🏗️ **En cours** — sélectionné manuellement pour le sprint courant + en implémentation.
- 🧪 **À valider** (UAT) — implémenté, en attente de la validation de Jean.
- ✅ **Fait** — UAT OK.

## 1. Refinement (grooming)
Peut se faire dans n'importe quelle conversation, y compris la principale.
Boucle : **Jean dit ce qu'il veut → Claude propose un plan → Jean valide → Claude écrit
le ticket** (`docs/backlog/<id>-<slug>.md`, `Statut: Affiné`) à partir du modèle.
Rester **court** (~une demi-page). Un quick win trivial peut sauter cette phase.
Quand le ticket est prêt (**DoR**), passer son statut à 🔍 Affiné dans **le ticket** et dans
l'index `ROADMAP.md`.

## 2. Sprint (n'importe quelle conversation)
**Gate manuel** : Claude ne démarre **jamais** un ticket de lui-même. Un ticket *Affiné*
reste *Affiné* tant que Jean n'a pas dit explicitement « on sprinte le #X ».
Au lancement : Claude passe le ticket **En cours**, implémente **contre les critères
d'acceptation**, se vérifie, puis passe **À valider**.

## 3. UAT
Jean teste contre les critères d'acceptation → **Fait**, ou retour en refinement pour
ajustements.

## Fichiers
- `ROADMAP.md` — **liste unique priorisée par l'ordre des lignes** (🔍 Prêt/DoR puis 📥 Backlog) ; catégorie = colonne (plus un axe de tri) ; déplacer un ticket = réordonner sa ligne.
- `docs/backlog/<id>-<slug>.md` — spec d'un ticket (**source de vérité** de la spec, pas la mémoire ni le chat).
- `docs/backlog/TICKET_TEMPLATE.md` — modèle.
