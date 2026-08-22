# #56 — Force relative (RS Mansfield) dans TVLite

**Statut** : 🧪 À valider (UAT) · **Points** : 8 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : L · **Priorité** : ⭐

## Objectif
Afficher la **force relative** d'un titre contre une référence, dans un panneau dédié sous le graphique.
C'est l'indicateur qui manque avant de reprendre l'analyse technique : il dit si un titre **bat le marché**,
pas seulement s'il monte.

## Décisions (prises au refinement du 22/08)
- **Formule : Mansfield / Weinstein** — cohérente avec la MM150 que Jean utilise déjà.
  ```
  ratio(t)     = adj_close(titre, t) / adj_close(référence, t)
  mansfield(t) = (ratio(t) / MM_n(ratio, t) − 1) × 100
  ```
  Oscille autour de **zéro** : au-dessus, le titre surperforme la référence.
- **Référence par défaut : `XIU.TO`** (TSX 60) — la plus profonde dont on dispose (1999, 27 ans),
  donc le RS est calculable sur la quasi-totalité de l'historique des titres.
- **Affichage : panneau séparé**, comme le RSI — la seule option lisible, les valeurs Mansfield
  n'ayant aucun rapport avec l'échelle des prix.
- **Cours ajustés des dividendes des DEUX côtés.** Sans ça, un titre à 5 % de rendement paraît
  structurellement faible. La table `dividends` et la fonction `adj_close()` sont en place (#49).

## Critères d'acceptation
- [x] Un panneau **« RS »** s'affiche sous le graphique, avec une **ligne zéro** marquée.
- [x] La valeur du RS à la date du curseur apparaît dans la légende du panneau (comme le RSI).
- [x] La **référence est réglable** via ⚙ (liste des 20 ETF chargés), défaut `XIU.TO`.
- [x] La **longueur de la moyenne** s'adapte à l'intervalle : 252 séances en journalier, 52 en
      hebdomadaire, 12 en mensuel — soit ~52 semaines dans les trois cas. Réglable.
- [x] Les deux séries sont **ajustées des dividendes** ; une case ⚙ permet de revenir au cours brut.
- [x] **Alignement par date** : si la référence n'a pas de barre à une date donnée, on reporte la
      dernière valeur connue. Aucune date du titre ne doit disparaître du graphique.
- [x] Le RS **n'est pas calculé** tant qu'il n'y a pas assez d'historique (moins de `n` barres
      communes) — pas de valeur fantaisiste en début de série.
- [x] Réglages persistés (`tvlike:indicator-settings`) et **visibilité par intervalle**, comme les autres.
- [ ] Un titre sans recouvrement avec la référence affiche un panneau **vide et explicite**, pas une erreur.

## Plan technique
1. **Endpoint** : ajouter `&adjusted=1` à l'API candles → renvoie `adj_close` au lieu de `close`
   (Edge Function + backend local). → vérif : `RY.TO` ajusté en 1996 vaut ~2,66 et non 7,84.
2. **Récupération de la référence** côté front : second appel candles sur le ticker de référence,
   même intervalle et même plage. → vérif : nombre de barres cohérent.
3. **Calcul** dans `lib/` : alignement par date + report, ratio, moyenne mobile, Mansfield.
   → vérif : sur un titre qui suit exactement l'indice, le RS reste plat autour de 0.
4. **Panneau + légende + ligne zéro**, sur le modèle du RSI. → vérif : redimensionnable, persistant.
5. **Onglet ⚙ « RS »** : référence, longueur, ajustement dividendes, couleur/épaisseur.

## Questions ouvertes
- Faut-il **lisser** le Mansfield (moyenne courte par-dessus) ? Weinstein ne le fait pas. À voir au rendu.
- Le **RS sectoriel automatique** demanderait la correspondance titre → secteur, **perdue** avec la
  table `instruments` lors du nettoyage #49. Les 9 ETF sectoriels sont chargés et sélectionnables
  à la main ; l'automatisation est un chantier à part.

## Notes / risques
- **Piège d'échelle** : le Mansfield est un pourcentage d'écart à sa propre moyenne, pas un rendement.
  Ne jamais l'afficher comme une performance.
- Le second appel candles double le trafic à chaque changement de symbole. Le cache Supabase absorbe,
  mais garder la référence en mémoire tant qu'elle ne change pas.

## Résultat du sprint — 22 août 2026

**Livré.** Panneau RS sous l'ATR, ligne zéro pointillée, légende `RS <référence> <valeur>` qui suit
le curseur comme les autres indicateurs. Onglet ⚙ « RS » : référence (16 ETF), longueur, ajustement
des dividendes, ligne zéro. Style partagé avec les indicateurs de type ligne.

**Choix d'architecture** : les dividendes sont lus **directement chez Supabase** (REST, politique de
lecture publique) et l'ajustement est calculé **dans le navigateur**. Motif : TVLite calcule déjà
tous ses indicateurs côté client ; passer par l'Edge Function aurait été le seul cas particulier,
et aurait doublé la taille des réponses de bougies. En dev comme en prod, même chemin.

**Vérification** : le RS de `XIU.TO` **contre lui-même** donne une ligne **plate à 0,00 exactement**.
C'est l'invariant qui valide la chaîne complète (ratio, moyenne, alignement des dates).
Vérifié aussi sur `RY.TO` (fort dividende) : RS cohérent, positif récemment.

### Trois pièges rencontrés — commentés dans le code
1. **Lightweight Charts ne crée qu'un panneau à la fois.** Demander l'index 4 quand seuls 0-2
   existent le rabat sur le 3 — le RS et l'ATR se retrouvaient dans le même panneau. L'effet du RS
   doit s'exécuter **après** celui de l'ATR.
2. **L'index attendu ne peut pas venir de `panes().length`** : il compte le panneau du RS lui-même,
   donc la garde « recréer si l'index a changé » se déclenchait en boucle et supprimait la série.
   Index déterministe : `activeAtr ? 4 : 3`.
3. **L'index doit être un état, pas une `ref`.** Le rendu de la légende en dépend, et muter une ref
   ne redéclenche pas le rendu — la légende restait invisible alors que la courbe s'affichait.

### Reste à faire
- [ ] Lissage éventuel du Mansfield — à juger au rendu, Weinstein ne le fait pas.
- [ ] RS sectoriel automatique : demande la correspondance titre → secteur, perdue avec `instruments`.
