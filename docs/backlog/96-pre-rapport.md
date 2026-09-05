# #96 — Pré-rapport (répétition à J−1)

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : 🧩 · **Priorité** : —

**UAT validée par Jean le 05/09/2026.**

## Objectif
La veille de la fin du mois, ajouter **en tête du rapport** une section qui répond à
« qu'est-ce qu'on ferait si le mois se terminait aujourd'hui ? » : les ventes et les achats
de la prochaine séance, et les candidats. Le rapport du mois précédent reste intégralement
lisible en dessous, et la section disparaît d'elle-même quand le vrai rapport est publié.

## Critères d'acceptation
- [x] Le rapport porte, **au-dessus de l'en-tête**, une section « Si le mois se terminait aujourd'hui — *date* » contenant, dans cet ordre : l'interrupteur provisoire, **À faire à la prochaine séance**, **Les candidats** (10 par secteur).
- [x] « À faire » reste **le tableau du rapport**, trié par rang : une ligne par titre, `vendre` / `acheter` / `conserver` portés par la colonne Action (badge `vendre` en rouge). Les sortants tombent naturellement en bas — leur rang les y met. **Aucun regroupement, aucun bandeau.**
- [x] Colonnes : Titre · Action · Rang · Momentum · Dernière clôture · Quantité · **Prix** · **Montant** · Coût max · **Résultat**.
- [x] **Prix** : la limite pour un achat, « au marché » pour une vente, « — » pour une conservation. **Montant** : engagé / produit estimé / valeur de la ligne. **Coût max** : achats seulement.
- [x] **Résultat** : **réalisé** sur les ventes, **latent** sur les conservations, en **dollars et en pourcentage**, calculés sur le **prix d'entrée réel** (`etat.json` → `execute`, à défaut `prescrit`) ; « — » sur les achats. Le prix d'entrée est rappelé sous la clôture (« acheté 1,10 $ »), sur le modèle des cellules à deux lignes du journal.
- [x] **Pied de tableau décomposé**, une ligne par groupe présent puis le total :
  `Ventes` (produit estimé · résultat **réalisé** en $ et en %) · `Achats` (engagé · coût max) · `Conservations` (valeur des lignes · résultat **latent**) · **`Portefeuille après les ordres`** (hors ventes · coût max · résultat d'ensemble).
  Les pourcentages sont rapportés au **coût d'entrée du groupe**, pas au montant affiché. Le total n'apparaît que s'il y a **plus d'un groupe** — sinon il répéterait la ligne du dessus (cas du rapport du 31/08 : que des achats, pied inchangé).
- [x] **La colonne Résultat est ajoutée au rapport définitif** (même tableau, même code) — décidé par Jean le 05/09 : le pré-rapport sert de banc d'essai au rapport.
- [x] La section est impossible à confondre avec le rapport : bandeau ambre plein + pastille `PROVISOIRE`, encadré ambre, titres en italique ambre, en-têtes de tableaux teintés, chapô disant que ce n'est pas le signal du mois.
- [x] Publiée **une seule fois par mois**, à 17 h 30, la **veille du dernier jour civil**, reculée au **vendredi** si elle tombe un samedi ou un dimanche. Les deux passages cron du même soir ne produisent **qu'une** publication et **qu'une** notification.
- [x] La publication déclenche la **notification push** (titre distinct du rapport) et allume la **pastille** (#90) ; la consultation l'éteint ; le vrai rapport du lendemain la rallume.
- [x] Le pré-rapport n'écrit **rien** dans `portefeuille/etat.json`, ne touche pas `dernier-signal.txt`, ne relance ni `duo:export` ni `npm run collection`.
- [x] Le lendemain, le rapport publié ne contient **plus** la section.
- [x] `npm run rapport` sans drapeau produit le rapport habituel, **sans** la section pré-rapport — seul son tableau « À faire ce mois-ci » change (lignes de vente + colonne Résultat). Le reste de la page est identique au fichier publié.
- [x] Répétition générale possible hors fin de mois : `npm run rapport -- --preavis --preavis-signal 2026-08-27 --sortie /tmp/x.html`.

## Décisions
- **Section ajoutée**, pas de rapport séparé : le rapport est régénéré en entier à chaque passage, c'est donc un mode de génération, pas de la chirurgie HTML.
- **En tête**, au-dessus de l'en-tête — même emplacement que l'encart d'alerte d'inventaire (#60).
- **Un seul tableau** pour vendre / acheter / conserver (Jean, 05/09), **trié par rang comme aujourd'hui** : la colonne Action suffit à distinguer les trois cas, et l'UX du rapport ne change pas. Une première version groupait les lignes par action sous des bandeaux — écartée : c'était réinventer une lecture qui marche.
- **Ventes au marché** : la stratégie n'a ni stop ni objectif, elle sort à l'encan d'ouverture — afficher une limite inventerait une règle. Le produit affiché suppose la dernière clôture.
- **Résultat calculé sur les exécutions réelles** (`etat.json` → `execute`), hors dividendes. `prescrit` sert de repli si Jean n'a pas encore rapporté ses exécutions ; le rapport dit laquelle des deux sources il a utilisée.
- Sur une ligne conservée, **Quantité = quantité détenue** (pas la ligne cible théorique) : dans un tableau qui affiche aussi des quantités vendues et un résultat, le nombre doit désigner partout des actions en main. Conséquence assumée : le rapport ne dit plus rien du rééquilibrage — voir Notes.
- Le **tableau unifié et la colonne Résultat vont aussi dans le rapport définitif** (même code, même section « À faire ce mois-ci ») : le pré-rapport sert de banc d'essai, ce qui y marche remonte dans le rapport.
- **Un seul pré-rapport par mois.** Veille du dernier jour civil, reculée au vendredi le week-end : sans ce recul, 5 mois sur 16 n'auraient pas de pré-rapport (30/11/26, 31/01/27, 28/02/27, 31/05/27, 31/10/27…).
- **Jour férié ce soir-là** : le garde-fou de fraîcheur échoue, pas de pré-rapport ce mois-ci, **pas de rattrapage** — un pré-rapport en retard n'a plus d'intérêt.
- Maquette validée par Jean le 05/09/2026 : `portefeuille/rapport-maquette-preavis.html` (hors dépôt, chemin gitignoré).

## Questions ouvertes
- Aucune pour #96. La question du **rééquilibrage des lignes conservées** (le backtest remet chaque ligne à 1/N gratuitement tous les mois ; la poche reste figée à 5 000 $ alors que le portefeuille en vaut 5 235) est **hors périmètre** — elle demande d'abord de revaloriser la poche, sinon toute instruction de rééquilibrage serait fausse. À ouvrir en ticket séparé.

## Plan technique
1. `labo/src/cycleCalc.ts` — option `provisoire` : le signal devient la dernière séance connue de l'univers duo (ou celle passée en argument), le garde-fou « fin de mois complète » est levé, champ `provisoire` sur le `Cycle`. Enrichir `sortants` en objets `{ ticker, secteur, rang, momentum, cloture, detenu, entree, produit, gain, pctGain }` et ajouter `detenu`/`entree`/`gain`/`pctGain` aux `Ordre` conservés — lus dans le dernier cycle de `etat.json` (`execute.ordres` s'il existe, sinon `prescrit`), avec repli propre si le titre y est introuvable. `etat.json` continue de n'enregistrer que les tickers dans `sortants`. → *vérif* : `npm run cycle` inchangé à l'écran ; `--provisoire` sort un cycle daté d'aujourd'hui, `execution: null` ; les gains recoupent 5 234,70 $ = 5 000 + 273,64 − 38,94 sur la maquette.
2. `labo/src/page.ts` — un seul `ligneOrdre` pour les trois actions (colonnes Prix / Montant / Coût max / Résultat), lignes de vente concaténées aux ordres et triées par rang, dans les deux modes ; drapeaux `--preavis` / `--preavis-signal` ; rendu de la section + CSS ; en mode pré-rapport écrire `portefeuille/dernier-preavis.txt` et **ne toucher ni** `dernier-signal.txt` **ni** `etat.json`. Méta : `{"signal":…,"preavis":…}`. → *vérif* : page identique sans drapeau (hors ventes) ; conforme à la maquette avec.
3. `frontend/src/App.tsx` — clé de pastille `m.preavis ?? m.signal` (une ligne + le type). → *vérif* : pastille allumée par le pré-rapport, éteinte à la consultation, rallumée par le rapport.
4. `.github/workflows/rapport.yml` — **une seule** ligne de cron `30 21,22 25,26,27,28,29,30,31,1,2 * *` (deux lignes déclencheraient deux fois le même soir) ; étape « est-ce le jour du pré-rapport ? » en `TZ=America/Toronto` ; branche pré-rapport **si** le vrai rapport n'a rien publié **et** si le pré-signal a changé ; commit limité à `rapport.html` + `rapport-meta.json` + `dernier-preavis.txt`, précédé de `git checkout -- portefeuille/etat.json` ; notification au titre distinct. → *vérif* : `workflow_dispatch` sur une branche, avec `TVLITE_AUJOURDHUI`.
5. Docs — en-tête de `rapport.yml` et 3 lignes de reprise manuelle dans `portefeuille/README.md`.

## Décidé pendant le sprint
- **`--sortie` n'écrit plus que la page demandée.** Avant, un essai à la main réécrivait aussi `dernier-signal.txt` et `rapport-meta.json` ; avec le pré-rapport c'était dangereux — une répétition locale aurait posé le marqueur du soir et l'Action se serait tue.
- **`--preavis` + `--enregistrer` sont refusés** (sortie en erreur) : la combinaison écrirait un cycle daté du mauvais jour dans l'historique.
- **Pré-rapport sans objet** : si la clôture provisoire est déjà couverte par le signal publié (mois qui vient de se terminer), la section n'est pas rendue et le marqueur n'est pas touché — l'Action ne voit rien à publier, sans code d'erreur particulier.
- **Deux tuiles du bandeau corrigées** : « À engager » ne compte plus que les **achats** (c'est ce que le libellé dit ; avant, elle additionnait aussi les lignes reconduites, ce qui aurait annoncé ~4 950 $ à engager en septembre au lieu de 935 $), et « Liquidités après » part des **liquidités réellement rapportées** au cycle précédent, plus le produit des ventes, moins les achats. Sans exécutions rapportées, l'ancienne formule s'applique — le rapport d'août est inchangé.
- **L'interrupteur et les tableaux de candidats sont rendus par une seule fonction** pour le rapport et le pré-rapport : s'ils divergeaient, l'un des deux mentirait.
- **`npm run cycle` réaligné sur le rapport.** L'en-tête de `cycleCalc.ts` promet que la console et le rapport disent exactement la même chose ; la console affichait encore la ligne cible là où le rapport affiche les actions détenues. Elle porte maintenant le même tableau unique (ventes comprises), la colonne `montant`, le résultat par ligne et la même décomposition en pied.

## Vérifications faites
- `npm run cycle` sur le 31/08 : identique au rapport publié (4 657,35 $ engagés, 342,65 $ résiduels).
- `npm run cycle -- --provisoire --frais` sur la clôture du 04/09 : 1 achat (TSAT.TO), 9 reconduits, 1 vente (BB.TO), liquidités 435,88 + 468,16 − 497,12 = **406,92 $** — la chaîne boucle.
- Rapport régénéré et **diffé** contre le fichier publié : les seuls écarts sont le CSS ajouté, les colonnes du tableau, la note d'une tuile, et des différences de **données** (un mois de backtest de plus, volumes rafraîchis, date d'inventaire du cache local, séance d'exécution désormais connue).
- Résultats recoupés à la main : conservations +145,06 $ sur 4 079,68 $ de coût (**+3,6 %**), vente −16,28 $ sur 484,44 $ (**−3,4 %**), total +128,78 $ sur 4 564,12 $ (**+2,8 %**) — et 4 564,12 $ est exactement le total exécuté le 01/09.
- HTML analysé : aucune balise non fermée, tableaux à 10 colonnes cohérents corps et pied.
- Rendu vérifié au navigateur en **thème sombre et clair** ; correction d'une bande sombre entre le cadre et le bandeau (le `padding` des `<section>`).
- Logique de date du workflow rejouée avec GNU `date` sur 10 mois : un pré-rapport chaque mois, toujours un jour de semaine (29/09, 30/10, 27/11, 30/12, 29/01, 26/02…).
- YAML du workflow validé ; `npm run build` du frontend et `tsc --strict` sur les sources modifiées : sans erreur.
- `npm run cycle` sur le 31/08 : sortie identique au mot près à celle d'avant le sprint (aucun cycle antérieur → aucune colonne de résultat).
- Chemins d'écriture vérifiés : en publication, `rapport.html` + `rapport-meta.json` + `dernier-preavis.txt` seulement ; `dernier-signal.txt` et `etat.json` intacts.

## Notes / risques
- **`etat.json` pollué** : l'étape `gen` tourne avec `--enregistrer` tous les soirs et réécrit le cycle courant ; aujourd'hui c'est sans effet (rien n'est committé). Dès qu'on committe un soir de pré-rapport, il faut explicitement le restaurer — sinon un cycle daté du mauvais jour entre dans l'historique.
- **Double notification** : les deux passages 21 h 30 / 22 h 30 UTC passent tous les deux le garde-fou de fraîcheur ; le marqueur `dernier-preavis.txt` est ce qui rend le second silencieux.
- **Univers légèrement différent** : un titre dont la barre du jour manque sort du classement provisoire — la nature de l'exercice, la section le dit en une phrase.
- **Poids dérivants, poche figée** : le moteur remet chaque ligne à 1/N à chaque rebalancement (`valeur: 1`) **sans facturer de frais** sur les lignes reconduites — un rééquilibrage gratuit, impossible en vrai. Dans la réalité les lignes dérivent : au 29/09 de la maquette, KEEL vaut 542 $ et MTL 502 $ pour une ligne théorique de 500 $, et la poche reste écrite à 5 000 $ alors que le portefeuille en vaut 5 235. Le tableau unifié rend l'écart visible ; **#96 ne le corrige pas** et n'affiche aucune instruction de rééquilibrage, qui serait calculée sur une poche périmée.
- **Conformité #61** : le test moteur ↔ rapport reste inchangé et bloquant, y compris les soirs de pré-rapport.
- **Hors sujet mais visible au prochain rapport** : la section « Journal de mon investissement » se vide dès qu'un cycle existe dans `etat.json` (`enCours ? "" : …`). Le rapport d'août affichait encore son encart « le premier cycle réel n'a pas encore eu lieu » parce qu'il a été généré avant l'inscription du cycle. Le prochain rapport publiera donc un `<h2>` suivi de rien. **Antérieur à #96**, pas corrigé ici.
