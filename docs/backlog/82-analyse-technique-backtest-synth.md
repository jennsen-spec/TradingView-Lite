# #82 — Analyse Technique & Backtest SYNTH

**Statut** : 📥 Backlog · **Points** : 8 · **Catégorie** : 💼 Portefeuille · **Taille** : L

## Objectif
Faire de l'**analyse technique sur les instruments synthétiques** (surtout **MOM.SYNTH**, désormais
quotidien) et **backtester** des règles de timing pour trouver **le meilleur positionnement** :
quand **entrer** / **sortir** du portefeuille selon la lecture technique de sa propre courbe.

## Principe
Traiter la courbe SYNTH comme un **cours** et lui appliquer des règles TA, puis mesurer l'effet
(rendement, pire baisse, % de temps investi, nb d'aller-retours) **vs le SYNTH nu** (buy-and-hold).
Exemples de règles à tester :
- **Filtre de tendance** : investi seulement si SYNTH **> SMA 200j** (ou **400j**) ; sortie sinon.
- **Croisements** : golden/death cross (SMA courte × longue) sur la courbe synth.
- **RSI** : sortir en surachat / rentrer en survente, ou éviter d'être investi sous un seuil.
- **Swing trading** : entrées/sorties sur signaux, détention plus courte.

## Critères d'acceptation (première passe)
- [ ] Un backtest applique une (des) règle(s) TA de timing sur la **courbe SYNTH quotidienne** et
      compare à la courbe nue : **multiple, CAGR, pire baisse, % investi, nb de trades**.
- [ ] Au moins **3 règles** comparées (ex. SMA 200, SMA 400, RSI) + le buy-and-hold de référence.
- [ ] **Résultat lisible** : tableau récap (et/ou overlay de la courbe « timée » sur la courbe nue).

## Questions ouvertes (à trancher au raffinement)
- **Quel SYNTH ?** MOM.SYNTH (la stratégie) et/ou EQ.SYNTH (le portefeuille perso) ?
- **Où ?** Backtest côté **labo** (script + tableau), overlay dans **TVLite**, ou les deux ?
- **Fréquence des décisions** de timing : quotidienne, hebdo, mensuelle (aligné rebalancement) ?
- **Méthodo** : la courbe MOM.SYNTH est déjà **biaisée survivant** et **ancrée sur les clôtures
  mensuelles** (lissée intra-mois) → vérifier que faire du timing dessus a un sens ; et **le duo a
  déjà un interrupteur MM150 (XSP)** → risque de **redondance** avec un filtre de tendance sur la NAV.
- **Anti-overfitting** : rejouer la discipline de découpage sélection/validation de #52/#50 (ne pas
  choisir la règle qui « colle » le mieux au passé).

## Notes / risques
- **Overfitting** : le piège n°1 (cf. #52). Une règle qui embellit le backtest n'est pas une découverte.
- Timer sa propre NAV = « market timing » sur un actif **déjà filtré** par l'interrupteur → mesurer le
  gain **marginal** réel, pas l'effet du filtre déjà présent.
- Dépend de **#79** (MOM.SYNTH quotidien = la matière première).
