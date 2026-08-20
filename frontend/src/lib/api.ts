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

// Prod : Edge Function Supabase (VITE_API_BASE défini). Dev : chaîne vide → proxy Vite → backend Node.
const API_BASE = import.meta.env.VITE_API_BASE ?? "";
const API_KEY = import.meta.env.VITE_API_KEY ?? "";
// En prod on envoie la clé publishable Supabase (publique) ; en dev aucun en-tête.
const authHeaders: Record<string, string> = API_KEY
  ? { apikey: API_KEY, Authorization: `Bearer ${API_KEY}` }
  : {};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: authHeaders });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
  return json as T;
}

export function fetchCandles(symbol: string, interval = "1d", fresh = false, range?: string) {
  if (API_BASE) {
    // Edge Function : pas de cache → le paramètre `fresh` n'a pas d'objet.
    const q = new URLSearchParams({ symbol, interval });
    if (range) q.set("range", range);
    return getJson<CandlesResponse>(`${API_BASE}/candles?${q.toString()}`);
  }
  const q = `interval=${interval}${fresh ? "&fresh=1" : ""}${range ? `&range=${range}` : ""}`;
  return getJson<CandlesResponse>(`/api/candles/${encodeURIComponent(symbol)}?${q}`);
}

export function searchSymbols(q: string) {
  if (API_BASE) return getJson<SymbolHit[]>(`${API_BASE}/search?q=${encodeURIComponent(q)}`);
  return getJson<SymbolHit[]>(`/api/search?q=${encodeURIComponent(q)}`);
}

export interface Quote {
  symbol: string;
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  currency: string | null;
  marketState: string | null;
}

// Quotes groupées (watchlist) : variation du jour par symbole.
export function fetchQuotes(symbols: string[]) {
  const list = symbols.map((s) => s.trim()).filter(Boolean).join(",");
  if (!list) return Promise.resolve([] as Quote[]);
  if (API_BASE) return getJson<Quote[]>(`${API_BASE}/quotes?symbols=${encodeURIComponent(list)}`);
  return getJson<Quote[]>(`/api/quotes?symbols=${encodeURIComponent(list)}`);
}

export interface QuoteDetail {
  symbol: string;
  longName: string | null;
  exchange: string | null;
  quoteType: string | null;
  currency: string | null;
  price: number | null;
  prevClose: number | null;
  change: number | null;
  changePct: number | null;
  marketState: string | null;
  volume: number | null;
  avgVolume: number | null;
  marketCap: number | null;
}

// Détail d'un symbole (volet watchlist) : nom, bourse, prix, stats clés.
export function fetchQuoteDetail(symbol: string) {
  if (API_BASE) return getJson<QuoteDetail>(`${API_BASE}/quote-detail?symbol=${encodeURIComponent(symbol)}`);
  return getJson<QuoteDetail>(`/api/quote-detail?symbol=${encodeURIComponent(symbol)}`);
}
