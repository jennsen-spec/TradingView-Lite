# #91 — Les suppressions de dessins ne se propagent pas entre appareils

**Statut** : ✅ Fait (UAT Jean 02/09/2026 — vérifié Mac ↔ iPhone) · **Points** : 3 · **Catégorie** : ⚙️ Technique · **Priorité** : à cadrer avec [#78](#) (même moteur de fusion)

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
- [x] Un dessin supprimé sur l'appareil A disparaît sur l'appareil B après synchronisation, et ne revient pas.
- [x] Un dessin créé sur A pendant que B était hors ligne arrive bien sur B (pas de régression de la fusion).
- [x] Idem pour les collections et les ensembles (même code de fusion, mêmes clés `isMergeable`)
- [x] Cas vérifié à deux appareils réels (Mac + iPhone) — UAT Jean le 02/09 : « ça marche ».

## Correctif (02/09/2026)
`seen` est désormais passé **des deux côtés** de la fusion : `mergeById(row.value, local, seen[row.id] ?? [])`.
Un id déjà connu de la synchro et absent de l'autre côté est une **vraie suppression** ; un id
inconnu est une **création locale pas encore poussée**. Le défaut était l'asymétrie, pas la logique
de fusion — aucun marqueur de suppression n'a été nécessaire.

Quatre scénarios vérifiés hors React :
| scénario | résultat |
|---|---|
| suppression faite ailleurs | propagée (ne ressuscite plus) |
| création locale hors ligne | préservée |
| création faite ailleurs | reçue (pas de régression) |
| vidage complet ailleurs | propagé |

*(Avec l'ancien code, le 1ᵉʳ cas ressuscitait l'entrée supprimée — reproduit avant/après.)*

## Notes / risques
- Toucher à ce moteur, c'est toucher aux données réelles de Jean : prévoir une sauvegarde des clés
  `tvlike:drawings:*` avant le sprint.
- **Le serveur de développement partage le Supabase de production** (constaté le 02/09 : une session
  de test a réduit `EQ.SYNTH` de 11 dessins à 1 et l'a poussé au cloud). À traiter avant tout
  travail sur la synchro — sinon les tests écrivent dans les vraies données.
