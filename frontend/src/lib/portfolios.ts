// Instrument synthétique (#76) — DEJ.601030
//
// Un seul instrument : la poche 5-ETF de Jean (config 60 actions / 10 oblig / 30 or),
// en bougies, **rebasée à 100** → montre l'évolution du portefeuille dans le temps, avec
// tous les indicateurs techniques. Piloté par les cours réels des 5 ETF composants.
// Volume = somme des volumes des ETF.
//
// Confidentialité : on n'utilise que des **poids normalisés** (proportions), pas les
// quantités/valeur réelles → le bundle public ne révèle que l'allocation (déjà dans le nom),
// jamais la valeur du portefeuille. La courbe base 100 ne dépend que de ces ratios.

import type { Candle } from "./indicators";
import type { SymbolHit } from "./api";

import portefeuille from "../data/portefeuille.json";

const WEIGHTS = (portefeuille as { weights: Record<string, number> }).weights;

export const ETF_TICKERS = ["ZEQT.TO", "VMO.TO", "HXS.TO", "ZAG.TO", "ZGLD.TO"];

export const SYNTH_SYMBOL = "DEJ.601030";
const SYNTH_NAME = "Portefeuille DEJ — 60 actions / 10 oblig / 30 or (base 100)";

export function isSynthetic(sym: string): boolean {
  return sym.toUpperCase() === SYNTH_SYMBOL;
}

export function syntheticHits(query: string): SymbolHit[] {
  const hit: SymbolHit = {
    symbol: SYNTH_SYMBOL,
    name: SYNTH_NAME,
    exchange: "Synthétique",
    country: "Canada",
    type: "Performance",
    category: "fonds",
  };
  const q = query.trim().toLowerCase();
  if (!q) return [hit];
  const hay = (hit.symbol + " " + hit.name + " portefeuille dej").toLowerCase();
  return hay.includes(q) ? [hit] : [];
}

// ---------- Moteur (panier à poids constants) ----------

type EtfDaily = Record<string, Candle[]>;

function mk(time: string, o: number, h: number, l: number, c: number, v: number): Candle {
  return { time, open: o, high: Math.max(o, h, c), low: Math.min(o, l, c), close: c, volume: v };
}

// Valeur OHLC + volume du panier jour par jour (démarre quand les 5 ETF ont tous des données).
function basketCandles(weights: Record<string, number>, etf: EtfDaily): Candle[] {
  const tickers = Object.keys(weights).filter((t) => (etf[t]?.length ?? 0) > 0 && weights[t] > 0);
  if (tickers.length === 0) return [];
  const startDate = tickers.map((t) => etf[t][0].time as string).reduce((a, b) => (a > b ? a : b));
  const dateSet = new Set<string>();
  for (const t of tickers) for (const c of etf[t]) if ((c.time as string) >= startDate) dateSet.add(c.time as string);
  const timeline = [...dateSet].sort();

  const ptr: Record<string, number> = {};
  const last: Record<string, Candle | null> = {};
  for (const t of tickers) { ptr[t] = 0; last[t] = null; }

  const out: Candle[] = [];
  for (const date of timeline) {
    let o = 0, h = 0, l = 0, c = 0, vol = 0, ok = true;
    for (const t of tickers) {
      const arr = etf[t];
      while (ptr[t] < arr.length && (arr[ptr[t]].time as string) <= date) { last[t] = arr[ptr[t]]; ptr[t]++; }
      const m = last[t];
      if (!m) { ok = false; break; }
      const w = weights[t];
      o += w * m.open; h += w * m.high; l += w * m.low; c += w * m.close;
      vol += m.volume; // volume = somme des volumes des ETF composants
    }
    if (ok) out.push(mk(date, o, h, l, c, vol));
  }
  return out;
}

// Rebase à 100 sur la 1re clôture (le volume n'est pas mis à l'échelle).
function rebase100(candles: Candle[]): Candle[] {
  if (candles.length === 0) return [];
  const base = candles[0].close;
  if (!(base > 0)) return candles;
  const k = 100 / base;
  return candles.map((c) => mk(c.time as string, c.open * k, c.high * k, c.low * k, c.close * k, c.volume));
}

// ---------- Agrégation d'intervalle (journalier → hebdo/mensuel/…) ----------

function weekKey(t: string): string {
  const d = new Date(t + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${week}`;
}

const BUCKET: Record<string, (t: string) => string> = {
  "1w": weekKey,
  "1mo": (t) => t.slice(0, 7),
  "3mo": (t) => { const d = new Date(t + "T00:00:00Z"); return `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3)}`; },
  "6mo": (t) => { const d = new Date(t + "T00:00:00Z"); return `${d.getUTCFullYear()}-S${d.getUTCMonth() < 6 ? 0 : 1}`; },
  "12mo": (t) => new Date(t + "T00:00:00Z").getUTCFullYear().toString(),
};

function aggregate(daily: Candle[], bucketFn: (t: string) => string): Candle[] {
  const out: Candle[] = [];
  let cur: Candle | null = null;
  let key: string | null = null;
  for (const c of daily) {
    const k = bucketFn(c.time as string);
    if (cur && k === key) {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    } else {
      if (cur) out.push(cur);
      cur = { ...c };
      key = k;
    }
  }
  if (cur) out.push(cur);
  return out;
}

function aggregateInterval(daily: Candle[], interval: string): Candle[] {
  const b = BUCKET[interval];
  return b ? aggregate(daily, b) : daily;
}

// ---------- API du module ----------

export function computeSynthetic(sym: string, etf: EtfDaily, interval: string): { candles: Candle[]; currency: string; name: string } | null {
  if (!isSynthetic(sym)) return null;
  const daily = rebase100(basketCandles(WEIGHTS, etf));
  return { candles: aggregateInterval(daily, interval), currency: "CAD", name: SYNTH_NAME };
}
