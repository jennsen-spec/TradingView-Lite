// Calculs d'indicateurs — purs, à partir des bougies déjà chargées (0 requête API).

// time = date "YYYY-MM-DD" (jour+) ou timestamp en secondes (intraday).
export type Time = string | number;

export interface Candle {
  time: Time;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface LinePoint {
  time: Time;
  value: number;
}

// Moyenne mobile simple sur `period` clôtures.
export function sma(candles: Candle[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: sum / period });
    }
  }
  return out;
}

// SMA sur une série de points déjà calculés (ex : moyenne mobile du RSI).
export function smaOfPoints(points: LinePoint[], period: number): LinePoint[] {
  const out: LinePoint[] = [];
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    sum += points[i].value;
    if (i >= period) sum -= points[i - period].value;
    if (i >= period - 1) out.push({ time: points[i].time, value: sum / period });
  }
  return out;
}

// RSI de Wilder (lissage classique), période 14 par défaut.
export function rsi(candles: Candle[], period = 14): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length <= period) return out;

  let avgGain = 0;
  let avgLoss = 0;

  // Première moyenne = moyenne simple des `period` premières variations.
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) avgGain += diff;
    else avgLoss -= diff;
  }
  avgGain /= period;
  avgLoss /= period;

  const rsiFrom = (g: number, l: number) =>
    l === 0 ? 100 : 100 - 100 / (1 + g / l);

  out.push({ time: candles[period].time, value: rsiFrom(avgGain, avgLoss) });

  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out.push({ time: candles[i].time, value: rsiFrom(avgGain, avgLoss) });
  }
  return out;
}

// ATR (Average True Range) — lissage de Wilder du True Range, comme le RSI.
export function atr(candles: Candle[], period = 14): LinePoint[] {
  const out: LinePoint[] = [];
  if (candles.length <= period) return out;

  // True Range de chaque bougie (dès la 2e : besoin du close précédent). tr[k] ↔ candles[k+1].
  const tr: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high, l = candles[i].low, pc = candles[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  // Première ATR = moyenne simple des `period` premiers TR, posée à candles[period].
  let avg = 0;
  for (let i = 0; i < period; i++) avg += tr[i];
  avg /= period;
  out.push({ time: candles[period].time, value: avg });

  for (let i = period; i < tr.length; i++) {
    avg = (avg * (period - 1) + tr[i]) / period;
    out.push({ time: candles[i + 1].time, value: avg });
  }
  return out;
}

// --- Force relative de Mansfield / Weinstein (#56) ---

export interface Dividend { ex_date: string; amount: number }

/**
 * Cours ajusté des dividendes.
 *   adj(t) = close(t) × Π (1 − montant_i / clôture de la veille de l'ex-date_i)
 *   pour tous les dividendes dont l'ex-date est POSTÉRIEURE à t.
 * Méthode vérifiée contre l'`adjclose` de Yahoo : exacte sur 126 événements
 * sur 127 pour RY.TO (cf. migration 0011). Le `close` d'origine n'est pas modifié :
 * une bougie ajustée ne correspond à aucun prix auquel on a pu traiter.
 */
export function adjustedCloses(candles: Candle[], divs: Dividend[]): number[] {
  const out = candles.map((c) => c.close);
  if (divs.length === 0 || candles.length === 0) return out;

  const dates = candles.map((c) => String(c.time));
  // Facteur de chaque dividende, à partir de la clôture de la veille de l'ex-date.
  const facteurs: { d: string; f: number }[] = [];
  for (const dv of divs) {
    const ex = String(dv.ex_date);
    let lo = 0, hi = dates.length - 1, prev = -1;
    while (lo <= hi) {
      const m = (lo + hi) >> 1;
      if (dates[m] < ex) { prev = m; lo = m + 1; } else hi = m - 1;
    }
    if (prev < 0) continue;                       // ex-date antérieure à notre historique
    const cv = candles[prev].close, amt = Number(dv.amount);
    if (!(cv > 0) || !(amt > 0) || amt >= cv) continue;
    facteurs.push({ d: ex, f: 1 - amt / cv });
  }

  // Produit cumulatif à rebours : chaque barre porte le produit des facteurs qui la suivent.
  let cum = 1, k = facteurs.length - 1;
  for (let i = candles.length - 1; i >= 0; i--) {
    while (k >= 0 && facteurs[k].d > dates[i]) { cum *= facteurs[k].f; k--; }
    out[i] = candles[i].close * cum;
  }
  return out;
}

/**
 * RS de Mansfield : (ratio / sa moyenne mobile − 1) × 100.
 * Oscille autour de ZÉRO — au-dessus, le titre bat sa référence.
 * `refByDate` doit porter le cours (ajusté) de la référence ; si elle n'a pas de
 * barre à une date, on reporte la dernière connue plutôt que de trouer la série.
 */
export function mansfieldRS(
  candles: Candle[],
  closes: number[],
  refByDate: Map<string, number>,
  period: number,
): LinePoint[] {
  // 1. Ratio titre / référence, avec report de la dernière valeur de référence connue.
  const ratios: { time: Time; r: number }[] = [];
  let dernier: number | null = null;
  for (let i = 0; i < candles.length; i++) {
    const v = refByDate.get(String(candles[i].time));
    if (v != null && v > 0) dernier = v;
    if (dernier == null) continue;               // pas encore de référence : on n'invente rien
    ratios.push({ time: candles[i].time, r: closes[i] / dernier });
  }
  if (ratios.length < period) return [];

  // 2. Moyenne mobile du ratio, puis écart relatif à cette moyenne.
  const out: LinePoint[] = [];
  let somme = 0;
  for (let i = 0; i < ratios.length; i++) {
    somme += ratios[i].r;
    if (i >= period) somme -= ratios[i - period].r;
    if (i < period - 1) continue;
    const moy = somme / period;
    if (!(moy > 0)) continue;
    out.push({ time: ratios[i].time, value: (ratios[i].r / moy - 1) * 100 });
  }
  return out;
}
