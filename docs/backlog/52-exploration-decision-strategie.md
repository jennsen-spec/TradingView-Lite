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
- [ ] Chaque jeu de règles retenu est mesuré **sur les deux univers** (106 titres/22 ans **et** pan-canadien : **505 titres à ≥ 5 ans, 450 à ≥ 8 ans** — mesuré le 21/08, le brief disait 336/299).
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
- **Le pan-canadien ne couvre qu'un régime** (35 titres seulement atteignent 10 ans — mesuré ; donc pas 2008) : il dit si l'effet existe hors d'un univers atypique, **pas** comment ça se comporte en crise. Seul Swing Mastery répond à ça. Les deux sont complémentaires — ne pas remplacer l'un par l'autre.
- **La stratégie perd actuellement** (S1 2026 : décile 1 −31 % vs univers −2 %). Utile comme cas de test : le filtre de régime devrait sortir du marché — vérifier qu'il le fait.
- **Modèle : Fable.**

---

## Résultat de l'exploration — 22-23 août 2026

**Statut de la porte : NON FRANCHIE.** La configuration ci-dessous est **provisoire** — Jean a
indiqué qu'il la confirmerait prochainement. Ne pas figer #53/#54/#55 dessus avant sa confirmation
écrite ici.

### Configuration provisoirement retenue

```
TRIER         momentum 12-1, les 20 premiers, équipondérés
FILTRER       dv50 ≥ 500 k$/jour · historique ≥ 253 séances
INTERRUPTEUR  cash si XSP.TO ≤ sa MM150   (S&P 500 couvert)
PLAFOND       au plus 4 lignes par secteur
```

Jeu de règles : `labo/rulesets/c-plaf4.json` · mesure : 270 mois (2004-02 → 2026-07),
univers pan-canadien assaini, rendements totaux dividendes inclus, frais 0,35 % par entrée.

| | Capital | Croissance/an | Vol | Pire baisse | Épisodes < −20 % |
|---|---:|---:|---:|---:|:---:|
| Momentum 12-1 nu | ×99,9 | 22,7 % | 28,0 % | −50,3 % | 9 |
| + interrupteur XSP | ×56,5 | 19,6 % | 22,3 % | −27,4 % | 4 |
| **+ plafond 4/secteur** | **×41,2** | **18,0 %** | **17,2 %** | **−23,8 %** | **1** |
| Achat-conservation XIU.TO | ×7,9 | 9,6 % | 13,4 % | −43,7 % | 2 |

### Ce que couvre cette exploration, point par point de la liste ci-dessus

- **Stop en cours de mois** (priorité n°1) — **mesuré, écarté**. Stop volatilité 2 σ mensuels,
  recalculé au rebalancement et vérifié sur chaque clôture : capital ×49,3 contre ×60,9, et la
  pire baisse **empire** (−48,0 % contre −46,0 %). Le mécanisme est visible sur un cas tracé
  (CG.TO, mars 2008 : stoppé à −21,8 %, le titre rebondit le lendemain ; sans stop, −13,3 %).
  Conclusion « pas de stop » — exactement le résultat valide que le ticket anticipait.
- **Force relative isolée** — **mesurée**. RS de Mansfield contre XIU en tri, filtre cours > SMA150 :
  pire baisse −46,0 % contre −50,3 %, et achète des titres moins tendus (+115 % de hausse préalable
  contre +145 %). Mais 59 % des lignes restent communes au momentum. Améliore peu, ne remplace pas.
- **Durée de détention** — **mesurée, écartée**. 3 mois : capital divisé par deux et baisse **plus
  profonde** (−58,1 %). Surtout, les trois calendriers trimestriels possibles donnent ×48,7 / ×29,5 /
  ×33,0 — du simple au double selon le mois de départ. **C'est du bruit, pas un résultat** : raison
  suffisante d'écarter la détention trimestrielle sans discuter sa performance.
- **Plafond de concentration sectorielle** — **mesuré, RETENU**. Le premier secteur pesait 44 % du
  portefeuille en moyenne et jusqu'à 95 % ; il tombe à 20 % / 21 % max. Plafond par **secteur** bat
  plafond par **industrie** (−23,8 % contre −34,3 %) : découper finement laisse passer Or, Argent,
  Autres métaux précieux et Cuivre comme quatre paniers, donc l'exposition aux métaux reste entière.
- **Weinstein / filtre de régime avec découpage** — **mesuré**. La pente haussière de la MM150
  n'apporte rien une fois l'interrupteur en place (×56,0 contre ×56,5) et le dégrade légèrement.
- **Nombre de lignes** — non mesuré (20 fixé pour rendre les variantes comparables entre elles).
- **Cible (plus-haut 52 semaines)**, **pondération**, **momentum 6-1**, **RSI en tempérage** — non mesurés.

### L'interrupteur : le résultat qui tient le mieux

Cinq mécanismes différents donnent le même effet — l'exact contraire d'un réglage chanceux :

| Interrupteur | Capital | Pire baisse | Épisodes < −20 % |
|---|---:|---:|:---:|
| aucun | ×99,9 | −50,3 % | 9 |
| XSP < MM150 | ×56,5 | −27,4 % | 4 |
| XSP < MM200 | ×56,2 | −27,4 % | 4 |
| XIU < MM150 | ×39,1 | −34,0 % | 5 |
| XIU < MM200 | ×30,1 | −29,9 % | 6 |
| largeur de marché < 50 % | ×66,8 | −30,1 % | 4 |

**Témoin décisif** : le même interrupteur appliqué à l'indice nu, **sans aucune sélection de titres**
(XSP acheté seulement au-dessus de sa MM150) fait passer la pire baisse de −54,8 % à **−17,1 %**,
avec **zéro** plongeon sous −20 % en 22 ans. L'interrupteur ne doit donc rien au tri momentum.

### Interrupteurs PAR SECTEUR — mesurés, écartés

Un interrupteur par secteur (ETF sectoriel sous sa MM150 → secteur fermé) au lieu d'un seul global :

| Variante | Capital | Pire baisse | Épisodes < −20 % |
|---|---:|---:|:---:|
| Interrupteur global (référence) | ×41,2 | −23,8 % | 1 |
| Portes sectorielles, mode *réallouer* | ×41,1 | −38,6 % | 4 |
| Portes sectorielles, mode *cash* | ×21,5 | −26,4 % | 2 |

Fermer un secteur ne réduit pas l'exposition, ça la **déplace** : on reste 100 % investi mais plus
concentré sur les secteurs restants, et en 2008 ils tombent à leur tour. Le mode *cash* protège mais
coûte la moitié du capital. **Limite du test** : seuls 5 secteurs sur 12 ont un ETF remontant à 2003
(XGD, XEG, XFN, XIT, XRE) ; l'industrie — 3,6 lignes en moyenne, saturée 69 % du temps — n'en a
aucun avant 2012 et a été rattachée à XIU. Le test dit que les portes **telles qu'on peut les
construire aujourd'hui** n'apportent rien, pas que l'idée est morte.

### Réserves — à lire avant de figer quoi que ce soit

- **Aucune validation hors échantillon.** Interrupteur et plafond ont été choisis en voyant les
  données. Cinq mécanismes concordants, c'est solide ; ce n'est pas une validation.
- **L'écart de sélection n'est pas démontré sur la validation seule.** Mesuré correctement (mois
  investis uniquement, sinon les mois en liquidités comptent à tort comme un échec de sélection) :
  +1,11 pt/mois (t = 2,63) sur 2004-2015 et +1,12 pt (t = **1,66**) sur 2016-2026 pour l'interrupteur
  seul ; +0,79 / +0,89 (t = 1,79) avec le plafond. **L'estimation est remarquablement stable des deux
  côtés**, significative sur l'ensemble (t ≈ 2,8-2,9), mais sous le seuil sur la seule validation.
- **17 jeux de règles testés** → une gagnante apparaît par hasard. Ce qui est retenu ici n'est pas la
  meilleure des 17, c'est la seule famille dont **tous** les membres marchent.
- **Biais du survivant non corrigé** : les 611 titres sont ceux encore cotés en 2026. Les capitaux
  absolus en héritent, les comparaisons de baisse non.
- **Secteurs = classement Yahoo d'aujourd'hui**, appliqué à tout le passé ; 45 titres non classés.
- **Critère « pire baisse < 40 % » du ticket : atteint** (−23,8 %).

### Outillage construit (labo/)

`qualite.ts` (détection des séries corrompues — retrouve les 8 ruptures de RIO.TO annoncées par
l'analyse du 22/08, et le périmètre actions canadiennes hors ETF/cotations étrangères) ·
`secteurs.ts` (secteurs Yahoo, 566/611 classés, cache local) · `etfSectoriels.ts` (ETF sectoriels
depuis Yahoo) · `courbes.ts` (capital + sous-l'eau + épisodes) · `comparer.ts` (`npm run labo:comparer`).
Moteur : dividendes, stop, `detention_mois` 1-12 à valorisation mensuelle et poids dérivants,
`cash_sous`, `plafond`, `portes_secteur`, force relative de Mansfield.
**Rien n'est écrit dans Supabase par le labo** (caches locaux gitignorés).

Deux défauts du moteur trouvés et corrigés en route : les mois où toutes les portes étaient fermées
disparaissaient de la mesure (10 sur 270) ; et le benchmark apparié était calculé sur l'univers déjà
filtré par les portes, donc la stratégie était comparée à un univers purgé de ce qu'elle évitait.

### Restitution déjà produite

- Artifacts : [Quatre stratégies sous l'eau](https://claude.ai/code/artifact/2ff84961-7660-46f9-80b9-798440e60afc)
  et [Protéger le momentum canadien](https://claude.ai/code/artifact/d62222b3-5fd6-49e4-ad5f-891db31d8d56).
- Collection **`MB-2025-2026`** écrite dans `tvlite_prefs` : 92 symboles en 11 sections + 144 dessins
  « Position longue » au modèle *Backtest* (janvier 2025 → juin 2026). Convention : le niveau non
  utilisé est écrasé sur le prix d'entrée, pour ne faire apparaître que la zone gagnante **ou**
  perdante. Bilan de ces 144 trades : 70 gagnants (49 %), gain moyen +3,0 %, meilleur +97 %, pire −41 %.

---

## DÉCISION DE JEAN — 23 août 2026

**Statut de la porte : FRANCHIE.** Jean a tranché explicitement dans la conversation du 23/08 :
« *je vais retenir la règle « Industrie + techno · 10 lignes + interrupteur + plafond 5 »* ».
La configuration ci-dessous **remplace** la configuration provisoire de la section précédente.

### Configuration retenue

```
UNIVERS       actions canadiennes assainies, secteurs Industrials + Technology uniquement (94 titres)
TRIER         momentum 12-1, les 10 premiers, équipondérés
FILTRER       dv50 ≥ 500 k$/jour · historique ≥ 253 séances · PLANCHER DE PRIX ≥ 1 $
INTERRUPTEUR  liquidités si XSP.TO ≤ sa MM150   (S&P 500 couvert)
PLAFOND       au plus 5 lignes par secteur
FRAIS         commission 0 $ (Disnat / BNCD) + fourchette de 2 pas de cotation ÷ prix d'achat
EXÉCUTION     signal à la clôture de la dernière séance du mois,
              ordre au marché à l'ouverture de la première séance du mois suivant
```

Jeu de règles : **`labo/rulesets/c-duo-plaf5-p1.json`** · la restriction sectorielle est appliquée
à **l'univers**, pas par le jeu de règles. Mesure : 270 mois (2004-02 → 2026-07).

> Le plancher de 1 $ et le modèle de frais ont été arrêtés le 23/08 — voir la section
> « Plancher de prix & seuil de liquidité » en fin de ticket. Le tableau ci-dessous est celui
> de la configuration **sans plancher et au forfait 0,35 %** (`c-duo-plaf5.json`), conservé
> parce que c'est la base sur laquelle la décision de Jean a été prise.

| | Capital | Croissance/an | Vol | Pire baisse | Ép. < −20 % | Investi | Écart sél. 04-15 | Écart val. 16-26 |
|---|---:|---:|---:|---:|:---:|---:|---|---|
| **Duo · 10 + interr. + plafond 5** | **×44,1** | **18,3 %** | 17 % | **−27,3 %** | **1** | 73 % | +0,84 (t=3,29) | +0,74 (t=1,57) |
| Duo · 10 lignes, sans interrupteur | ×69,8 | 20,8 % | 23 % | −45,9 % | 5 | 100 % | +0,49 (t=2,46) | +0,73 (t=1,82) |
| Duo · 20 lignes + interrupteur | ×16,8 | 13,4 % | 13 % | −17,6 % | 0 | 73 % | +0,23 (t=1,67) | +0,24 (t=0,89) |
| *Référence tous secteurs (`c-plaf4`)* | *×42,0* | *18,1 %* | *17 %* | *−23,8 %* | *1* | *73 %* | *+0,82 (t=2,70)* | *+0,90 (t=1,79)* |

### Ce que la décision assume — dit une fois, pour mémoire

Le duo **n'améliore pas** la configuration tous-secteurs de façon mesurable : ×44,1 contre ×42,0,
18,3 % contre 18,1 %/an — et sa **pire baisse est un peu plus profonde** (−27,3 % contre −23,8 %),
son *t* de validation un peu plus faible (1,57 contre 1,79). Les deux secteurs ont par ailleurs été
retenus **après** avoir vu quels secteurs portaient l'avantage (Technology t=2,85, Industrials
t=2,03) : c'est un choix fait sur les données, donc non validé hors échantillon. Sur 94 titres au
lieu de 611, la stratégie est aussi plus exposée à la disparition d'un titre. **Jean a tranché en
connaissance de ces chiffres.** Ils sont consignés ici pour qu'un futur écart de performance ne
soit pas relu comme une surprise.

### Critères d'acceptation — état

- [x] Le **stop** a été mesuré → écarté (voir section précédente).
- [x] Weinstein / régime avec découpage sélection-validation → mesuré, n'apporte rien.
- [x] **Décision écrite** : écart positif des deux côtés du découpage (+0,84 / +0,74) ; pire baisse
      −27,3 %, sous le plafond de 40 % fixé par le ticket.
- [x] **Accord explicite de Jean** — consigné ci-dessus, 23/08/2026.
- [ ] **Mesure sur les deux univers** — la configuration n'a été mesurée que sur `market`.
      L'univers `research` n'a pas été passé.
- [ ] **Plancher de prix** — toujours pas fixé. Seul le seuil de liquidité (500 k$) est arrêté.

### Capacité — mesuré le 23/08, à connaître avant #53

La mise par ligne rapportée au volume en dollars du titre (moyenne 50 j), sur les 1 950 lignes-mois :

| Capital de départ | Médiane | 9ᵉ décile | Maximum |
|---|---:|---:|---:|
| 10 000 CAD | 0,1 % | 1,3 % | 10 % |
| 90 000 CAD | 1,1 % | 11,6 % | **86 %** |

À 10 000 CAD la stratégie est exécutable. À 90 000 CAD elle ne l'est plus sur les titres les plus
fins : au dernier rebalancement, la mise vaudrait 79 % d'une journée de volume sur DBO.TO, 38 % sur
FLT.TO — et l'encan d'ouverture ne pèse lui-même que quelques pour cent de la journée. **Le facteur
limitant de cette stratégie est la capacité, pas le rendement.** Remonter le seuil de liquidité et
poser le plancher de prix sont le même réglage que ce problème.

### Journal complet des opérations

[Grand livre du duo industrie-techno](https://claude.ai/code/artifact/de97d43d-a27a-4ac3-95a8-4c378993a159) —
632 positions, 2 020 lignes-mois, 284 mois, de 10 000 CAD (déc. 2002) à 608 815 CAD. Le solde du
journal égale celui du moteur à 2×10⁻¹⁴ % près, mois après mois.

---

## PLANCHER DE PRIX & SEUIL DE LIQUIDITÉ — mesuré le 23 août 2026

Ferme le critère d'acceptation resté ouvert. Mesuré sur le duo (94 titres, 270 mois, 2004-02 → 2026-07).

### Le modèle de frais devait changer d'abord

Le forfait de 0,35 % mélangeait **commission** et **fourchette acheteur-vendeur**. Chez Disnat
comme chez BNCD, la commission sur actions et FNB en ligne est de **0 $** (grille vérifiée le
23/08 sur disnat.com/plateformes-et-frais/tarification). Il ne reste que la fourchette — qui
n'est facturée par personne mais bien perdue dans le prix, et qui ne dépend pas d'un pourcentage
mais du **pas de cotation rapporté au prix** : un cent d'écart coûte 0,01 % sur un titre à 100 $
et 1,5 % sur un titre à 0,66 $.

Sous un forfait identique pour tous, **un plancher de prix ne peut par construction rien
économiser** : le moteur facture pareil un titre à 0,66 $ et un titre à 250 $. La mesure exigeait
donc d'abord un modèle de frais sensible au prix. Ajouté au moteur : `frais_fourchette:
{ ticks, commission }` → coût d'entrée = `commission + ticks × pas de cotation ÷ prix d'achat`,
lu **ligne par ligne**. Le pas de cotation du TSX est 0,005 $ sous 0,50 $, 0,01 $ au-delà.
Refactor vérifié neutre : sous le forfait, la référence redonne exactement ×44,1.

Repère utile : le forfait historique de 0,35 % équivaut presque exactement à une fourchette de
**4 pas de cotation** (×44,1 contre ×44,4). Le chiffre publié n'était donc pas optimiste.

### Résultats — planchers, sous 4 modèles de frais

| Plancher | forfait 0,35 % | 1 pas | 2 pas | 4 pas | Pire baisse (2 pas) | Écart sél. | Écart val. |
|---|---:|---:|---:|---:|---:|---|---|
| aucun | ×44,1 | ×51,6 | ×49,1 | ×44,4 | −26,5 % | +0,90 (t=3,49) | +0,80 (t=1,70) |
| **1 $** | **×45,0** | **×52,9** | **×50,5** | **×46,0** | **−26,5 %** | **+0,90 (t=3,48)** | **+0,82 (t=1,75)** |
| 2 $ | ×37,9 | ×44,6 | ×42,7 | ×39,1 | −24,1 % | +0,86 (t=3,37) | +0,73 (t=1,58) |
| 3 $ | ×27,3 | ×32,3 | ×31,1 | ×28,8 | −24,5 % | +0,72 (t=2,85) | +0,56 (t=1,23) |
| 5 $ | ×25,5 | ×30,3 | ×29,3 | ×27,4 | −26,2 % | +0,70 (t=2,86) | +0,50 (t=1,15) |

### Contrôle de robustesse — indispensable ici

Les écarts de capital final sont **trompeurs**. Comparé à la référence sans plancher :

| Variante | Lignes-mois modifiées | Années pires | Années meilleures | Écart annuel médian |
|---|---:|---:|---:|---:|
| plancher 1 $ | 14/1950 (0,7 %) | **0/23** | 2/23 | 0,00 % |
| plancher 2 $ | 29/1950 (1,5 %) | 6/23 | 5/23 | 0,00 % |
| plancher 3 $ | 75/1950 (3,8 %) | 11/23 | 7/23 | 0,00 % |
| plancher 5 $ | 148/1950 (7,6 %) | 11/23 | 11/23 | 0,00 % |
| dv ≥ 1 M$ | 239/1950 (12,3 %) | **17/23** | 5/23 | **−1,42 %** |
| dv ≥ 2 M$ | 486/1950 (24,9 %) | **18/23** | 4/23 | **−4,30 %** |
| dv ≥ 5 M$ | 763/1950 (39,1 %) | 16/23 | 7/23 | **−3,19 %** |

Le passage de ×49,1 à ×42,7 au plancher 2 $ vient de **quatre lignes** sur 1 950 (2006, 2013,
2020, 2023) ; l'année médiane est inchangée et six années sont pires contre cinq meilleures.
**C'est du bruit.** En revanche, l'écart moyen contre benchmark décroît de façon monotone avec le
plancher (+0,90 → +0,70 en sélection) : au-delà de 2 $ on commence à écarter les gagnants
extrêmes qui portent le rendement du momentum — exactement le risque que ce ticket anticipait.

### Décisions

- **Plancher retenu : 1 $ — CONFIRMÉ PAR JEAN le 23/08/2026** (« va pour 1 $ »). Gratuit par toutes les mesures — **zéro année sur 23 en recul**,
  14 lignes-mois modifiées sur 1 950, écart contre benchmark inchangé. Il supprime les 3 seules
  positions de l'histoire dont la fourchette (1,46 % aller-retour) dépasse tout ce que le modèle
  facture, et ces 3 positions avaient perdu de l'argent. Jeu de règles : `c-duo-plaf5-p1.json`.
- **2 $ : proposé, écarté par Jean.** Pile ou face sur le rendement (année médiane 0,00 %) pour
  −2,4 points de pire baisse. Documenté ici au cas où la tolérance à la baisse changerait ;
  il écarterait DBO.TO du portefeuille courant.
- **3 $ et plus : écartés.** L'écart contre benchmark se dégrade sans contrepartie.
- **Ne PAS remonter le seuil de liquidité.** À 2 M$, 18 années sur 23 sont pires, l'année médiane
  perd 4,30 %, et l'écart de validation tombe à +0,08 (t = 0,23) — indiscernable de zéro. **Le
  rendement de cette stratégie vit dans les petites capitalisations.** Le seuil de 500 k$ est
  confirmé, non par confort mais parce que le remonter détruit l'effet mesuré.

### Conséquence sur la capacité — le vrai plafond

Mise par ligne rapportée au volume quotidien en dollars :

| | Médiane | 9ᵉ décile | Maximum |
|---|---:|---:|---:|
| 10 000 CAD, plancher 1 $ | 0,12 % | 1,4 % | 11 % |
| 90 000 CAD, plancher 2 $ | 1,04 % | 10,5 % | 81 % |
| 90 000 CAD, plancher 2 $ + dv ≥ 2 M$ | 0,38 % | 1,9 % | 8 % |

Le plancher **ne règle pas** le problème de capacité (81 % contre 96 % au maximum). Le seuil de
liquidité, lui, le règle — mais il tue la stratégie en même temps. **Les deux manettes que #52
voulait régler ensemble tirent en sens contraire, et il n'existe pas de position qui satisfasse
les deux.** Conclusion à assumer : cette stratégie a un plafond de taille structurel, de l'ordre
de quelques dizaines de milliers de dollars. Ce n'est pas un réglage à trouver, c'est une limite.

### Critères d'acceptation — état

- [x] **Plancher de prix fixé** : **1 $**, confirmé par Jean le 23/08/2026 (option 2 $ documentée, écartée).
- [x] **Seuil de liquidité unique arrêté** : 500 k$, confirmé par mesure.
- [ ] **Mesure sur les deux univers** — l'univers `research` n'a toujours pas été passé.

## Mesure du 26/08 — interrupteur « séance entière sous la moyenne » (demande de Jean)
Variante : ne couper que si la dernière séance du signal s'est déroulée **entièrement**
sous la moyenne (ouverture ET clôture), au lieu de la seule clôture. But : éviter les
cassures d'un jour aussitôt rachetées.

**Duo, 2004→2026, vendre d'abord** : ×52,8 contre ×41,7 (+1,3 pt/an), **même pire
baisse (−27,8 %) et même 2008 (−3,8 %)**. Seuls **7 mois sur 270** divergent — la
clôture coupait, la séance entière restait investie : 5 gagnants sur 7, +21,9 % en
cumul (2006-07, 2007-07/08, 2009-04, 2011-10, 2015-01, 2018-04). Mais 6 de ces 7
mois sont dans la moitié de SÉLECTION ; la validation n'apporte qu'un seul point.

**Contre-épreuve S&P 500, 98 ans** : +0,18 pt/an, 14 mois divergents sur 1 175
(8 positifs, t = 1,05 — non significatif), **krachs identiques** sauf Internet
2000-02 (−16,9 % contre −15,2 % : sortie un mois plus tard). Jamais catastrophique :
4 décennies mieux, 1 pire (années 60), 5 neutres.

**Lecture** : le mécanisme est réel (la règle ne sort jamais PLUS TÔT ; son seul
risque structurel est un mois de retard dans une cassure violente, payé 1,7 pt une
fois en 98 ans), la direction est favorable sur les deux jeux de données, mais la
preuve est mince (t ≈ 1). Décision non prise — inscrite pour la revue d'hiver.
Indicateur `<ticker>_jour_sous_sma<N>` ajouté au moteur.

## DÉCISION du 26/08 — l'interrupteur passe à « séance entière »
Jean adopte la variante. Nouveau jeu de règles : `c-duo-plaf5-p1-seance`
(`xsp_jour_sous_sma150 < 1`). `portefeuille/etat.json` y pointe désormais ;
l'ancien `c-duo-plaf5-p1` reste au dépôt pour reproduire les mesures antérieures.

**Ce que la décision repose sur** : ×52,8 contre ×41,7 sur la fenêtre 2004-2026
(×70,2 contre ×55,4 sur la fenêtre du grand livre, même rapport), **pire baisse
inchangée à −27,8 %**, 2008 inchangé à −3,8 %, un seul épisode sous −20 % dans les
deux cas. Sept mois divergents sur 270, +21,9 % cumulés.

**Ce qu'elle ne repose PAS sur** — à garder au dossier : six de ces sept mois sont
dans la moitié de SÉLECTION ; sur 98 ans de S&P 500 l'écart est de +0,18 pt/an avec
**t = 1,05**, donc indiscernable du hasard. Ce qui rend le choix défendable n'est pas
la force de la preuve mais **la borne du risque** : la règle ne sort jamais PLUS TÔT
que l'ancienne, son seul défaut structurel est un mois de retard dans une cassure
violente (mesuré une fois en 98 ans : bulle internet, −1,7 pt).

**Corrigé au passage** : le rapport mensuel calculait son grand livre en « même
encan » alors que tous les documents publiés sont en « vendre d'abord ». Deux
capitaux différents pour une même stratégie dans un même dossier. `page.ts` passe
désormais `differe: "cloture"` et l'affiche explicitement.

`cycleCalc` accepte maintenant les deux formes d'interrupteur (`_sur_smaN` et
`_jour_sous_smaN`) et le rapport dit laquelle il applique.

### Correctif du 26/08 — l'hypothèse d'exécution appartient au JEU DE RÈGLES
Elle vivait dans les *appels* : `page.ts` passait « vendre d'abord », mais
`npm run labo` et `npm run labo:comparer` prenaient le défaut « même encan » sans
rien dire. Sur le duo, l'écart n'est pas cosmétique : **×52,9 contre ×62,4**.

`execution.achat_differe: "cloture"` est désormais déclaré dans
`c-duo-plaf5-p1-seance.json` **et** dans `c-duo-plaf5-p1.json` — sans quoi comparer
les deux jeux ferait apparaître un écart qui ne viendrait que de l'hypothèse.
`construireJournal` lit la clause du jeu (`opts.differe` ne sert plus qu'aux mesures
de sensibilité qui comparent exprès les deux) et **renvoie l'hypothèse appliquée** ;
le rapport l'affiche au lieu de la forcer, et signale en gras si elle n'est pas
celle du dossier. Vérifié : les deux jeux reproduisent 702 188 $ et 554 017 $.

### Mesure du 26/08 (soir) — l'interrupteur lu en mensuel : écarté
Jean avait pensé l'interrupteur sur la **bougie mensuelle** (le mois qui ouvre *et*
ferme sous la moyenne), pas sur une seule séance. Deux lectures possibles, toutes
deux mesurées : moyenne lue à chaque bout de la bougie (`mois_sous_smaN`) ou une
seule valeur en fin de mois (`moisfin_sous_smaN`).

| | ×final | 2004-2015 | 2016-2026 | pire baisse | ép. −20 % | mois liquide |
|---|---|---|---|---|---|---|
| MM150 séance entière *(retenue)* | ×52,9 | 19,9 % | 18,6 % | −27,8 % | **1** | 67 |
| MM150 bougie mensuelle | ×39,2 | 17,2 % | 18,3 % | −28,9 % | 2 | 50 |
| MM150 bougie, moyenne de fin | ×32,0 | 17,8 % | 15,4 % | −28,9 % | 2 | 52 |
| MM200 séance entière | ×51,9 | 19,5 % | 18,9 % | −32,6 % | 1 | 64 |
| MM200 bougie mensuelle | ×54,9 | 17,3 % | 22,0 % | −28,9 % | 3 | 50 |
| MM200 bougie, moyenne de fin | ×49,4 | 16,3 % | 22,0 % | −28,9 % | 3 | 49 |
| Sans interrupteur | ×90,2 | 18,3 % | 26,7 % | −42,3 % | 4 | 0 |

**Le défaut est structurel, pas statistique.** Pour qu'une bougie mensuelle soit
entièrement sous la moyenne, il faut que le mois ait *déjà ouvert* dessous — or un
krach part toujours d'en haut. Mars 2020 le montre : la séance du 28 février s'ouvre
et ferme sous la MM150, la règle retenue coupe et fait 0 % ; la bougie de février
s'était ouverte le 3 bien au-dessus, la lecture mensuelle reste investie et encaisse
**−22,4 %**. Sur les 25 mois de divergence en MM150, la règle retenue cumule +8,3 %
contre −13,5 %.

**MM200 mensuel est le seul piège.** Capital final supérieur (×54,9), mais 7ᵉ sur
neuf en première moitié et 2ᵉ en seconde — le classement s'inverse, signature du
bruit. Les trois premières places de la seconde moitié sont tenues par les trois
configurations qui protègent le moins (0, 50 et 49 mois en liquidités) : cette
moitié ne contient pas 2008, donc moins d'assurance y paraît toujours meilleur.

`indicateurMarche` accepte désormais `<ref>_mois_sous_smaN` et
`<ref>_moisfin_sous_smaN`. **Non porté dans `cycleCalc`** : la règle vivante reste
`xsp_jour_sous_sma150`, inutile de compliquer le chemin de production.

### Correctif du 26/08 (soir) — une ligne périmée dans le protocole
La ligne « sans interrupteur » de la section 04 était restée à ×69,8 / −45,9 % / 5
épisodes alors que la mesure sur les règles courantes donne **×90,2 / −42,3 % / 4**.
Elle avait échappé à la relecture du 26/08 au matin, qui l'annonçait pourtant corrigée.

### Relevé par Jean le 27/08 — la contradiction pondération / exécution
Le protocole disait à la fois « un titre reconduit est redimensionné chaque mois »
(section 01) et « un titre reconduit ne fait l'objet d'aucun ordre » (section 02).
Les deux clauses nomment désormais la réalité : le BACKTEST remet les dix lignes à
parts égales chaque mois, sans ordre et sans frais (vérifié dans `journal.ts` :
`mise = solde / n` chaque mois, l'écart porté par `ajustements`) ; la PRATIQUE ne
retouche pas une ligne reconduite, donc les poids réels dérivent. C'est la seule
divergence assumée entre le modèle et la pratique. **Son coût n'est pas mesuré** —
mesure proposée à Jean (variante du moteur à poids dérivants sur les reconduites).
