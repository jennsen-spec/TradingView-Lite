# TV-Like — instructions projet

TradingView allégé, mono-utilisateur (frontend React+TS+Vite `frontend/` · backend Node + `node:sqlite` `backend/`, données Yahoo Finance). Détails process : `docs/WORKFLOW.md`.

## Source de vérité (à lire au démarrage d'une conversation)
- `ROADMAP.md` (racine) — backlog **priorisé par l'ordre des lignes** (section 🔍 Prêt/DoR en tête, puis 📥 Backlog) ; **catégorie = colonne** (plus un axe de tri) ; points, statuts, liens vers les tickets.
- `docs/backlog/<id>-<slug>.md` — **spec détaillée d'un ticket** (source de vérité de la spec — pas la mémoire, pas le chat).
- `docs/backlog/TICKET_TEMPLATE.md` — modèle de ticket.
- `docs/WORKFLOW.md` — le process complet.

## Workflow (scrum en 3 phases, synchronisé via ce dépôt git)
Statuts d'un ticket : 📥 Backlog → 🔍 Affiné → 🏗️ En cours → 🧪 À valider (UAT) → ✅ Fait.

- **Refinement (grooming)** : Jean décrit ce qu'il veut → tu proposes un plan → il valide → **TU écris le ticket affiné** dans `docs/backlog/<id>-<slug>.md` (à partir du modèle). Rester court (~½ page). Objectif + critères d'acceptation + décisions + questions ouvertes + plan technique.
- **Sprint** (n'importe quelle conversation) : **RÈGLE — ne JAMAIS démarrer un ticket de toi-même.** Un ticket *Affiné* reste *Affiné* tant que Jean n'a pas dit explicitement « on sprinte le #X ». Implémente **contre les critères d'acceptation** (= definition of done + grille UAT), puis passe le ticket À valider.
- **UAT** : Jean valide contre les critères d'acceptation → Fait, ou retour en refinement.

## Coordination entre conversations
Plusieurs conversations peuvent tourner en parallèle. Elles se synchronisent **uniquement via les fichiers du dépôt** ; éviter d'écrire le **même fichier** au même moment.
**Chaque conversation est autonome sur tout le cycle d'un ticket** : n'importe laquelle peut l'affiner (→ 🔍 Affiné / **DoR**), le sprinter (🏗️ En cours → 🧪 À valider) **et** le clore (→ ✅ Fait / **DoD**). Aucune conversation n'est cantonnée au DoR ni au DoD. Celle qui fait avancer un ticket met à jour **le ticket** `docs/backlog/*.md` **et** l'index `ROADMAP.md`.
