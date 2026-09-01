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

// Bougies MENSUELLES avec amplitude réelle. Les clôtures restent autoritatives
// (chaîne des rendements nets du moteur = ×42,9 etc.) ; le haut/bas de chaque mois
// vient de la valorisation quotidienne du panier détenu (retenus), équipondéré,
// rapporté au cours d'entrée. En liquidités (non investi) le mois est plat.
const R = new Map<string, Serie>(duo.map((s) => [s.ticker, s]));
const r4 = (x: number) => Number((x * 100).toFixed(4));

const points: { time: string; open: number; high: number; low: number; close: number }[] = [];
let equite = 1; // base 1
for (const m of mois as MoisResultat[]) {
  const open = equite;
  const close = equite * (1 + m.net);
  let hi = Math.max(open, close), lo = Math.min(open, close);
  if (m.investi && m.retenus.length) {
    const paniers: { s: Serie; entree: number }[] = [];
    const jours = new Set<string>();
    for (const t of m.retenus) {
      const s = R.get(t); if (!s) continue;
      const ie = s.idx.get(m.reb); if (ie === undefined) continue;
      paniers.push({ s, entree: s.close[ie] });
      for (let i = ie + 1; i < s.dates.length && s.dates[i] <= m.next; i++) jours.add(s.dates[i]);
    }
    for (const d of jours) {
      let somme = 0, n = 0;
      for (const { s, entree } of paniers) {
        const i = s.idx.get(d); if (i === undefined || !(entree > 0)) continue;
        somme += s.close[i] / entree - 1; n++;
      }
      if (n) { const eqd = open * (1 + somme / n); if (eqd > hi) hi = eqd; if (eqd < lo) lo = eqd; }
    }
  }
  points.push({ time: m.next, open: r4(open), high: r4(hi), low: r4(lo), close: r4(close) });
  equite = close;
}

// --- Point PROVISOIRE du mois en cours (mark-to-market) ----------------------
// Le dernier point finalisé est daté `lastNext` : la vente s'exécute à l'ouverture
// du mois suivant (convention backtest), donc le mois courant n'a pas encore de
// rendement réalisé. Si des barres existent au-delà, on ajoute un point provisoire :
// le panier tenu ce mois-ci (sélectionné au signal `lastNext`, via calculerCycle),
// valorisé jour par jour jusqu'à la dernière clôture. Il se recalcule/finalise seul
// au prochain rapport (l'exporteur régénère tout).
const lastNext = (mois[mois.length - 1] as MoisResultat).next;
let latest = "";
for (const s of duo) { const d = s.dates[s.dates.length - 1]; if (d > latest) latest = d; }
let provisoire = false;
if (latest > lastNext) {
  const cyc = await calculerCycle({ signal: lastNext });
  const open = equite;
  let close = open, hi = open, lo = open;
  if (cyc.marche.investi && cyc.detenus.length) {
    const paniers: { s: Serie; entree: number }[] = [];
    const jours = new Set<string>();
    for (const t of cyc.detenus) {
      const s = R.get(t); if (!s) continue;
      const ie = s.idx.get(lastNext); if (ie === undefined) continue;
      paniers.push({ s, entree: s.close[ie] });
      for (let i = ie + 1; i < s.dates.length && s.dates[i] <= latest; i++) jours.add(s.dates[i]);
    }
    const valeur = (d: string) => {
      let somme = 0, n = 0;
      for (const { s, entree } of paniers) { const i = s.idx.get(d); if (i === undefined || !(entree > 0)) continue; somme += s.close[i] / entree - 1; n++; }
      return n ? open * (1 + somme / n) : open;
    };
    for (const d of jours) { const e = valeur(d); if (e > hi) hi = e; if (e < lo) lo = e; }
    close = valeur(latest);
    hi = Math.max(hi, open, close); lo = Math.min(lo, open, close);
  }
  points.push({ time: latest, open: r4(open), high: r4(hi), low: r4(lo), close: r4(close) });
  provisoire = true;
}

// Sanity-check affiché (à comparer aux documents : duo ~×40-53, pire baisse < 40 %).
let maxDD = 0, ddDate = "", sommet = 0;
for (const p of points) { const e = p.close / 100; if (e > sommet) sommet = e; const dd = e / sommet - 1; if (dd < maxDD) { maxDD = dd; ddDate = p.time; } }
const multiple = points[points.length - 1].close / 100;
const invest = mois.filter((m: MoisResultat) => m.investi).length;

writeFileSync(
  SORTIE,
  JSON.stringify(
    {
      _note: `Courbe d'équité base 100 du duo de production (${etat.regles.jeu}), univers pan-canadien assaini restreint à Industrials+Technology, dividendes inclus, net de frais, interrupteur séance entière. Dernier point PROVISOIRE (mois en cours mark-to-market, se finalise au prochain rapport). LOCAL — non validé, aucune cartouche.`,
      provisoireDernierPoint: provisoire,
      strategie: etat.regles.jeu,
      univers: "market-assaini · Industrials+Technology",
      base: 100,
      points,
    },
    null,
    2,
  ) + "\n",
);

console.log(`OK — ${points.length} points OHLC · ${points[0].time} → ${points[points.length - 1].time}${provisoire ? " (dernier PROVISOIRE)" : ""}`);
console.log(`   univers duo : ${duo.length} titres · multiple ×${multiple.toFixed(1)} · pire baisse ${(maxDD*100).toFixed(1)}% @ ${ddDate} · investi ${invest}/${mois.length}`);
