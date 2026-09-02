# #89 — Onglet « Rapport » mobile (épopée #70)

**Statut** : 🔍 Affiné · **Points** : 2 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : après [#84](84-coquille-mobile.md) ✅

## Objectif
Troisième onglet « Rapport » dans la barre mobile, qui affiche le **dernier rapport mensuel**
(`rapport.html`, généré dans `frontend/public/`) ; le bouton « Rapport » disparaît de la barre
d'outils en mobile (il faisait doublon et ouvrait un nouvel onglet navigateur).

## Critères d'acceptation
- [ ] En mobile, la barre du bas propose **Watchlist · Graphique · Rapport**.
- [ ] L'onglet Rapport affiche le dernier rapport mensuel dans le volet, scrollable au doigt.
- [ ] Le bouton « Rapport » de la toolbar n'apparaît plus en mobile ; **desktop inchangé** (bouton conservé, ouverture dans un nouvel onglet comme aujourd'hui).
- [ ] Basculer vers Rapport puis revenir ne fait pas perdre l'état du graphique (zoom, symbole).

## Décisions
- Le rapport est rendu dans une **iframe plein volet** (la page est autonome, même déploiement) — pas de réécriture du rapport.
- Iframe **montée à la première ouverture** de l'onglet (lazy), puis conservée — le rapport ne se recharge pas à chaque bascule.

## Questions ouvertes
- (aucune)

## Plan technique
1. `App.tsx` : `mobileTab` devient `"watchlist" | "chart" | "rapport"` ; 3ᵉ bouton dans `.bottom-tabs` ; volet `.rapport-area` avec iframe lazy vers `${import.meta.env.BASE_URL}rapport.html` → vérif : le rapport s'affiche dans l'onglet.
2. CSS : `.app.mobile .rapport-btn { display: none; }` + volet/iframe plein écran, `-webkit-overflow-scrolling` au besoin → vérif : plus de bouton Rapport dans la toolbar mobile, desktop intact.
3. Vérif conservation d'état : basculer Graphique → Rapport → Graphique, zoom conservé.

## Notes / risques
- Le rapport a son propre style : s'il n'est pas responsive, il se consulte en zoom/scroll dans l'iframe — son adaptation mobile, si besoin, sera un ticket à part.
