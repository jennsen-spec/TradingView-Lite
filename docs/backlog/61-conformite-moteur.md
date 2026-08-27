# #61 — Test de conformité moteur ↔ rapport

**Statut** : 🧪 À valider · **Points** : 3 · **Catégorie** : ⚙️ Technique · **Priorité** : —

## Objectif
Le rapport (cycleCalc) et le backtest (moteur) sont deux implémentations de la même
stratégie. L'audit du 27/08 les a comparées à la main — trois écarts trouvés, corrigés.
Garantir en continu qu'elles choisissent les mêmes titres : à chaque rapport, le moteur
tourne sur le même univers et la sélection est comparée automatiquement. Demandé par Jean
le 27/08 (« on en est certain ? »).

## Critères d'acceptation
- [x] À chaque `npm run rapport`, la sélection du moteur est comparée à celle du rapport
      sur le dernier mois que le moteur sait tracer.
- [x] Écart détecté → la commande échoue avec les deux listes affichées ; l'Action ne
      publie pas (même mécanique que le garde-fou de fraîcheur).
- [x] Conformité affichée dans le rapport : « conformité moteur : OK — mois vérifié AAAA-MM ».
- [x] Le coût est nul en pratique (le journal du backtest est déjà construit par page.ts).

## Décisions
- **Bloquer, pas avertir** : un rapport dont la sélection diverge du backtest est un
  rapport faux ; le publier avec un avertissement serait pire que ne rien publier.
- Le moteur ne trace que les mois ayant un successeur : on vérifie le dernier mois
  COMPLET précédent, pas le signal du soir. Ça détecte toute dérive d'implémentation,
  qui est le risque réel — pas une divergence propre à un seul mois.

## Plan technique
1. Dans page.ts : extraire les retenus du dernier mois du journal (déjà en mémoire),
   les comparer à un `calculerCycle({ signal: cetteFinDeMois })`. → vérif : OK sur les
   données courantes.
2. Injecter une divergence artificielle (plafond modifié) → la commande doit échouer
   avec les deux listes. → vérif : le message montre l'écart.
3. Ligne « conformité » dans l'en-tête du rapport. → vérif : visible.

## Notes / risques
- Si les deux implémentations divergent sur un point que le mois vérifié n'exerce pas
  (ex. égalité de momentum jamais rencontrée), le test ne le voit pas — c'est un filet,
  pas une preuve. La revue manuelle reste la référence à chaque changement de règles.

## Journal du sprint
- 27/08 16 h 30 : implémenté. `journal.ts` expose `moteurDernier` (dernier mois investi du
  moteur, tickers triés) ; `page.ts` rejoue `calculerCycle` sur ce signal et compare —
  écart → deux listes affichées, `process.exit(1)`, l'Action ne publie pas. Ligne
  « conformité moteur : OK — mois vérifié AAAA-MM » au pied du rapport. Vérifs : OK sur
  les données courantes (2026-06-30, 10/10 identiques) ; divergence injectée (liste
  amputée) → échec propre, code 1, listes lisibles ; code restauré, re-run OK.
  UAT réelle : la répétition générale du soir même l'exerce de bout en bout.
