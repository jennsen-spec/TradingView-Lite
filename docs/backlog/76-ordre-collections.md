# #76 — Réordonner les collections (menu + accès rapide)

**Statut** : 🧪 À valider (sprint du 31/08) · **Points** : 3 · **Catégorie** : 🧩 Fonctionnalité · **Taille** : S

## Objectif
Choisir l'ordre des collections. L'ordre choisi est **le** seul ordre : il s'applique au menu
déroulant (« Collections ») et aux pastilles d'accès rapide, qui le suivent d'elles-mêmes —
`favorites = collections.filter(favorite)` dérive déjà de l'ordre du tableau, une seule source
de vérité, deux affichages.

## User story
Dans le menu déroulant, je **glisse-dépose** une ligne de collection pour la déplacer ;
en fermant le menu, les pastilles favorites reflètent le nouvel ordre.

## Critères d'acceptation
- [ ] Glisser-déposer d'une ligne dans le menu des collections (même geste que pour les
      symboles/sections, déjà en place dans le panneau : `onDragStart`/`onDropItem`).
- [ ] Les pastilles favorites suivent l'ordre sans réglage séparé (un favori déplacé en tête
      devient la première pastille).
- [ ] La collection affichée reste la même après un déplacement.
- [ ] L'ordre survit au rechargement **et** à la synchronisation cloud multi-appareils.
- [ ] Aucune autre donnée des collections n'est touchée (symboles, sections, drapeaux, favoris).

## Décisions
- **Pas de drag des pastilles rondes en v1** (tranché par Jean le 31/08) : elles sont petites,
  le geste est malcommode, le menu fait le travail.

## Point de vigilance technique — audit QA du 31/08 (conclu)
**Verdict : ça dépend.** La fusion (#48, `cloudPrefs.ts`) ne trie jamais — mais elle ne fusionne
pas l'ordre non plus : c'est **le tableau du « gagnant » qui s'impose en bloc** (gagnant = côté au
tampon le plus récent à l'hydratation ; côté local, toujours, à la poussée).
- **Un seul appareil actif → l'ordre survit** (scénario A réordonne / B recharge : OK, vérifié pas à pas).
- **B modifie quoi que ce soit après le réordonnancement de A** (même juste un symbole ajouté,
  même dans un simple onglet resté ouvert) → sa poussée réécrit le tableau entier avec **l'ancien
  ordre** : le réordonnancement de A est annulé partout, silencieusement.
- Défauts **préexistants** relevés au passage, plus larges que ce ticket : la fusion ne sauve que
  les collections *entièrement nouvelles* (une **modification** d'une collection existante côté
  perdant est jetée — perte de données possible dès aujourd'hui, sans #76) ; une entrée nouvelle
  arrive toujours **en fin** de tableau ; l'arbitre compare l'horloge du navigateur à celle du
  serveur (fiabilité sous la seconde douteuse) ; `labo/src/collection.ts` réécrit le tableau
  complet hors fusion (fenêtre GET→POST) ; un échec d'hydratation sur localStorage vide pousse le
  `seed()` et préfixe une collection fantôme.

**Conséquence pour le sprint** : réordonner n'est ni plus ni moins fragile que ce que fait déjà
« ajouter un symbole » — même clé, mêmes règles du dernier-écrivain. Le critère « survit à la
synchro multi-appareils » est donc à lire ainsi : **mêmes garanties que les données actuelles des
collections**, pas mieux. Rendre l'ordre réellement fusionnable (champ de rang par collection +
arbitrage entrée par entrée) est un chantier #48-bis séparé, qui réglerait aussi la perte de
modifications préexistante.

## Plan technique
1. Poignée de drag sur les lignes `wl-menu-coll` + réordonnancement du tableau `collections`
   (splice par id, comme les items). → vérif : l'ordre du menu change et persiste.
2. Rien à faire pour les pastilles (dérivées). → vérif : l'ordre des ronds suit.
3. Recette du scénario nominal (un appareil) : réordonner, recharger, set cloud + reload —
   l'ordre tient. → vérif : pas de POST parasite au démarrage (garde `hydrated` intact —
   attention à ne pas normaliser le JSON dans `loadCollections`, l'égalité d'octets le protège).
4. `currentId` est initialisé à `collections[0].id` : le garder sur la collection courante après
   un déplacement (critère 3), et assumer qu'au rechargement la sélection par défaut suit le
   nouvel ordre.

## Questions ouvertes
- Faut-il ouvrir le ticket **« #48-bis — fusion par entrée »** (rang fusionnable, sauvetage des
  modifications, insertion à la bonne position) ? Recommandation : oui, en 📥 non prioritaire —
  la perte de modifications existe déjà sans #76 et mérite sa propre ligne.

## Journal du sprint — 31/08
**Fait, tel que planifié** : lignes du menu `wl-menu-coll` rendues glissables (mêmes classes
visuelles que le drag des symboles : `wl-dragging`, `wl-drop-before/after`, indicateur
avant/après selon la moitié de la ligne survolée) ; `reorderColl` déplace l'entrée dans le
tableau `collections` — rien d'autre : la persistance passe par le `useEffect` de sauvegarde
existant, et les pastilles suivent d'elles-mêmes puisqu'elles dérivent du tableau.

**Recette navigateur sur les vraies collections de Jean** : ETF glissé au-dessus de Duo →
menu 25 SP500 · ETF · Duo · Portfolio, pastilles E D P instantanément · rechargement complet
(hydratation cloud comprise) → l'ordre tient, la collection courante reste « 25 SP500 » ·
aucune poussée parasite au démarrage (le garde d'égalité d'octets est intact — pas de
normalisation ajoutée dans `loadCollections`) · ordre d'origine remis par le même geste
(D E P), noms/favoris/symboles inchangés.
