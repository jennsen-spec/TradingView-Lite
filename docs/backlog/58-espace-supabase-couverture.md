# #58 — Base saturée : déplacer les secteurs hors stratégie et inventorier ce qui manque

**Statut** : Affiné · **Points** : 8 · **Catégorie** : ⚙️ Technique · **Priorité** : ⭐ bloquant

## Objectif
La base opérationnelle est à **499 Mo sur 500** : le rafraîchissement quotidien sort sans rien
faire depuis le 22/08 et **le signal du 31 août ne pourra pas être calculé**. Libérer la place en
déplaçant les barres hors stratégie vers le second projet Supabase (10 Mo utilisés sur 500), puis
se donner enfin un inventaire de ce qui manque en industrie + techno.

## Constat mesuré (26/08/2026)
| | |
|---|---|
| Taille du projet opérationnel | **499 Mo** (garde-fou du cron : 480 Mo) |
| Dernière barre en base | **2026-08-21** — 906 des 911 tickers en retard |
| Cron `rafraichissement-cours` | s'exécute, se déclare « succeeded », traite **0 titre** |
| Table `bars` | 484 Mo · 2 907 903 barres · **un seul index** (la clé primaire, 107 Mo, 7 M lectures) |
| Lignes mortes | 405 744 (14 %) — `VACUUM FULL` impossible faute de place libre |
| Barres du duo | **411 410 sur 2 777 916 = 14,8 %** |
| À conserver en opérationnel | **105 tickers** : 94 du duo + 5 références + 6 FNB sectoriels |
| Second projet (`bsmcshezaofompkrmqii`) | **10 Mo sur 500** |
| Couverture actuelle | 613 actions canadiennes pour ~2 089 émetteurs au TSX |
| Secteurs non résolus | **47 titres** — surtout des FNB/fiducies, mais **CSCO.TO** (CDR techno) est dedans |

## Décisions
- **Déplacer, pas supprimer ni figer.** On a changé le modèle de frais puis la convention
  d'exécution deux fois en une semaine ; chaque fois toutes les courbes ont dû être recalculées
  depuis les barres brutes. Des résultats figés seraient devenus incomparables — c'est exactement
  la confusion v1/v2 qu'on a mis des heures à démêler.
- **Ne pas se fier à `accessed_at`** pour une purge LRU : les 890 lignes ont toutes été touchées
  entre le 18 et le 24/08, le signal d'usage est inexploitable. Confirme le risque noté en #49.
- **Résoudre les secteurs AVANT toute purge**, sinon « Inconnu » part avec et on perd des CDR.
- **La purge doit être répétable**, pas un coup unique : `writeDailyCache` réinsère les barres de
  tout symbole consulté dans TVLite.
- **Forfait gratuit conservé** (tranché par Jean le 26/08). Donc pas de Pro à 25 $/mois : la base
  restera contrainte à 500 Mo, et l'élargissement de couverture devra tenir dans ce que le
  déplacement vers le second projet libère. Les deux projets réunis plafonnent à 1 Go.
- Seuil de volume : **ne rien changer dans ce ticket.** Mesuré le 25/08, le baisser à 250 k$
  rapporte ~1,8 pt/an et résiste jusqu'à 8 pas de cotation de fourchette — mais c'est une décision
  de stratégie, pas d'infrastructure. Ticket séparé.

## Critères d'acceptation
- [ ] Le rafraîchissement quotidien traite à nouveau ses 200 titres par jour et `refresh_state`
      ne compte plus aucun ticker en retard de plus de 6 jours.
- [ ] La dernière barre en base est à moins de 2 jours ouvrables de la date du jour.
- [ ] Le signal de fin de mois se calcule sans déclencher le garde-fou de fraîcheur.
- [ ] La base opérationnelle est **sous 150 Mo** et le garde-fou du cron est remonté en conséquence.
- [ ] Les 47 titres sans secteur sont résolus, ou explicitement classés « à exclure » avec le motif.
- [ ] `npm run labo:comparer` produit les **mêmes courbes tous-secteurs qu'aujourd'hui**, en lisant
      le second projet — écart nul sur le capital final de chaque variante.
- [ ] Une commande d'inventaire liste les sociétés industrie/techno cotées au TSX **absentes** de
      la base, avec leur volume, et refuse d'en ajouter si l'espace manque.
- [ ] La purge est rejouable sans risque : la relancer deux fois de suite ne casse rien.

## Plan technique
1. **Débloquer tout de suite, sans rien perdre** — supprimer les barres antérieures à 2002
   (249 288 lignes, ~8,6 %) : elles sont inutilisables, l'interrupteur ne se calcule pas avant
   avril 2002 et il n'y avait que 2 titres éligibles en 1996. → vérif : `refresh_cours` traite
   à nouveau des titres ; Yahoo les a toujours si on les regrette.
2. **Résoudre les 47 secteurs** — relancer la résolution, classer à la main le reliquat, et
   récupérer explicitement les CDR (CSCO.TO au moins). → vérif : plus aucun « Inconnu » parmi
   les titres qui passent volume ≥ 250 k$ et prix ≥ 1 $.
3. **Sauvegarder hors machine** — `labo/.cache/` (255 Mo) est un filet local et gitignoré, pas une
   archive. Exporter les barres hors duo avant de les déplacer. → vérif : relecture de l'export.
4. **Déplacer vers le second projet** — créer `bars` + `bars_coverage` côté `bsmcshezaofompkrmqii`,
   copier les tickers hors duo, vérifier le compte de lignes, puis supprimer côté opérationnel.
   → vérif : somme des barres avant = après, sur les deux projets réunis.
5. **`VACUUM FULL` sur `bars`** une fois la place libérée. → vérif : taille de la base sous 150 Mo.
6. **Adapter le labo** — `chargerMarket` lit l'opérationnel pour le duo et le second projet pour
   l'univers complet. → vérif : les 13 courbes sont identiques au dixième près.
7. **Rendre la purge rejouable** — une fonction qui redéplace ce que TVLite a réinséré, appelable
   à la main puis en `pg_cron` mensuel. → vérif : consulter un titre hors duo dans TVLite, relancer,
   la base revient à son état.
8. **Inventaire** — récupérer l'annuaire des sociétés cotées au TSX, comparer à `bars_coverage`,
   sortir la liste des manquants en industrie + techno triée par volume. → vérif : le total des
   sociétés connues correspond à l'ordre de grandeur publié par TMX.

## Questions ouvertes
- Où trouver un annuaire fiable des sociétés cotées au TSX ? tsx.com publie un répertoire ;
  reste à vérifier qu'il est récupérable proprement et à quelle fréquence.
- Faut-il conserver les FNB sectoriels des secteurs déplacés (XGD, XEG, XFN, XRE, XMA) côté
  opérationnel ? Oui a priori : les jeux `portes_secteur` en ont besoin et ils pèsent peu.

## Notes / risques
- **L'échec actuel est silencieux.** Le cron se déclare « succeeded » en ne faisant rien, et le
  garde-fou de fraîcheur fera échouer le rapport sans prévenir. La notification Telegram du
  backlog devient franchement prioritaire — c'est précisément le cas qu'elle doit attraper.
- **Élargir la couverture ne corrigera pas le biais du survivant** : les tickers ajoutés seront
  eux aussi des sociétés cotées aujourd'hui. Voir la réserve du document des courbes.
- Ne rien supprimer côté opérationnel avant d'avoir vérifié le compte de lignes côté destination.
