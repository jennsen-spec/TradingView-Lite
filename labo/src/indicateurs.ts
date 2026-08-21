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

const CALCULS: Record<string, Calcul> = {
  close: (s) => s.close.slice(),
  historique: (s) => Float64Array.from(s.close, (_, i) => i + 1), // = rn de ta_ca_daily
  dv50,
  mom_12_1: momentum(21, 252), // = ret252_21
  mom_6_1: momentum(21, 126),
  ret_12: momentum(0, 252), // = ret252
  sma20: sma(20),
  sma50: sma(50),
  sma150: sma(150),
  sma200: sma(200),
  rsi14,
  // Distances relatives (pratique en filtre) : close / smaN − 1.
  dist_sma50: (s) => rapport(s, sma(50)),
  dist_sma150: (s) => rapport(s, sma(150)),
  dist_sma200: (s) => rapport(s, sma(200)),
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
