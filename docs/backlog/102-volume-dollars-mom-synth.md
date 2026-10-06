# #102 — Volume en dollars sur MOM.SYNTH

**Statut** : 🧪 À valider (sprint du 2026-10-05) · **Points** : 3 · **Catégorie** : 💼 Portefeuille · **Taille** : S

## Réalisé (2026-10-05)
- **Exporteur** : chaque point de `duo-mom.json` porte `volume` = Σ clôture × volume des titres du panier, arrondi au dollar ; 0 en liquidités (1 404 jours). Fichier : 778 Ko → 919 Ko.
- **Frontend** (`lib/portfolios.ts`) : l'historique lit ce champ, le mois en cours fait le même calcul sur les cours Yahoo du panier. Mention « volume en $ CA des titres détenus » dans la fiche détail.
- **Fractionnements** : clôture et volume sont ajustés ensemble dans la base du labo — dollars échangés continus autour de CNR (2013), CP (2021) et SHOP (2022).
- **Courbe intacte** : 0 point open/high/low/close modifié sur 5 670, panier courant identique.
- **Recalcul à la main** : 05/10 = 85,72 M $ (10 titres, Yahoo) = valeur de la légende ; octobre en mensuel = 378,06 M $ = somme des trois séances.
- **Jointure** : sur les 5 dernières séances d'août, la base du labo et Yahoo donnent 93 / 76 / 137 / 103 / 154 M $ contre 95 / 80 / 138 / 104 / 160 M $ — écart de 1 à 5 %, pas de marche.
- **Non vérifié à l'écran** : la mention dans la fiche détail (chaîne modifiée, volet non ouvert). **Non prouvé** : le passage par l'Action mensuelle (premier run réel fin octobre).
- **Question ouverte** : défaut retenu — le graphe n'est pas touché, la légende reste « 85.72M » sans unité.

## Objectif
Le panneau Volume de MOM.SYNTH est vide : le volume y est mis à 0 depuis le #77. On y affiche le
**volume en dollars du panier détenu**, sur tout l'historique et sur le mois en cours, pour lire
l'activité du marché sous la courbe (pics de volume sur les creux et les cassures).

## Critères d'acceptation
- [ ] Sur MOM.SYNTH, le panneau Volume affiche des barres de 2004 à aujourd'hui, **mois en cours compris**, en 1j, 1sem et 1mois.
- [ ] La valeur d'un jour = **somme, sur les titres détenus ce jour-là, de clôture × volume** (dollars canadiens). → vérif : recalcul à la main d'une date de l'historique et d'une date du mois en cours = valeur affichée.
- [ ] Les mois **en liquidités** (interrupteur coupé) affichent un volume **nul**.
- [ ] La moyenne mobile du volume (« Vol 20 ») se trace et sa valeur apparaît dans la légende.
- [ ] La **courbe ne bouge pas** : les open/high/low/close de `duo-mom.json` sont identiques avant et après, hors nouveaux jours. → vérif : diff du fichier, champ `volume` retiré.
- [ ] Pas de marche visible à la **jointure** historique figé ↔ mois en cours (même ordre de grandeur de part et d'autre).
- [ ] EQ.SYNTH et les titres réels sont inchangés.

## Décisions
- **Tout l'historique, en dollars** (Jean, 2026-10-05). Revient sur la décision « sans volume » du #77 et le critère « volume 0 » du #79.
- **Somme simple** des titres du panier, sans pondération — même convention qu'EQ.SYNTH (qui somme ses 5 ETF), mais en dollars pour que des titres à 5 $ et à 200 $ s'additionnent sans biais.
- C'est le **volume du marché sur les titres détenus**, pas le montant échangé par la stratégie. À dire dans la fiche détail.
- **Liquidités = 0** : rien n'est détenu, rien à sommer.
- Valeur **arrondie au dollar** dans le JSON (poids : environ +150 Ko sur 780 Ko).
- EQ.SYNTH **reste en nombre de titres** : hors périmètre.

## Questions ouvertes
- **Unité dans la légende** : le graphe affiche « 38,82 M » sans unité. Sur MOM.SYNTH ce seront des dollars. Défaut proposé : ne pas toucher au graphe et préciser « volume en $ CA » dans la fiche détail. Alternative : suffixe « $ » dans la légende (modif de `Chart.tsx`).

## Plan technique
1. **Vérifier la donnée** : dans la base du labo, clôture et volume sont-ils ajustés de la même façon aux fractionnements ? Sinon clôture × volume est faux avant chaque fractionnement. → vérif : un titre fractionné connu (ex. CNR 2013, SHOP 2022), dollars échangés continus autour de la date.
2. **Exporteur** (`labo/src/exporter-duo-mom.ts`) : pour chaque jour d'un mois investi, sommer `close[i] × volume[i]` sur `paniers` ; écrire `volume` dans chaque point (0 en liquidités). → vérif : critère « la courbe ne bouge pas ».
3. **Frontend** (`lib/portfolios.ts`) : `DuoPoint.volume` lu par `duoHistory` (0 si absent) ; `duoTail` somme clôture × volume des titres du panier, déjà récupérés par `api.ts`. → vérif : recalcul à la main d'un jour du mois en cours.
4. **Fiche détail** : une mention « volume en $ CA des titres détenus » dans `syntheticDetail`. → vérif : visible dans le volet.
5. **Régénérer** `duo-mom.json` (`npm run duo:export`) et vérifier dans le navigateur les trois intervalles + la jointure.

## Notes / risques
- **Automatisation** : `rapport.yml` lance déjà `duo:export` et committe `duo-mom.json` — aucun changement de workflow. Mais ne dire « le volume survit au rapport mensuel » qu'après un run GitHub réel (fin octobre).
- **Jointure** : l'historique vient de la base du labo, le mois en cours de Yahoo. Deux sources, donc un écart de volume possible ; c'est l'objet du critère dédié.
- **Lecture** : une somme simple est dominée par les gros titres, et elle saute à chaque changement de panier en début de mois. Ce n'est pas un signal de la stratégie.
- Le titre du #82 (analyse technique sur MOM.SYNTH) pourra s'appuyer dessus.
