# #57 — Dessin « Divergence » (à cheval sur deux panneaux)

**Statut** : ✅ Fait · **Points** : 8 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : L · **Priorité** : ⭐

## Objectif
Un outil de dessin **inédit** (il n'existe pas sur TradingView, dont l'outil de divergence reste dans
un seul panneau) : un geste unique trace **deux flèches liées** — une dans le panneau d'un indicateur,
là où l'utilisateur clique, et une **miroir** dans le panneau du titre, accrochée toute seule aux bougies.

**Le mécanisme qui porte l'outil** : chaque flèche prend la couleur de **sa propre pente**.
Même couleur des deux côtés → pas de divergence. **Couleurs opposées → divergence**, visible sans rien lire.

## Le geste
1. L'utilisateur choisit l'outil, puis trace dans un panneau d'indicateur (RSI, ATR, RS…).
2. **1er clic** → la flèche démarre ; dans le panneau du titre, une flèche démarre sur la bougie de cette date.
3. **2e clic** → la flèche se ferme ; le miroir se ferme sur la bougie de cette date.

## Critères d'acceptation
- [x] L'outil est disponible dans la barre de dessin et se trace en **2 clics** dans un panneau d'indicateur.
- [x] Le tracé produit **deux flèches** : celle de l'indicateur aux points cliqués, celle du prix accrochée aux bougies.
- [x] **Couleur par flèche selon sa propre pente** : montante = bleu, descendante = rouge. Une divergence affiche donc une flèche bleue et une rouge.
- [x] **Ancrage automatique** : pente descendante → **plus haut** des bougies ; pente montante → **plus bas**. Forçable en Haut / Bas / Auto dans les Options.
- [x] Les deux flèches sont **un seul objet** : sélection, déplacement d'une extrémité, options et suppression agissent sur la paire.
- [x] Le dessin **survit au changement d'intervalle** : en hebdomadaire l'ancrage suit le haut (ou le bas) de la semaine.
- [x] Le dessin **suit le pan/zoom** et le redimensionnement des panneaux, comme les autres dessins.
- [x] Persistance par symbole, au même titre que les autres dessins.

## Décisions
- **Sens unique** : on trace dans un panneau d'indicateur, le miroir va toujours dans le panneau du titre. Pas de tracé inverse.
- **La flèche du prix ne stocke aucun prix** — seulement les deux **dates**. L'ancrage se recalcule à l'affichage
  depuis la bougie. C'est un modèle **inédit dans le fichier** : tous les autres dessins sont ancrés temps **+** prix.
- **Ancrage auto d'après la pente tracée**, forçable. « Toujours le plus haut » a été écarté : l'outil n'aurait
  servi que pour les divergences baissières.
- Un dessin doit désormais s'afficher dans **deux panneaux à la fois** ; `pane` reste l'ancrage
  (le panneau d'indicateur) et le panneau du titre est rendu en plus.

## Questions ouvertes
- Aucune au démarrage du sprint.

## Plan technique
1. Modèle : `type: "divergence"` + `DivergenceConfig { anchor: "auto" | "high" | "low" }` dans `lib/drawings.ts`.
   → vérif : un objet créé se relit après rechargement.
2. Résolution de l'ancrage : date → bougie → haut ou bas selon la pente. → vérif : la valeur correspond au O/H/L/C de la bougie.
3. Tracé en 2 clics dans un panneau d'indicateur + aperçu au curseur. → vérif : les deux flèches apparaissent ensemble.
4. Rendu dans les deux panneaux, couleur par pente. → vérif : une divergence affiche bleu + rouge.
5. Sélection / déplacement / suppression sur la paire. → vérif : bouger un bout bouge les deux.
6. Barre d'outils + dialogue Options (ancrage, couleurs, épaisseur). → vérif : forcer Haut/Bas change l'accrochage.

## Notes / risques
- **Le point délicat est le rendu bi-panneau.** `DrawingLayer` filtre aujourd'hui les dessins par panneau ;
  l'épisode des index logique/visuel (ATR passé en panneau visuel 0) a montré que cette zone est piégeuse.
- Un clic sur une barre future (« whitespace ») n'a pas de bougie : il faut se rabattre sur la plus proche.

## Résultat du sprint — 23 août 2026

Livré en une passe. **Vérifié sur AAPL, sur les chiffres et pas à l'œil** :
- ancrage auto : pente RSI montante (60,48 → 79,07) → le miroir s'accroche aux **creux**
  310,74 et 249,43, qui sont exactement les `low` des bougies du 2026-08-07 et 2024-12-31
  (et non leurs `high` de 314,81 / 253,28) ;
- couleurs : RSI montant = bleu, prix descendant = rouge → **la divergence se lit sans rien lire** ;
- changement d'intervalle : en hebdomadaire les deux flèches restent en place et se ré-ancrent ;
- sélection : **4 poignées** apparaissent (2 par flèche) → la paire est bien un seul objet,
  et la suppression retire les deux.

**Piège de recette rencontré** : deux clics synthétiques envoyés dans le même tick JS ne
produisent pas de tracé — `draftRef` n'est mis à jour qu'au rendu suivant. Ce n'est pas un
défaut du produit (un humain clique avec du délai), mais il faut espacer les clics pour tester.

**Non couvert volontairement** : la flèche miroir sélectionne la paire mais ne se déplace pas
directement (ses prix sont dérivés, pas stockés) — on déplace par la flèche de l'indicateur.
