# Archive — résultats du labo (#50), avant suppression du schéma `research`

Sauvegardé le 22/08/2026, au moment du nettoyage « une seule base ».
Le code du labo reste dans `labo/` ; ces chiffres se régénèrent avec `npm run labo`.

## Jeux de règles

**`reference-mom-12-1` v1** — momentum 12-1, décile supérieur équipondéré, mensuel,
exécution à l'ouverture du lendemain. Filtres : `dv50 ≥ 500 000` et `historique ≥ 253` barres.
Pas d'interrupteur. Frais 0,35 % aller-retour, détention 1 mois.

**`demo-3-emplacements` v1** — démonstration des trois emplacements (pas une stratégie candidate) :
tri momentum 12-1, filtre `close > SMA150`, interrupteur `XIU > SMA200`.

## Mesures — écart contre benchmark apparié, net de frais (pt/mois)

| Jeu | Univers | Période | Mois | Écart net | t net | Pire baisse | % investi |
|---|---|---|---:|---:|---:|---:|---:|
| reference | research | sélection 2004-15 | 133 | +1,05 | **1,68** | −53,5 % | 100 % |
| reference | research | validation 2016-26 | 126 | +2,03 | 2,72 | −44,0 % | 100 % |
| reference | research | total | 259 | +1,53 | 3,15 | −53,5 % | 100 % |
| reference | market | sélection | 217 | +1,71 | 2,13 | −69,6 % | 100 % |
| reference | market | validation | 126 | +2,33 | 4,14 | −32,7 % | 100 % |
| reference | market | total | 343 | +1,94 | 3,54 | −69,6 % | 100 % |
| demo-3-empl. | research | sélection | 133 | +0,85 | 1,28 | −49,1 % | 73 % |
| demo-3-empl. | research | validation | 125 | +0,69 | 0,82 | −27,9 % | 76 % |
| demo-3-empl. | research | total | 258 | +0,77 | 1,46 | −49,1 % | 74 % |

Références : XIU.TO +0,63 %/mois · XWD.TO +0,71 %/mois (période totale research).

## Ce qu'il faut retenir
- Sur la **période de sélection seule**, t = 1,68 → **non significatif**. Le t de 3,63 du brief
  d'origine était un t **global**, soit la mesure que le découpage sert justement à ne pas croire.
- La **pire baisse dépasse partout les 40 %** sans interrupteur.
- L'interrupteur de démonstration ramène la pire baisse à −27,9 % en validation, mais **écrase l'écart**.
- Univers `market` avant 2016 : médiane 13 titres éligibles → **résultats fragiles**, à ne pas surinterpréter.

**Cartouches de validation consommées : 1** (le 21/08, recette du mécanisme).
