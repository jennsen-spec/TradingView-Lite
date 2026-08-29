# #63 — Ensembles de dessins par symbole

**Statut** : ✅ Fait · **Points** : 5 · **Catégorie** : 🧩 Fonctionnalité · **Priorité** : —

## Objectif
Sur un symbole, sauvegarder l'état des dessins sous un nom, pouvoir tout effacer
sereinement, et faire réapparaître un ensemble plus tard, à l'identique. User stories
validées par Jean le 29/08.

## Critères d'acceptation
**US-1 — Sauvegarder sous un nom**
- [x] « Sauvegarder les dessins… » demande un nom et photographie tous les dessins du
      symbole courant, sans modifier l'affichage.
- [x] Nom déjà pris → choix explicite : « Mettre à jour la sauvegarde » (écraser) ou
      renommer.
- [x] Plusieurs ensembles coexistent par symbole.

**US-2 — Effacer sans peur**
- [x] « Tout effacer » ne touche jamais aux ensembles sauvegardés.

**US-3 — Restaurer = remplacer**
- [x] Liste par symbole : nom, date, nombre de dessins.
- [x] Restaurer REMPLACE les dessins affichés ; si des dessins non sauvegardés seraient
      perdus, avertissement avant.
- [x] Restaurer ne consomme pas l'ensemble.
- [x] Le chemin d'AJOUT passe par #64 : tout sélectionner → couper → restaurer → coller
      → les dessins coupés reviennent à leurs positions d'origine par-dessus l'ensemble.

**US-4 — Gérer**
- [x] Renommer et supprimer (avec confirmation).

**US-5 — Synchronisation**
- [x] Les ensembles suivent le cloud avec les mêmes règles de fusion que les dessins
      (#48) ; jamais touchés par les scripts du labo (même contrat que les collections).

## Décisions
- **Restaurer = remplacer** (Jean, 29/08). L'ajout passe par couper/coller (#64).
- **Dessins du système exclus** (rectangles « Annonce », positions du rapport) : ils
  appartiennent au cycle mensuel.
- **Portée = symbole entier** ; chaque dessin garde ses réglages de visibilité par
  intervalle.
- **Interface aux deux endroits** : menu clic droit du graphique + barre d'outils de
  dessin.

## Plan technique
1. Stockage : nouvelle clé `tvlike:drawsets:<SYMBOL>` — liste `{id, nom, date, dessins[]}`.
   L'ajouter aux clés fusionnables par id de cloudPrefs (comme `tvlike:drawings:`).
   → vérif : sauvegarde visible dans tvlite_prefs, fusion sans écrasement.
2. Sauvegarde : photographie profonde des dessins du symbole, hors dessins générés par
   le rapport (identifier leur marqueur de modèle à l'implémentation). → vérif : un
   rectangle « Annonce » n'entre pas dans l'ensemble.
3. Restauration : remplacement + avertissement si perte ; l'ensemble reste. → vérif :
   restaurer deux fois de suite donne le même état.
4. UI : entrée au menu contextuel + bouton barre d'outils ; boîte de liste
   (nom/date/compte, renommer, supprimer, restaurer). → vérif : parcours complet
   sauvegarder → tout effacer → restaurer.

## Notes / risques
- Le remplacement doit passer par le chemin normal de sauvegarde des dessins
  (localStorage + syncToCloud) pour que la fusion #48 voie les suppressions comme
  volontaires (ids « vus ») — sinon les dessins remplacés ressusciteraient.

## Journal du sprint
- 29/08 : implémenté. `lib/drawsets.ts` (clé `tvlike:drawsets:<SYMBOL>`, fusionnable par
  id dans cloudPrefs) ; champ `Drawing.systeme` pour les dessins du générateur (exclus
  des ensembles — aucun n'existe encore, le filtre est en place) ; modale « Ensembles de
  dessins » (sauvegarder avec confirmation de mise à jour, restaurer avec avertissement
  si l'état courant n'est photographié nulle part, renommer, supprimer) ; accessible par
  le bouton de la barre d'outils ET le menu clic droit (deux entrées). Restauration via
  le chemin normal de sauvegarde (useEffect → saveDrawings → sync #48) : les
  remplacements sont vus comme volontaires, rien ne ressuscite.
- Testé de bout en bout au preview sur les 9 dessins réels d'AAPL : sauvegarde (9),
  tout effacer (0, l'ensemble intact), restauration → **9 dessins identiques à l'octet
  près** ; clé cloud synchronisée (vérifiée dans tvlite_prefs) ; état de Jean remis
  exactement comme avant le test, ensembles de test nettoyés.
- 29/08 (retour d'UAT de Jean) : à zéro dessin, le clic droit rendait la main au menu
  natif du navigateur — l'étape « restaurer après tout effacer » était inatteignable par
  ce chemin. Corrigé : le menu du graphique s'ouvre même sans dessin ; « Supprimer N »
  et « Sauvegarder… » n'apparaissent que quand ils ont un sens ; « Ensembles de
  dessins… » est toujours là. Vérifié sur un symbole vierge (COST) : menu → boîte →
  liste vide, « Sauvegarder (0) » désactivé.

**UAT validée par Jean le 29/08/2026** → ✅ Fait.
