# #62 — Coût des poids dérivants (reconduites non redimensionnées)

**Statut** : ✅ Fait · **Points** : 3 · **Catégorie** : 💼 Portefeuille · **Priorité** : —

## Objectif
Le backtest remet les dix lignes à parts égales chaque mois, reconduites comprises, sans
ordre et sans frais ; en pratique Jean ne retouche pas une ligne reconduite. C'est la
seule divergence assumée entre le modèle et la pratique (protocole, clause Pondération,
relevée par Jean le 27/08) — mais son coût n'est pas mesuré. Le mesurer, et inscrire le
chiffre au protocole.

## Critères d'acceptation
- [x] Un grand livre « poids dérivants » : une ligne reconduite garde sa valeur ; seules
      les entrantes se partagent les liquidités libérées par les sortantes, à parts égales
      entre elles.
- [x] Comparaison contre le grand livre équipondéré sur 2004-2026 : capital final,
      croissance/an, pire baisse, épisodes < −20 %.
- [x] Un chiffre unique en points de croissance annuelle, inscrit à la clause Pondération
      du protocole, avec la date de mesure.
- [x] Si l'écart dépasse ~0,5 pt/an : décision explicite de Jean (redimensionner en vrai,
      ou accepter l'écart).

## Décisions
- La mesure se fait dans le **journal en dollars** (journal.ts), pas dans le moteur : c'est
  lui qui modélise l'argent réel, et la réconciliation à 1e-14 près contre le moteur reste
  le témoin de l'équipondéré.

## Questions ouvertes
- Quand une sortante libère moins que la part théorique des entrantes, l'entrante est plus
  petite qu'une reconduite — accepter (fidèle à la pratique) ou lisser ? Proposition :
  accepter, c'est exactement ce que le compte réel fera.

## Plan technique
1. Variante dans journal.ts (`ponderation: "derivante"`) : reconduite → mise = fin du mois
   précédent ; entrantes → se partagent le solde restant. → vérif : la somme des mises
   égale le solde à chaque mois.
2. Grand livre comparé, 2004-2026. → vérif : l'équipondéré reproduit 702 188 $ à l'identique.
3. Protocole : chiffre + date à la clause Pondération. → vérif : republication.

## Journal du sprint
- 27/08 16 h 25 : implémenté et mesuré. `construireJournal({ ponderation: "derivante" })` :
  une reconduite garde sa valeur de fin de mois, les entrantes se partagent l'argent des
  sortantes ; sans entrante, le cash dort — comme le compte réel. Contrôles : l'équipondéré
  reproduit 702 188 $ (écart 2,4e-14 %) ; en dérivante les mises ne dépassent jamais le
  solde (3,5e-14 %). **Résultat : équipondéré 19,68 %/an · −27,8 % ; dérivante 19,73 %/an
  · −30,1 %.** Écart +0,05 pt/an — sous le seuil de 0,5 : aucune décision forcée, ne rien
  retoucher est validé. Chiffre inscrit au protocole (clause Pondération). La leçon utile :
  le −27,8 % du modèle se vivra plutôt comme un −30 %.

**UAT validée par Jean le 29/08/2026** → ✅ Fait.
