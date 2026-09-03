# #95 — Écran de chargement animé

**Statut** : 🔍 Affiné · **Points** : 2 · **Catégorie** : 🎨 Cosmetic

## Objectif
Remplacer l'**écran blanc du démarrage** par l'animation du logomark, surtout visible dans l'app
installée sur l'iPhone où rien (ni barre d'adresse, ni onglets) ne vient meubler l'attente.

## Le blanc dure combien ? (mesuré en prod le 02/09, bonne connexion)
| Étape | Temps |
|---|---|
| HTML reçu | 675 ms |
| JavaScript téléchargé (230 Ko) | 930 ms |
| DOM complet | 963 ms |
| Premières bougies (API) | 2,2 à 5,0 s |

Aucun rendu n'est enregistré avant le montage de React : **~1 s de blanc minimum** sur une bonne
connexion, 2 à 4 s attendues en 4G.

## L'animation existe déjà
`loading-iphone.html` (racine du dépôt) — autonome, sans dépendance : le logomark se trace
progressivement en blanc sur fond bleu `#3A83F7`, en boucle (2 s d'animation, 1,1 s de pause),
avec un `#splash.hidden` prêt pour le fondu de sortie et un repli `prefers-reduced-motion`.

## Décisions
- **L'animation doit être écrite en dur dans `index.html`**, CSS et script en ligne. C'est tout
  l'enjeu : elle doit peindre dès l'arrivée du HTML (675 ms), *avant* le bundle. Chargée par React,
  elle apparaîtrait exactement quand l'écran blanc se termine — donc pour rien.
- Poids à assumer : **+9 Ko bruts, ~3,7 Ko gzippés** ajoutés à un `index.html` qui en fait 2,1 Ko
  aujourd'hui. La constante du tracé (`PTS`) en représente à elle seule 2,9 Ko. C'est le prix à
  payer pour une peinture immédiate ; à ce volume, ça reste très inférieur au coût d'un aller-retour.

## Critères d'acceptation
- [ ] Au lancement (app installée **et** navigateur), l'animation s'affiche à la place du blanc.
- [ ] Elle disparaît en fondu quand l'app est prête, sans à-coup ni double rendu.
- [ ] Rien ne régresse au démarrage : thème appliqué sans flash, zone sûre respectée, pas de barre d'état incohérente.
- [ ] `prefers-reduced-motion` : marque affichée fixe, sans animation (déjà géré par le fichier source).
- [ ] Desktop : l'écran de chargement apparaît aussi, sans gêner (le blanc y dure moins longtemps).
- [ ] UAT Jean sur iPhone, app installée.

## Questions ouvertes
1. **Quand retirer l'écran ?** Au **montage de React** (~1 s : la coquille apparaît, graphique
   encore vide) ou **aux premières bougies** (2-5 s : l'app est vraiment utilisable, mais l'attente
   est plus longue). Je penche pour le montage — plus honnête sur la progression.
2. **Le fond bleu `#3A83F7`** ne correspond ni au thème clair (`#ffffff`) ni au sombre (`#0e1117`) :
   la transition sera bleu → thème. Choix de marque assumé, ou faut-il que le fond suive le thème ?

## Plan technique
1. Reporter le bloc `#splash` + le script `Logomark` dans `frontend/index.html`, en ligne, avant `#root` → vérif : le premier rendu contient l'animation, sans requête supplémentaire.
2. Retirer l'écran depuis `main.tsx`/`App` (`classList.add('hidden')`, la ligne est déjà prête en commentaire dans le fichier source) → vérif : fondu propre, l'élément ne reste pas dans l'arbre.
3. **Arbitrer les conflits d'en-tête** avec l'`index.html` actuel — le fichier source apporte des balises qui contredisent l'existant :
   - `theme-color: #3A83F7` fixe vs le nôtre **piloté par le thème** (#88/#92) → à concilier (probablement : bleu pendant le splash, puis rendre la main à l'app) ;
   - `apple-mobile-web-app-status-bar-style: black-translucent` vs notre `default` ;
   - `user-scalable=no` : inutile chez nous, le zoom de page est déjà neutralisé en JS (#86) ;
   - `html, body { overflow: hidden }` **global** dans le fichier source, alors que chez nous c'est **mobile uniquement** (correctif du rebond, épopée #70) — ne pas l'imposer au desktop.
4. Vérifier sur iPhone réel, app installée.

## Notes / risques
- Le vrai risque est de **casser le démarrage** en reprenant les balises du fichier source telles
  quelles : elles ont été écrites pour une page autonome, pas pour s'ajouter à un `index.html` qui
  porte déjà le manifeste, le pré-réglage de thème anti-flash et les balises PWA.
- L'animation boucle : si l'app est prête en 1 s, elle sera coupée en plein tracé. Acceptable, mais
  à regarder — un fondu trop brusque se remarquerait.
