// Métriques d'un jeu de règles sur une liste de mois.
// LE TITRE DU RÉSULTAT EST L'ÉCART CONTRE BENCHMARK APPARIÉ, jamais le rendement absolu
// (l'absolu est gonflé par le biais du survivant ; l'écart frappe numérateur et dénominateur).

import type { MoisResultat } from "./moteur.ts";
import type { Serie } from "./data.ts";

export interface Metriques {
  nMois: number;
  pctInvesti: number;
  retNetMoyen: number;
  retBrutMoyen: number;
  benchMoyen: number;
  cagrNet: number;
  volAnnualisee: number;
  pireBaisse: number; // drawdown max sur la courbe nette mensuelle
  pireMois: number;
  ecartNet: number; // net de frais − benchmark apparié
  tNet: number;
  ecartBrut: number; // pour la comparaison avec l'analyse de référence (sans frais)
  tBrut: number;
  eligiblesMediane: number; // taille de l'univers éligible — expose les périodes trop maigres
  eligiblesMin: number;
  seleMediane: number; // nombre de titres réellement détenus
  refXiu: number | null; // rendement mensuel moyen de XIU.TO sur les mêmes fenêtres
  refXwd: number | null;
}

function moyenne(v: number[]): number {
  return v.length === 0 ? NaN : v.reduce((a, b) => a + b, 0) / v.length;
}

function ecartType(v: number[]): number {
  if (v.length < 2) return NaN;
  const m = moyenne(v);
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

function tStudent(v: number[]): number {
  return moyenne(v) / (ecartType(v) / Math.sqrt(v.length));
}

function mediane(v: number[]): number {
  if (v.length === 0) return NaN;
  const t = [...v].sort((a, b) => a - b);
  const m = t.length >> 1;
  return t.length % 2 === 1 ? t[m] : (t[m - 1] + t[m]) / 2;
}

// Rendement ouverture→ouverture d'une série de référence sur une fenêtre [reb, next].
function retFenetre(s: Serie, reb: string, next: string): number {
  const apres = (d: string): number | null => {
    const i = s.idx.get(d);
    if (i !== undefined) return i + 1 < s.dates.length ? s.open[i + 1] : null;
    // pas de barre exactement à d : première barre strictement après d
    let lo = 0;
    let hi = s.dates.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s.dates[mid] <= d) lo = mid + 1;
      else hi = mid;
    }
    return lo < s.dates.length ? s.open[lo] : null;
  };
  const a = apres(reb);
  const v = apres(next);
  return a !== null && v !== null ? v / a - 1 : NaN;
}

export function calculer(mois: MoisResultat[], refs: Map<string, Serie>): Metriques {
  const nets = mois.map((m) => m.net);
  const bruts = mois.map((m) => m.brut);
  const benchs = mois.map((m) => m.bench);
  const ecartsNets = mois.map((m) => m.net - m.bench);
  const ecartsBruts = mois.map((m) => m.brut - m.bench);

  let equite = 1;
  let sommet = 1;
  let pireBaisse = 0;
  for (const r of nets) {
    equite *= 1 + r;
    if (equite > sommet) sommet = equite;
    pireBaisse = Math.min(pireBaisse, equite / sommet - 1);
  }

  const refMoyenne = (ticker: string): number | null => {
    const s = refs.get(ticker);
    if (!s) return null;
    const rets = mois.map((m) => retFenetre(s, m.reb, m.next)).filter((r) => !Number.isNaN(r));
    return rets.length >= mois.length * 0.9 ? moyenne(rets) : null; // référence absente sur la fenêtre
  };

  return {
    nMois: mois.length,
    pctInvesti: moyenne(mois.map((m) => (m.investi ? 1 : 0))),
    retNetMoyen: moyenne(nets),
    retBrutMoyen: moyenne(bruts),
    benchMoyen: moyenne(benchs),
    cagrNet: mois.length > 0 ? equite ** (12 / mois.length) - 1 : NaN,
    volAnnualisee: ecartType(nets) * Math.sqrt(12),
    pireBaisse,
    pireMois: nets.length > 0 ? Math.min(...nets) : NaN,
    ecartNet: moyenne(ecartsNets),
    tNet: tStudent(ecartsNets),
    ecartBrut: moyenne(ecartsBruts),
    tBrut: tStudent(ecartsBruts),
    eligiblesMediane: mediane(mois.map((m) => m.nElig)),
    eligiblesMin: mois.length > 0 ? Math.min(...mois.map((m) => m.nElig)) : NaN,
    seleMediane: mediane(mois.map((m) => m.nSel)),
    refXiu: refMoyenne("XIU.TO"),
    refXwd: refMoyenne("XWD.TO"),
  };
}
