# #101 — Journal de mon investissement

**Statut** : 🧪 À valider · **Points** : 3 · **Catégorie** : 💼 · **Priorité** : ⭐

Demandé par Jean le 01/10/2026 : la section était vide dans le rapport du 30/09.

## Pourquoi elle était vide
Le contenu n'avait jamais été programmé. `page.ts` affichait « Le premier cycle réel n'a
pas encore eu lieu » tant que `etat.json` n'avait aucun cycle, puis **rien** dès le premier.
Le journal vu à la répétition #59 (28/08) avait été construit à la main pour l'UAT. Le
trou était noté dans les risques de #96, sans ticket ouvert.

## Critères d'acceptation
- [x] Une période par cycle **exécuté** (`execute.ordres` rapportés), la plus récente en tête ; une période sans exécution rapportée n'apparaît pas.
- [x] Chaque ligne détenue : quantité, **prix d'achat réel** (date + limite prescrite en petit), clôture de fin de période, valeur, résultat en $ et en %.
- [x] Pied : **Titres** (coût · valeur · résultat), **Liquidités** rapportées, **Portefeuille** = titres + liquidités contre la poche de départ.
- [x] Fin de période = signal du cycle suivant (ou du rapport courant) ; les lignes reconduites gardent leur prix d'achat d'origine.
- [x] Chiffres identiques au tableau « À faire » du même rapport (+773 $ / +16,9 % au 30/09).
- [x] Republication du rapport du 30/09 : seule la section change (plus la date d'exécution, désormais connue).

## Décisions
- Format repris du journal validé à la répétition #59 (lignes valorisées, total contre 5 000 $).
- **Hors dividendes**, comme la colonne Résultat de #96.
- La note libre de `execute` n'est pas affichée : elle cite le courtier et le compte, et le rapport est public.

## Vérifications faites
- Rapport régénéré (`--frais`) et diffé contre la version publiée : aucun autre écart que la section, la date d'exécution et la date de génération.
- Clôtures recoupées avec le rapport publié et Yahoo (AMD.TO 110,45 · KEEL.TO 5,02 · ARE.TO 54,10).
- `tsc --strict` sur `page.ts` / `cycleCalc.ts` : sans erreur. Rendu vérifié (capture).

## Notes / risques
- Le format futur de `execute` (ventes, ordres partiels) n'est pas encore connu : une ligne détenue sans achat rapporté s'affiche avec « — » plutôt qu'un chiffre inventé.
