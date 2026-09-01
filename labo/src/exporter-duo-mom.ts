// Exporteur DUO.MOM (#77) — courbe d'équité mensuelle base 100 du duo de PRODUCTION.
//
// Reproduit à l'identique l'univers du rapport (cycleCalc.ts) : pan-canadien assaini,
// restreint aux secteurs Industrials + Technology, CDR selon etat.json, jeu de règles
// de production (etat.regles.jeu = c-duo-plaf5-p1-seance). Backtest honnête (univers
// market = titres radiés inclus, pas de biais du survivant), net de frais, interrupteur
// séance entière appliqué. LOCAL — non validé. Aucune cartouche consommée.

import { writeFileSync } from "node:fs";
import { chargerMarket, chargerReferences, chargerDividendes } from "./data.ts";
import { actionsCanadiennes, assainir } from "./qualite.ts";
import { definirReferenceRS } from "./indicateurs.ts";
import { chargerSecteurs, definirSecteurs, secteurDe } from "./secteurs.ts";
import { chargerEtfSectoriels, definirPortes } from "./etfSectoriels.ts";
import { chargerJeu } from "./regles.ts";
import { lancer } from "./moteur.ts";
import { courbe, rendementsStrategie } from "./courbes.ts";
import { lireEtat } from "./cycleCalc.ts";

const SORTIE = "frontend/src/data/duo-mom.json";
const etat = lireEtat();

const refs = await chargerReferences();
definirReferenceRS(refs.get("XIU.TO")!);
await chargerDividendes();
const u = assainir(actionsCanadiennes(await chargerMarket()).univers).univers;
definirSecteurs(await chargerSecteurs(u.series.map((s) => s.ticker)));
definirPortes(await chargerEtfSectoriels());

const DUO = new Set(["Industrials", "Technology"]);
const CDR = new Set<string>(etat.regles.exclure_cdr ? etat.regles.cdr : []);
const duo = u.series.filter((s) => DUO.has(secteurDe(s.ticker)) && !CDR.has(s.ticker));

const regles = chargerJeu(etat.regles.jeu);
const tous = lancer({ ...u, series: duo }, regles, refs).mois;
// Fenêtre documentée (#52) : 2004-02 → aujourd'hui. Avant 2004, l'univers pan-canadien
// est trop mince (médiane ~13 titres éligibles) → courbe quasi plate, non représentative.
const DEBUT = "2004-02";
const mois = tous.filter((m: { next: string }) => m.next >= DEBUT);
if (mois.length === 0) { console.error("Aucun mois mesurable — abandon."); process.exit(1); }

const pts = courbe(rendementsStrategie(mois)); // {date, equite (base 1), sousLeau}
const points = pts.map((p) => ({ time: p.date, close: Number((p.equite * 100).toFixed(4)) }));

// Sanity-check affiché (à comparer aux documents : duo ~×40-53, pire baisse < 40 %).
let maxDD = 0, ddDate = "";
for (const p of pts) if (p.sousLeau < maxDD) { maxDD = p.sousLeau; ddDate = p.date; }
const invest = mois.filter((m: { investi?: boolean }) => m.investi !== false).length;

writeFileSync(
  SORTIE,
  JSON.stringify(
    {
      _note: `Courbe d'équité base 100 du duo de production (${etat.regles.jeu}), univers pan-canadien assaini restreint à Industrials+Technology, dividendes inclus, net de frais, interrupteur séance entière. LOCAL — non validé, aucune cartouche.`,
      strategie: etat.regles.jeu,
      univers: "market-assaini · Industrials+Technology",
      base: 100,
      points,
    },
    null,
    2,
  ) + "\n",
);

console.log(`OK — ${points.length} points · ${points[0].time} → ${points[points.length - 1].time}`);
console.log(`   univers duo : ${duo.length} titres · multiple ×${pts[pts.length-1].equite.toFixed(1)} · pire baisse ${(maxDD*100).toFixed(1)}% @ ${ddDate} · investi ${invest}/${mois.length}`);
