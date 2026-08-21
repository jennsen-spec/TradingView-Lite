# #52 — Exploration & décision de stratégie  *(porte de validation)*

**Statut** : 🔍 Affiné · **Points** : 8 · **Catégorie** : 💼 Portefeuille · **Taille** : L · **Priorité** : ⭐
Épopée : [#47](47-epopee-un-seul-produit.md) · Prérequis : #50 · **Bloque** : #53, #54, #55

## Objectif
Jean compose ses jeux de règles, le labo dit ce qu'ils valent, **on tranche ensemble**.
Aucun paramètre n'est figé dans le pipeline avant cette porte.

## Ce qui n'a jamais été testé — la liste à couvrir
- **Tout stop en cours de mois**, fixe ou suiveur. *Le protocole momentum n'a JAMAIS été testé avec le moindre stop* : le stop et la cible dessinés aujourd'hui ne font partie d'aucune mesure. **Priorité n°1.**
  ⚠️ Deux pièges : un stop suiveur **entre en conflit avec le rebalancement mensuel** (il sort d'un titre qui serait resté n°1) ; et le rendement du décile 1 est **concentré dans une poignée de titres** — un stop peut couper exactement ce qui fait l'avantage. À mesurer, pas à supposer. Conclure « pas de stop » est un résultat valide.
- **La force relative isolée**, en tri puis en filtre. Meilleure piste inexploitée : la colonne existe déjà sur 22 ans, `XIU.TO`/`XWD.TO` sont chargés, et la seule variante technique qui s'en sortait à peu près est la seule qui en contenait un bout — sans jamais l'isoler.
- **La cible** (plus-haut 52 semaines) — jamais mesurée.
- **Le nombre de lignes** : 7 / 10 / 15 — aucune sensibilité mesurée.
- **La durée de détention** : seul 1 mois testé.
- **La pondération** : équipondéré vs inverse de la volatilité.
- **Un plafond de concentration sectorielle** (l'univers de test est à ~48 % or/uranium/cannabis/lithium/crypto).
- **Les variantes de momentum** : 6-1, 12-1, absolu vs relatif.
- **Le RSI comme filtre de tempérage**, isolé.
- **Weinstein et le filtre de régime avec le découpage sélection/validation** — le trou que Cowork a laissé (ils ont été choisis *après* avoir vu les données).

## Critères d'acceptation *(= la porte)*
- [ ] Chaque jeu de règles retenu est mesuré **sur les deux univers** (106 titres/22 ans **et** pan-canadien).
- [ ] Le **stop** a été mesuré : on sait s'il protège ou s'il coupe la queue qui porte le rendement.
- [ ] Weinstein et le régime ont reçu le **découpage sélection/validation**.
- [ ] Un **seuil de liquidité unique** est arrêté (500 k$) **et** un **plancher de prix** est fixé — le volume seul ne protège pas des titres à moins de 1-2 $, où l'écart achat-vente est brutal.
- [ ] **Décision écrite** : l'écart contre benchmark apparié reste-t-il positif **des deux côtés du découpage**, et la pire baisse de la variante retenue reste-t-elle **sous 40 %** ?
- [ ] **Si non : on ne l'adopte pas et on le dit** — on n'ajuste pas les paramètres jusqu'à ce que ça passe.
- [ ] **Accord explicite de Jean** consigné dans ce ticket avant l'ouverture de #53.

## Décisions
- Trois manettes agissent sur le **même** problème (« est-ce un pari déguisé sur les cycles de ressources ? ») : **seuil de liquidité**, **plancher de prix**, **plafond sectoriel**. À régler ensemble, pas séparément.
- Descendre à 500 k$ **élargit vers le TSXV** et **aggrave** la concentration sectorielle : les deux réglages se compensent.

## Questions ouvertes
- Si le pan-canadien **infirme** le résultat des 106 titres : abandon, ou restriction à un sous-univers ?
- Le seuil de liquidité videra le rapport certains mois. **Reco : rapport vide assumé** — un mois sans candidat est une information. À confirmer par Jean.

## Notes / risques
- **Le pan-canadien ne couvre qu'un régime** (5-8 ans, pas 2008) : il dit si l'effet existe hors d'un univers atypique, **pas** comment ça se comporte en crise. Seul Swing Mastery répond à ça. Les deux sont complémentaires — ne pas remplacer l'un par l'autre.
- **La stratégie perd actuellement** (S1 2026 : décile 1 −31 % vs univers −2 %). Utile comme cas de test : le filtre de régime devrait sortir du marché — vérifier qu'il le fait.
- **Modèle : Fable.**
