import type { Candle } from "./indicators";

export interface CandlesResponse {
  symbol: string;
  interval: string;
  cached: boolean;
  currency: string | null;
  name?: string | null; // nom long de la société (meta Yahoo)
  candles: Candle[];
  fetchedAt?: number; // ms epoch du dernier chargement (côté backend)
}

export interface SymbolHit {
  symbol: string;
  name: string;
  exchange: string;
  country: string;
  type: string;
  category: string;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}

export function fetchCandles(symbol: string, interval = "1d", fresh = false, range?: string) {
  const q = `interval=${interval}${fresh ? "&fresh=1" : ""}${range ? `&range=${range}` : ""}`;
  return getJson<CandlesResponse>(`/api/candles/${encodeURIComponent(symbol)}?${q}`);
}

export function searchSymbols(q: string) {
  return getJson<SymbolHit[]>(`/api/search?q=${encodeURIComponent(q)}`);
}
