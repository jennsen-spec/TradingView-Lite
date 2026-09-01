# #80 — Fiche détail des synthétiques (panneau collection)

**Statut** : ✅ Fait (2026-09-01) · **Points** : 2 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : S

## Objectif
Dans le volet détail de la collection (`WatchlistDetail`), les champs Yahoo (Volume, Volume
moyen, Capitalisation) sont **vides pour un synthétique**. Les remplacer par une fiche utile.

## Réalisé
Quand le symbole est synthétique (`isSynthetic`), on affiche à la place :
- **Type** (portefeuille / backtest · base 100 · CAD), **valeur** courante.
- **Composition** (EQ.SYNTH : 60 % actions / 10 % oblig / 30 % or) ou **Stratégie** (MOM.SYNTH :
  duo secteur momentum, 10 lignes, plafond 5, interrupteur séance MM150).
- **Perf. depuis l'origine** (+% · ×), **Croissance/an** (CAGR), **Pire baisse**, **Période** —
  toutes **calculées depuis la série déjà chargée** (`syntheticMetrics`), rien n'est dupliqué.
- **Badge « NON validé »** (ambre) pour MOM.SYNTH (biais du survivant, pas de stop).

Détails de perf vérifiés à l'écran : EQ.SYNTH +60,1 % / ×1,6 / −10,1 % · MOM.SYNTH ×42,9 / +18,2 %/an / −28,5 %.

## Fichiers
- `frontend/src/lib/portfolios.ts` : `syntheticDetail()` (texte statique) + `syntheticMetrics()` (calcul).
- `frontend/src/components/WatchlistDetail.tsx` : branche synthétique.
- `frontend/src/styles.css` : `.wl-syn-desc`, `.wl-syn-badge`.
