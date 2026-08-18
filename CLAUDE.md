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
- **Sprint** (dans la conversation principale) : **RÈGLE — ne JAMAIS démarrer un ticket de toi-même.** Un ticket *Affiné* reste *Affiné* tant que Jean n'a pas dit explicitement « on sprinte le #X ». Implémente **contre les critères d'acceptation** (= definition of done + grille UAT), puis passe le ticket À valider.
- **UAT** : Jean valide contre les critères d'acceptation → Fait, ou retour en refinement.

## Coordination entre conversations
Plusieurs conversations peuvent tourner en parallèle (ex. une en refinement, une en sprint). Elles se synchronisent **uniquement via les fichiers du dépôt**. Éviter d'écrire le **même fichier** au même moment ; en pratique :
- **Refinement (nous)** — écrit `docs/backlog/*.md` **et** prononce le **Ready (DoR)** : passe le ticket à 🔍 Affiné dans le ticket **et** dans l'index `ROADMAP.md`. Décider si un ticket est *Ready*, c'est notre rôle.
- **Sprint / UAT (les autres)** — écrit le code source et fait avancer les statuts d'exécution (🏗️ En cours → 🧪 À valider → ✅ Fait). Le **Done (DoD)** se juge là, pas en refinement.
