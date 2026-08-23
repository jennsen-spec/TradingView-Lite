# Portefeuille — l'état réel, et ce qui le distingue du backtest

`etat.json` est la mémoire du système : ce que Jean détient vraiment, ce qu'il a
vraiment payé, et ce qu'il a décidé de faire autrement que les règles.
Versionné dans git — pas de base de données, chaque changement est un diff lisible.

**Le principe qui structure tout : la prescription et l'exécution ne se mélangent
jamais.** Les règles disent quoi faire ; Jean décide ce qu'il fait. Un cycle porte
les deux, côte à côte. C'est ce qui rend le journal honnête, et c'est la seule
façon de mesurer plus tard ce que le jugement de Jean coûte ou rapporte.

## Les deux portefeuilles d'un seul compte

Le CELI porte deux stratégies qui ne se parlent pas :

- **La poche duo** (30 %) — momentum 12-1 sur Industrials + Technology, jeu de
  règles `c-duo-plaf5-p1`. Rebalancée tous les mois. Passe en liquidités quand
  l'interrupteur coupe (XSP sous sa MM150) ; les liquidités **restent en
  liquidités**, elles ne vont pas aux ETF.
- **La poche ETF** (40 ZEQT · 15 HXS · 15 VMO) — achat-conservation.
  Jean la pilote lui-même. Le système ne fait qu'**une** chose ici : répartir
  l'apport mensuel. Il ne déclenche jamais de vente d'ETF.

## L'apport mensuel — et ce que « 70/30 » veut dire ici

**Les 70/30 découpent ce que Jean VERSE, pas ce qu'il DÉTIENT.** Un apport de
1 000 $ donne 300 $ au duo et 700 $ aux ETF (400 / 150 / 150). Ensuite les deux
poches vivent leur vie : leurs poids dérivent librement et **on ne rééquilibre
jamais**. Si le duo triple, il pèse plus lourd dans le compte — c'est voulu.

Il n'y a donc **pas de poids cible du portefeuille**, donc pas de dérive à
corriger, donc aucune vente déclenchée par le système. Conséquence à connaître :
la poche qui compose le plus vite prend mécaniquement le dessus au fil des années,
et le profil de risque du compte se déplace tout seul vers celui du duo — la poche
qui possède l'interrupteur.

**Mécanique** : une cagnotte de liquidités par compartiment. Chaque apport les
alimente selon son ratio ; chacune achète le nombre entier de parts qu'elle peut ;
le reliquat reste dans sa cagnotte et attend. À 150 $/mois, HXS (109,30 $) achète
une part le premier mois, puis une autre quand la cagnotte a repassé le seuil.
Rien ne se perd, rien ne se vend.

Les 300 $ du duo ne se découpent pas en dix — 30 $ par ligne n'achète rien. Ils
rejoignent la poche et sont déployés au rebalancement de fin de mois, quand les
dix lignes sont de toute façon redimensionnées.

Le jour où les apports deviendront négligeables devant le capital accumulé, cette
logique n'aura plus d'effet et pourra être retirée.

## Le cycle mensuel

| Quand | Qui | Quoi |
|---|---|---|
| Clôture du dernier jour ouvrable | générateur | Signal, rapport, libellés de la collection |
| Ouverture du 1er jour | Jean | Passe les ordres — et déroge s'il veut |
| Après exécution | Jean → générateur | Prix et quantités réellement obtenus |

L'exécution suit la convention du backtest : signal lu à la **clôture** du dernier
jour du mois, ordre passé à l'**ouverture** du premier jour du suivant.

## Le code couleur des libellés (collection `duo-industrie-techno`)

| | Hex | Sens |
|---|---|---|
| Rouge | `#ef5350` | Vendre — sort ce mois-ci |
| Bleu | `#3f8cff` | Conserver — reconduit, aucun ordre |
| Vert | `#26a69a` | Acheter — entre ce mois-ci |
| Orange | `#ff9800` | En réserve — candidat 6e à 10e |
| Violet | `#9c27b0` | Dérogation — le titre que Jean a mis à la place |
| *(aucun)* | — | Archive — plus candidat, gardé en mémoire |

Aucun symbole n'est jamais retiré de la collection : ils reviennent.

## Les dessins posés sur les graphiques

- **Rectangle, modèle « Annonce »** — quantité, prix et momentum du titre à acheter.
  Jean le supprime après avoir passé l'ordre. C'est la **seule** source de la quantité.
- **Position longue, modèle « Suggest AI »** — entrée au prix d'exécution. Stop et
  cible **rabattus sur l'entrée** pendant la détention : la stratégie n'a ni stop ni
  cible, et en afficher un inviterait à un mécanisme que #52 a mesuré et rejeté.
  À la clôture de la position, le niveau utilisé prend le **prix de sortie réel** —
  zone verte au-dessus de l'entrée, rouge en dessous. Le dessin devient un compte rendu.

## Les dérogations

Trois portefeuilles sortent du même journal :

1. **Ce que les règles disaient** — théorique
2. **Ce que Jean a fait** — argent réel, dérogations comprises
3. **Ce que Jean aurait fait** — intuitions notées, non exécutées

La troisième courbe répond à « est-ce que mes lectures techniques valent la peine »
sans qu'elles aient coûté un dollar. Chaque dérogation porte un **motif écrit**
(« divergence RSI », « au contact d'une résistance »), pour qu'on puisse dire un jour
*quel type* de motif marche — pas seulement si la moyenne bat le backtest.

## Champs

- `repartition_apports` — découpe de chaque apport, somme = 1. **Ne décrit pas
  les avoirs** : pas de poids cible du portefeuille, pas de rééquilibrage.
- `regles.jeu` — le jeu de règles du labo qui fait foi (`labo/rulesets/`).
- `poche_duo.montant_initial` — la somme allouée au duo au départ : **15 000 CAD**.
  Divisée par 10, elle donne la taille d'une ligne : **1 500 CAD**.
- `etf.*.parts` — parts détenues. **À fournir** (Jean doit d'abord acheter).
- `etf.*.liquidites` — cagnotte du compartiment, en attente d'une part entière.
- `apports` — chaque versement : date, montant, répartition décidée, résidu reporté.
- `cycles` — un objet par rebalancement : signal, interrupteur, 20 candidats,
  ce qui était **prescrit**, ce qui a été **exécuté**.
- `derogations` — `{ cycle, sortant, entrant, motif, executee }`. `executee: false`
  = intuition notée mais non suivie ; elle alimente la 3e courbe.
