# #105 — BUY EQ : remplir les parts depuis une capture Disnat

**Statut** : ❌ Abandonné (22/11/2026 — Jean préfère saisir les parts à la main) · **Points** : 5 · **Catégorie** : 💼 Portefeuille · **Taille** : M · **Priorité** : —

## Objectif
Dans BUY EQ ([#103](103-onglet-buy-eq.md)), joindre une **capture d'écran Disnat** (desktop ou
mobile) et voir les **parts des 5 ETF remplies toutes seules**, lues par Claude. Évite de
recopier 5 nombres à la main pour chaque compte (REER, CELI, CELIAPP).

## Critères d'acceptation
- [ ] Un bouton **« Lire une capture »** dans BUY EQ : sur iPhone il ouvre la photothèque, sur
      desktop un sélecteur de fichier (glisser-déposer en bonus).
- [ ] Les parts lues **remplissent les champs**, sans rien d'autre : l'utilisateur vérifie, corrige si besoin,
      et le calcul se fait comme d'habitude.
- [ ] Un ETF absent de la capture → **0** ; les titres hors poche ETF (duo : AMD, BB, DRX…) sont **ignorés**.
- [ ] Les **liquidités lues** sont affichées à côté du champ (« lu : 466,78 $ — utiliser »),
      **sans remplir le champ** : ce cash sert aussi au duo.
- [ ] Un bandeau dit ce qui a été lu (« Lu : HXS 65 · VMO 158 · ZAG 448 · ZEQT 0 · ZGLD 0 »).
- [ ] Lecture impossible (image floue, autre écran, erreur réseau) → message clair, champs inchangés.
- [ ] Recette : la capture desktop du 22/11 donne **HXS 65 · VMO 158 · ZAG 448 · ZEQT 0 · ZGLD 0**,
      liquidités 466,78 ; une capture mobile Disnat donne les bons nombres (UAT Jean).
- [ ] La clé API n'apparaît **nulle part** dans le frontend ni dans le dépôt.

## Décisions
*(tranchées avec Jean au raffinement, 22/11/2026)*
- **Lecture par Claude** (vision), plutôt que l'export CSV de Disnat ou une reconnaissance de texte
  dans le navigateur : robuste aux mises en page desktop et mobile, et ne confond pas
  « S&P **500** » avec la quantité.
- **La capture part chez Anthropic** (nom, n° de compte, montants) : accepté par Jean. Rien
  n'est stocké de notre côté : l'image transite par l'Edge Function, sans être écrite en base.
- **Liquidités proposées, pas remplies** (cash partagé avec le duo).
- Modèle par défaut : **Claude Opus 5.5** (`claude-opus-5-5`), effort `low`, sortie structurée
  (JSON : parts par ETF + liquidités). Coût ≈ 0,02 $ US par capture (voir Notes).

## Questions ouvertes
- Passer à Haiku 5.5 (≈ 40× moins cher) si Opus s'avère inutilement lourd ? À trancher après
  quelques captures réelles ; le coût d'Opus est déjà négligeable à ce volume.

## Plan technique
1. **Clé API** — Jean crée une clé sur console.anthropic.com (avec un petit crédit prépayé) et
   la pose en secret Supabase `ANTHROPIC_API_KEY` (je ne la saisis pas moi-même).
2. `supabase/functions/tvlite-api` — route `POST /lire-capture` : reçoit l'image (base64, ≤ 5 Mo,
   réduite côté client à 2000 px de large), appelle le SDK `@anthropic-ai/sdk` avec
   `output_config.format` (schéma JSON strict), renvoie `{ parts: {ZEQT…ZGLD}, liquidites }`.
   → vérif : la capture du 22/11 rend les bons nombres.
3. `lib/api.ts` — `lireCapture(file)` ; `BuyEqPanel.tsx` — bouton, état « lecture… », remplissage,
   bandeau, proposition des liquidités → vérif : desktop + iPhone réel.
4. Garde-fou : refuser une image > 5 Mo et limiter la route (pas d'appel sans image).

## Notes / risques
- **Coût** (tarifs Anthropic du 03/11/2026) : une capture ~2 000×900 px ≈ 1 500–2 500 jetons
  d'entrée + ~300 de consignes ; sortie ~200–500 jetons (JSON + réflexion à effort bas).
  | Modèle | Entrée /M | Sortie /M | ≈ par capture |
  |---|---|---|---|
  | Opus 5.5 | 4 $ | 20 $ | **~0,02 $** |
  | Sonnet 5.5 | 2 $ | 10 $ | ~0,01 $ |
  | Haiku 5.5 | 0,10 $ | 0,50 $ | ~0,0005 $ |
  À ~10 captures par mois (3 comptes, quelques reprises) : **~0,20 $ US/mois avec Opus**.
  Supabase : dans l'offre gratuite actuelle.
- Disnat peut changer sa mise en page : Claude s'adapte mieux qu'un parseur, mais la
  vérification visuelle avant calcul reste la règle.
- Une seule capture = un seul compte : pour un rebalancement global, ressaisir la somme
  (ou une future évolution : additionner plusieurs captures).
