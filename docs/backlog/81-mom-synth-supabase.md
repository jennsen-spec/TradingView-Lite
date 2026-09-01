# #81 — MOM.SYNTH servi comme un vrai symbole (NAV sur Supabase)

**Statut** : 📥 Backlog · **Points** : 5 · **Catégorie** : 💼 Portefeuille · **Taille** : M

## Idée (Jean, 2026-09-01)
Stocker la courbe NAV de MOM.SYNTH sur Supabase pour qu'elle soit servie **comme n'importe quel
symbole** (l'Edge Function lit déjà `bars`), au lieu du montage actuel : historique dans le bundle
(JSON ~481 Ko) + point courant calculé côté client.

## État actuel (constaté)
- Les **10 titres du panier** sont déjà dans `public.bars` (leurs cours quotidiens).
- **`MOM.SYNTH` n'y est pas** : sa NAV est calculée (historique figé dans `frontend/src/data/duo-mom.json`
  + point courant valorisé en direct par le frontend depuis `basketCourant`). Cf. #79.

## Piste
- Écrire la NAV quotidienne finalisée dans une table (**dédiée `synth_bars`**, pas `bars` — voir risque).
- Edge Function : servir `MOM.SYNTH` depuis cette table + **calculer le point courant live** (elle sait déjà
  fetcher les titres du panier). Le frontend devient « bête » (MOM.SYNTH = symbole normal), plus de JSON au bundle.
- Le panier courant (tickers + entrée + valeur de départ) stocké côté Supabase (ex. `tvlite_prefs` ou table),
  écrit par l'Action rapport.

## Bémols (pourquoi on n'a PAS foncé — décision « on garde tel quel »)
1. **Divergence dev/prod** : aujourd'hui MOM.SYNTH se calcule côté client → identique en local et en prod.
   Le servir depuis Supabase oblige le **backend local** (`backend/src/yahoo.js`, cache SQLite séparé) à savoir
   le servir aussi, sinon MOM.SYNTH casse en dev. Travail en double / deux chemins.
2. **`bars` partagée avec goldencross-radar** : y injecter un ticker synthétique « non validé » risque de le faire
   apparaître dans des scans GCR → préférer une table dédiée (petite modif de lecture Edge Function).
3. L'approche actuelle **marche déjà bien** ; seul coût tangible = le JSON de 481 Ko dans le build public.

## Alternative moins lourde (si un jour on veut juste alléger le bundle)
Sortir seulement l'**historique** du bundle vers Supabase (fetché comme un symbole), en **gardant le point
courant côté client**. Enlève les 481 Ko sans la refonte complète ni le calcul live côté Edge Function.
