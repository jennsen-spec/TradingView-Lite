// Exporteur MOM.SYNTH (#77, ex-DUO.MOM) — courbe d'équité mensuelle base 100 du duo de PRODUCTION.
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
import { lancer, type MoisResultat } from "./moteur.ts";
import type { Serie } from "./data.ts";
import { lireEtat, calculerCycle } from "./cycleCalc.ts";

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

// Courbe QUOTIDIENNE (base 100). Chaque jour, le panier détenu ce mois-là (retenus,
// équipondéré depuis le cours d'entrée) est valorisé. Les CLÔTURES MENSUELLES restent
// autoritatives (rendement net du moteur, frais + exécution à l'ouverture suivante =
// ×42,9 etc.) : on ancre la fin de chaque mois sur `net` en étalant l'écart frais/exec
// proportionnellement sur les jours (facteur f = net/brut). En liquidités : mois plat.
const R = new Map<string, Serie>(duo.map((s) => [s.ticker, s]));
const r4 = (x: number) => Number((x * 100).toFixed(4));

// Calendrier de bourse = union des dates de l'univers duo (pour densifier les mois cash).
const calSet = new Set<string>();
for (const s of duo) for (const d of s.dates) calSet.add(d);
const calendrier = [...calSet].sort();

const points: { time: string; open: number; high: number; low: number; close: number }[] = [];
let equite = 1; // base 1, = dernière clôture quotidienne émise
for (const m of mois as MoisResultat[]) {
  const startE = equite;
  const jours = calendrier.filter((d) => d > m.reb && d <= m.next);
  if (m.investi && m.retenus.length) {
    const paniers: { s: Serie; entree: number }[] = [];
    for (const t of m.retenus) {
      const s = R.get(t); if (!s) continue;
      const ie = s.idx.get(m.reb); if (ie === undefined || !(s.close[ie] > 0)) continue;
      paniers.push({ s, entree: s.close[ie] });
    }
    const pathAt = (d: string) => { // indice brut du panier (1 à l'entrée)
      let somme = 0, n = 0;
      for (const { s, entree } of paniers) { const i = s.idx.get(d); if (i === undefined) continue; somme += s.close[i] / entree; n++; }
      return n ? somme / n : 1;
    };
    // Correction MULTIPLICATIVE (stable) : ratio c ≈ 1 qui ramène la fin du mois sur `net`
    // (frais + exécution à l'ouverture suivante), étalé en rampe sur les jours du mois.
    const c = (1 + m.net) / pathAt(m.next);
    const nd = jours.length;
    jours.forEach((d, k) => {
      const open = equite;
      const corr = 1 + (c - 1) * ((k + 1) / nd);
      const eq = startE * pathAt(d) * corr;
      points.push({ time: d, open: r4(open), high: r4(Math.max(open, eq)), low: r4(Math.min(open, eq)), close: r4(eq) });
      equite = eq;
    });
  } else {
    // Mois en liquidités : plat (net = 0), un point par jour de bourse pour la densité.
    for (const d of jours) {
      points.push({ time: d, open: r4(equite), high: r4(equite), low: r4(equite), close: r4(equite) });
    }
  }
  equite = startE * (1 + m.net); // clôture mensuelle autoritative (corrige l'arrondi quotidien)
}

// Panier COURANT (mois en cours) : le frontend le valorisera EN DIRECT chaque jour,
// à partir des cours frais de ces titres, pour prolonger la courbe jusqu'à aujourd'hui.
const lastNext = (mois[mois.length - 1] as MoisResultat).next;
const cyc = await calculerCycle({ signal: lastNext });
const basketCourant = {
  investi: !!cyc.marche.investi,
  tickers: cyc.marche.investi ? (cyc.detenus as string[]) : [],
  entree: lastNext,           // date d'entrée du panier courant
  valeurDebut: r4(equite),    // équité base 100 à l'entrée (dernier point figé)
};

// Sanity-check affiché (à comparer aux documents : duo ~×40-53, pire baisse < 40 %).
let maxDD = 0, ddDate = "", sommet = 0;
for (const p of points) { const e = p.close / 100; if (e > sommet) sommet = e; const dd = e / sommet - 1; if (dd < maxDD) { maxDD = dd; ddDate = p.time; } }
const multiple = points[points.length - 1].close / 100;
const invest = mois.filter((m: MoisResultat) => m.investi).length;

writeFileSync(
  SORTIE,
  JSON.stringify(
    {
      _note: `Courbe d'équité QUOTIDIENNE base 100 du duo de production (${etat.regles.jeu}), univers pan-canadien assaini restreint à Industrials+Technology, dividendes inclus, net de frais (clôtures mensuelles autoritatives), interrupteur séance entière. Historique figé jusqu'à 'entree' ; le mois en cours est valorisé EN DIRECT par le frontend depuis 'basketCourant'. LOCAL — non validé, aucune cartouche.`,
      strategie: etat.regles.jeu,
      univers: "market-assaini · Industrials+Technology",
      base: 100,
      basketCourant,
      points,
    },
    null,
    2,
  ) + "\n",
);

console.log(`OK — ${points.length} points quotidiens · ${points[0].time} → ${points[points.length - 1].time}`);
console.log(`   univers duo : ${duo.length} titres · multiple ×${multiple.toFixed(1)} · pire baisse ${(maxDD*100).toFixed(1)}% @ ${ddDate} · investi ${invest}/${mois.length}`);
console.log(`   panier courant : ${basketCourant.investi ? basketCourant.tickers.join(", ") : "CASH"} · entrée ${basketCourant.entree} @ ${basketCourant.valeurDebut}`);
