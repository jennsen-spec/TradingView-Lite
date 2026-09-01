// Instruments synthétiques du chart.
//
// 1) DOUDOU (#76) — la poche 5-ETF de Jean (60 actions / 10 oblig / 30 or), rebasée à 100,
//    calculée en direct depuis les cours réels des 5 ETF. Volume = somme des volumes ETF.
//    Poids NORMALISÉS (data/portefeuille.json) : le bundle public ne révèle que l'allocation.
//
// 2) DUO.MOM (#77/#79) — courbe d'équité du backtest de la stratégie duo momentum de
//    production (c-duo-plaf5-p1-seance), base 100, MENSUELLE (OHLC), lue depuis
//    data/duo-mom.json. Régénérée chaque mois par l'Action rapport (phase 2). Stratégie
//    NON validée (biais du survivant, pas de stop) — étiquetée comme telle, pas par défaut.

import type { Candle } from "./indicators";
import type { SymbolHit } from "./api";

import portefeuille from "../data/portefeuille.json";

const WEIGHTS = (portefeuille as { weights: Record<string, number> }).weights;

export const ETF_TICKERS = ["ZEQT.TO", "VMO.TO", "HXS.TO", "ZAG.TO", "ZGLD.TO"];

export const SYNTH_SYMBOL = "DOUDOU";
const SYNTH_NAME = "DOUDOU — portefeuille 60 actions / 10 oblig / 30 or (base 100)";

// DUO.MOM — série pré-calculée (data/duo-mom.json), régénérée par l'Action rapport.
// Le glob renvoie {} si le fichier est absent → feature désactivée sans casser la compile.
const duoGlob = import.meta.glob<{ default: { points: { time: string; open: number; high: number; low: number; close: number }[] } }>(
  "../data/duo-mom.json",
  { eager: true },
);
const DUO_DATA = Object.values(duoGlob)[0]?.default ?? null;
const DUO_SYMBOL = "DUO.MOM";
const DUO_NAME = "DUO.MOM — duo secteur momentum (backtest c-duo-plaf5-p1-seance · NON validé)";
const DUO_ENABLED = !!DUO_DATA && (DUO_DATA.points?.length ?? 0) > 0;

export function isSynthetic(sym: string): boolean {
  const s = sym.toUpperCase();
  return s === SYNTH_SYMBOL || (DUO_ENABLED && s === DUO_SYMBOL);
}

export function syntheticHits(query: string): SymbolHit[] {
  const all: SymbolHit[] = [
    { symbol: SYNTH_SYMBOL, name: SYNTH_NAME, exchange: "Synthétique", country: "Canada", type: "Performance", category: "fonds" },
  ];
  if (DUO_ENABLED) {
    all.push({ symbol: DUO_SYMBOL, name: DUO_NAME, exchange: "Synthétique · backtest", country: "Canada", type: "Backtest", category: "fonds" });
  }
  const q = query.trim().toLowerCase();
  if (!q) return all;
  return all.filter((h) => (h.symbol + " " + h.name + " portefeuille duo momentum").toLowerCase().includes(q));
}

// ---------- Moteur ----------

type EtfDaily = Record<string, Candle[]>;

function mk(time: string, o: number, h: number, l: number, c: number, v: number): Candle {
  return { time, open: o, high: Math.max(o, h, c), low: Math.min(o, l, c), close: c, volume: v };
}

// DOUDOU : valeur OHLC + volume du panier jour par jour (démarre quand les 5 ETF ont tous des données).
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
      vol += m.volume;
    }
    if (ok) out.push(mk(date, o, h, l, c, vol));
  }
  return out;
}

function rebase100(candles: Candle[]): Candle[] {
  if (candles.length === 0) return [];
  const base = candles[0].close;
  if (!(base > 0)) return candles;
  const k = 100 / base;
  return candles.map((c) => mk(c.time as string, c.open * k, c.high * k, c.low * k, c.close * k, c.volume));
}

// DUO.MOM : bougies mensuelles OHLC (amplitude réelle = valorisation quotidienne du
// panier détenu, calculée par l'exporteur). Volume 0.
function duoMomCandles(): Candle[] {
  if (!DUO_DATA) return [];
  return DUO_DATA.points.map((p) => mk(p.time, p.open, p.high, p.low, p.close, 0));
}

// ---------- Agrégation d'intervalle (journalier/mensuel → hebdo/mensuel/…) ----------

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
  const s = sym.toUpperCase();
  if (DUO_ENABLED && s === DUO_SYMBOL) {
    return { candles: aggregateInterval(duoMomCandles(), interval), currency: "CAD", name: DUO_NAME };
  }
  if (s !== SYNTH_SYMBOL) return null;
  const daily = rebase100(basketCandles(WEIGHTS, etf));
  return { candles: aggregateInterval(daily, interval), currency: "CAD", name: SYNTH_NAME };
}
