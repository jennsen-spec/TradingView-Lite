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
