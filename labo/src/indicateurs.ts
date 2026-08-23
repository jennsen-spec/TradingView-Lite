// Indicateurs par titre, calculés en colonnes (mêmes conventions que ta_ca_daily,
// vérifiées contre elle par `npm run labo -- --verifier`).
// NaN = indéfini (historique insuffisant) → le titre échoue la condition.

import type { Serie } from "./data.ts";

type Calcul = (s: Serie) => Float64Array;

function sma(n: number): Calcul {
  return (s) => {
    const r = new Float64Array(s.close.length).fill(NaN);
    let somme = 0;
    for (let i = 0; i < s.close.length; i++) {
      somme += s.close[i];
      if (i >= n) somme -= s.close[i - n];
      if (i >= n - 1) r[i] = somme / n;
    }
    return r;
  };
}

// Moyenne 50 séances du volume en dollars (close × volume), fenêtre incluant la séance courante.
const dv50: Calcul = (s) => {
  const r = new Float64Array(s.close.length).fill(NaN);
  let somme = 0;
  for (let i = 0; i < s.close.length; i++) {
    somme += s.close[i] * s.volume[i];
    if (i >= 50) somme -= s.close[i - 50] * s.volume[i - 50];
    if (i >= 49) r[i] = somme / 50;
  }
  return r;
};

// Momentum avec saut : close[t-saut] / close[t-fenetre] − 1.
// Le saut du dernier mois est INTENTIONNEL (évite le retournement court terme).
function momentum(saut: number, fenetre: number): Calcul {
  return (s) => {
    const r = new Float64Array(s.close.length).fill(NaN);
    for (let i = fenetre; i < s.close.length; i++) {
      r[i] = s.close[i - saut] / s.close[i - fenetre] - 1;
    }
    return r;
  };
}

// RSI 14 « Cutler » (moyennes simples des hausses/baisses sur 14 variations),
// c'est la variante que contient ta_ca_daily (vérifié par --verifier).
const rsi14: Calcul = (s) => {
  const n = 14;
  const r = new Float64Array(s.close.length).fill(NaN);
  const gains = new Float64Array(s.close.length);
  const pertes = new Float64Array(s.close.length);
  for (let i = 1; i < s.close.length; i++) {
    const d = s.close[i] - s.close[i - 1];
    gains[i] = d > 0 ? d : 0;
    pertes[i] = d < 0 ? -d : 0;
  }
  let sg = 0;
  let sp = 0;
  for (let i = 1; i < s.close.length; i++) {
    sg += gains[i];
    sp += pertes[i];
    if (i > n) {
      sg -= gains[i - n];
      sp -= pertes[i - n];
    }
    if (i >= n) {
      r[i] = sg + sp === 0 ? 50 : 100 - 100 / (1 + sg / sp);
    }
  }
  return r;
};


// ── Force relative de Mansfield ─────────────────────────────────────────────
// RS ratio  = cours du titre / cours de la référence (XIU.TO), aligné par date.
// Mansfield = (ratio / moyenne 252 séances du ratio − 1) × 100.
//
// La nuance qui compte : ce n'est PAS du momentum déguisé. Un titre qui a triplé
// il y a un an et stagne depuis a un Mansfield FAIBLE (son ratio est retombé sur
// sa moyenne) ; un titre qui commence tout juste à battre l'indice l'a ÉLEVÉ.
// C'est précisément la différence entre « a beaucoup monté » et « surperforme
// en ce moment ». Voir #56.

let referenceRS: Serie | null = null;

export function definirReferenceRS(s: Serie | null): void {
  referenceRS = s;
}

// Clôture de la référence à la date d, ou la dernière antérieure (jamais postérieure).
function refA(r: Serie, d: string): number {
  const i = r.idx.get(d);
  if (i !== undefined) return r.close[i];
  let lo = 0;
  let hi = r.dates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (r.dates[mid] <= d) lo = mid + 1;
    else hi = mid;
  }
  return lo > 0 ? r.close[lo - 1] : NaN;
}

// Moyenne mobile sur un tableau quelconque ; toute valeur indéfinie remet le compteur
// à zéro (on n'invente pas de moyenne au-dessus d'un trou).
function moyenneMobile(v: Float64Array, n: number): Float64Array {
  const r = new Float64Array(v.length).fill(NaN);
  let somme = 0;
  let compte = 0;
  for (let i = 0; i < v.length; i++) {
    if (Number.isNaN(v[i])) {
      somme = 0;
      compte = 0;
      continue;
    }
    somme += v[i];
    compte++;
    if (compte > n) {
      somme -= v[i - n];
      compte = n;
    }
    if (compte === n) r[i] = somme / n;
  }
  return r;
}

const rsRatio: Calcul = (s) => {
  const r = new Float64Array(s.close.length).fill(NaN);
  if (!referenceRS) return r;
  for (let i = 0; i < s.close.length; i++) {
    const ref = refA(referenceRS, s.dates[i]);
    if (ref > 0) r[i] = s.close[i] / ref;
  }
  return r;
};

function mansfield(fenetre: number): Calcul {
  return (s) => {
    const ratio = rsRatio(s);
    const moy = moyenneMobile(ratio, fenetre);
    return Float64Array.from(ratio, (v, i) => (v / moy[i] - 1) * 100);
  };
}

// Écart-type des rendements journaliers sur `n` séances — sert à dimensionner le stop.
function volatilite(n: number): Calcul {
  return (s) => {
    const r = new Float64Array(s.close.length).fill(NaN);
    const rend = new Float64Array(s.close.length).fill(NaN);
    for (let i = 1; i < s.close.length; i++) rend[i] = s.close[i] / s.close[i - 1] - 1;
    for (let i = n; i < s.close.length; i++) {
      let somme = 0;
      for (let k = i - n + 1; k <= i; k++) somme += rend[k];
      const m = somme / n;
      let carre = 0;
      for (let k = i - n + 1; k <= i; k++) carre += (rend[k] - m) ** 2;
      r[i] = Math.sqrt(carre / (n - 1));
    }
    return r;
  };
}

const CALCULS: Record<string, Calcul> = {
  close: (s) => s.close.slice(),
  historique: (s) => Float64Array.from(s.close, (_, i) => i + 1), // = rn de ta_ca_daily
  dv50,
  mom_12_1: momentum(21, 252), // = ret252_21
  mom_6_1: momentum(21, 126),
  ret_12: momentum(0, 252), // = ret252
  sma20: sma(20),
  sma50: sma(50),
  sma75: sma(75),
  sma150: sma(150),
  sma200: sma(200),
  rsi14,
  // Distances relatives (pratique en filtre) : close / smaN − 1.
  dist_sma50: (s) => rapport(s, sma(50)),
  dist_sma150: (s) => rapport(s, sma(150)),
  dist_sma200: (s) => rapport(s, sma(200)),
  rs_ratio: rsRatio,
  rs_mansfield: mansfield(252),
  vol20: volatilite(20),
  // Pente de la MM50 sur 75 séances : sma50[i] / sma50[i-75] − 1.
  // > 0 = la moyenne est plus haute qu'il y a 75 séances, donc orientée à la hausse.
  // Ce n'est PAS « le prix au-dessus de sa moyenne » : c'est la trajectoire de la moyenne
  // elle-même, qui réagit plus lentement et ignore les mèches.
  pente_sma50_75: (s) => {
    const m = sma(50)(s);
    const r = new Float64Array(s.close.length).fill(NaN);
    for (let i = 75; i < s.close.length; i++) r[i] = m[i] / m[i - 75] - 1;
    return r;
  },
  // Nombre de séances CONSÉCUTIVES sous la moyenne (0 si au-dessus aujourd'hui).
  // Sert aux interrupteurs « à persistance » : sortir seulement si la faiblesse dure.
  sous_sma50_depuis: (s) => {
    const m = sma(50)(s);
    const r = new Float64Array(s.close.length).fill(NaN);
    let n = 0;
    for (let i = 0; i < s.close.length; i++) {
      if (Number.isNaN(m[i])) { r[i] = NaN; continue; }
      n = s.close[i] < m[i] ? n + 1 : 0;
      r[i] = n;
    }
    return r;
  },
  // Pente de la moyenne 150 j sur 21 séances (≈ 1 mois) : > 0 = moyenne orientée à la
  // hausse. C'est le critère de Weinstein — le cours au-dessus de sa moyenne ne suffit
  // pas, encore faut-il que la moyenne elle-même monte.
  pente_sma150: (s) => {
    const m = sma(150)(s);
    const r = new Float64Array(s.close.length).fill(NaN);
    for (let i = 21; i < s.close.length; i++) r[i] = m[i] / m[i - 21] - 1;
    return r;
  },
};

function rapport(s: Serie, calc: Calcul): Float64Array {
  const m = calc(s);
  return Float64Array.from(m, (v, i) => s.close[i] / v - 1);
}

export function colonne(s: Serie, nom: string): Float64Array {
  let col = s.memo.get(nom);
  if (!col) {
    const calc = CALCULS[nom];
    if (!calc) throw new Error(`Indicateur inconnu : « ${nom} » (connus : ${Object.keys(CALCULS).join(", ")})`);
    col = calc(s);
    s.memo.set(nom, col);
  }
  return col;
}

export function valeur(s: Serie, nom: string, i: number): number {
  return colonne(s, nom)[i];
}

export const INDICATEURS_CONNUS = Object.keys(CALCULS);
