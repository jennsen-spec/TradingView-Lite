// Contrôle de qualité des séries de prix.
//
// Défaut identifié le 22/08/2026 : un backfill inséré en « on conflict do nothing »
// a laissé cohabiter deux échelles de prix sur les titres ayant subi un regroupement
// d'actions entre le scrape initial et le backfill. La série saute alors d'un facteur
// 10 ou 50 en plein milieu, sans mouvement de marché.
//
// Test : rapport de deux clôtures consécutives > 2,5 ou < 0,4. Un titre qui présente
// au moins une rupture est écarté en entier — on ne répare pas, on exclut.
//
// Deux profils connus :
//   - aberration transitoire (trou d'une séance puis rebond mécanique) : BCT.TO, ELE.TO…
//   - décalage de niveau permanent (regroupement non répercuté) : TLO.TO, WEED.TO…

import type { Serie, Univers } from "./data.ts";

export const HAUT = 2.5;
export const BAS = 0.4;

export interface Rupture {
  ticker: string;
  date: string;
  avant: number;
  apres: number;
  ratio: number;
}

export function detecter(series: Serie[]): Rupture[] {
  const ruptures: Rupture[] = [];
  for (const s of series) {
    for (let i = 1; i < s.close.length; i++) {
      const a = s.close[i - 1];
      const b = s.close[i];
      if (!(a > 0) || !(b > 0)) continue;
      const ratio = b / a;
      if (ratio > HAUT || ratio < BAS) {
        ruptures.push({ ticker: s.ticker, date: s.dates[i], avant: a, apres: b, ratio });
      }
    }
  }
  return ruptures;
}

export interface Assainissement {
  univers: Univers;
  ecartes: string[];
  ruptures: Rupture[];
}

// Retire de l'univers tout titre présentant au moins une rupture.
export function assainir(univers: Univers): Assainissement {
  const ruptures = detecter(univers.series);
  const ecartes = [...new Set(ruptures.map((r) => r.ticker))].sort();
  const exclus = new Set(ecartes);
  return {
    univers: { nom: univers.nom, series: univers.series.filter((s) => !exclus.has(s.ticker)) },
    ecartes,
    ruptures,
  };
}

// ── Périmètre de l'univers ──────────────────────────────────────────────────
// `bars_coverage` mélange trois choses : des actions canadiennes, des cotations
// étrangères (AMD, NVDA, SPY… et les doublons américains de TD/RY/LSPD) et une
// vingtaine d'ETF de référence chargés en #49. Un backtest « actions canadiennes »
// doit écarter les deux dernières familles : sans ça, NVDA se retrouve dans le
// classement momentum d'un portefeuille censé être canadien.

// Les seuls ETF présents dans la base (vérifié : ce sont exactement les lignes
// de `bars_coverage` qui portent un nom d'ETF).
export const ETF_CONNUS = new Set([
  "XIU.TO", "XSP.TO", "XSU.TO", "XFN.TO", "XLB.TO", "ZEQT.TO", "ZFL.TO",
  "VMO.TO", "HXS.TO", "BTCX.TO", "BTCX-B.TO", "BTCX-U.TO", "RIIN.TO", "XWD.TO",
]);

export interface Perimetre {
  univers: Univers;
  horsBourse: string[]; // cotations non canadiennes
  etf: string[];
}

// Ne garde que les actions cotées à Toronto (.TO) ou au TSX Venture (.V), ETF exclus.
export function actionsCanadiennes(univers: Univers): Perimetre {
  const horsBourse: string[] = [];
  const etf: string[] = [];
  const series = univers.series.filter((s) => {
    if (!/\.(TO|V)$/.test(s.ticker)) {
      horsBourse.push(s.ticker);
      return false;
    }
    if (ETF_CONNUS.has(s.ticker)) {
      etf.push(s.ticker);
      return false;
    }
    return true;
  });
  return { univers: { nom: univers.nom, series }, horsBourse: horsBourse.sort(), etf: etf.sort() };
}
