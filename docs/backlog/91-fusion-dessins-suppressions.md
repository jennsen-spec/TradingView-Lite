# #91 — Les suppressions de dessins ne se propagent pas entre appareils

**Statut** : 🔍 Affiné · **Points** : 3 · **Catégorie** : ⚙️ Technique · **Priorité** : à cadrer avec [#78](#) (même moteur de fusion)

## Symptôme
Constaté par Jean le 02/09 sur iPhone : **les dessins s'empilent** — d'anciennes bandes réapparaissent
à côté des nouvelles, donnant des doublons décalés.

## Cause (identifiée)
Dans `frontend/src/lib/cloudPrefs.ts`, à l'hydratation, quand la version **distante est plus récente** :

```js
const next = isMergeable(row.id)
  ? (localIsNewer ? mergeById(local, row.value, seen[row.id] ?? [])
                  : mergeById(row.value, local, []))   // ← liste « déjà vus » VIDE
```

Avec `seen = []`, `mergeById` réajoute **toute** entrée locale absente du distant. Or « absente du
distant » recouvre deux cas opposés : *créée ici et pas encore poussée* (à garder) et *supprimée
ailleurs* (à ne pas ressusciter). Le second l'emporte silencieusement : l'appareil qui détient
l'ancienne copie la remet, puis la repousse au cloud — la suppression est annulée pour tout le monde.

La branche symétrique (`localIsNewer`) passe bien `seen`, elle : le défaut est asymétrique.

## Critères d'acceptation
- [ ] Un dessin supprimé sur l'appareil A disparaît sur l'appareil B après synchronisation, et ne revient pas.
- [ ] Un dessin créé sur A pendant que B était hors ligne arrive bien sur B (pas de régression de la fusion).
- [ ] Idem pour les collections et les ensembles (mêmes clés fusionnables).
- [ ] Cas vérifié à deux appareils réels (Mac + iPhone), suppression dans les deux sens.

## Piste
Le `seen` local ne suffit pas à distinguer les deux cas dans la branche « distant plus récent » :
il faudrait soit un **marqueur de suppression** (tombstone) porté par la valeur distante, soit
comparer aux ids que **cet appareil** a déjà poussés. À arbitrer avec #78, qui attaque le même
moteur pour les collections — les deux ont intérêt à être traités ensemble plutôt qu'en deux
retouches successives du même code.

## Notes / risques
- Toucher à ce moteur, c'est toucher aux données réelles de Jean : prévoir une sauvegarde des clés
  `tvlike:drawings:*` avant le sprint.
- **Le serveur de développement partage le Supabase de production** (constaté le 02/09 : une session
  de test a réduit `EQ.SYNTH` de 11 dessins à 1 et l'a poussé au cloud). À traiter avant tout
  travail sur la synchro — sinon les tests écrivent dans les vraies données.
