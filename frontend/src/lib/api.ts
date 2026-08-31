import type { Candle } from "./indicators";
import { isSynthetic, computeSynthetic, ETF_TICKERS } from "./portfolios";

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

function rawFetchCandles(symbol: string, interval = "1d", fresh = false, range?: string) {
  if (API_BASE) {
    // Edge Function : pas de cache → le paramètre `fresh` n'a pas d'objet.
    const q = new URLSearchParams({ symbol, interval });
    if (range) q.set("range", range);
    return getJson<CandlesResponse>(`${API_BASE}/candles?${q.toString()}`);
  }
  const q = `interval=${interval}${fresh ? "&fresh=1" : ""}${range ? `&range=${range}` : ""}`;
  return getJson<CandlesResponse>(`/api/candles/${encodeURIComponent(symbol)}?${q}`);
}

// Portefeuilles synthétiques (#76) : calculés côté client depuis les 5 ETF (journalier).
async function fetchSyntheticCandles(symbol: string, interval: string, fresh: boolean): Promise<CandlesResponse> {
  const etf: Record<string, Candle[]> = {};
  await Promise.all(
    ETF_TICKERS.map(async (t) => {
      try { etf[t] = (await rawFetchCandles(t, "1d", fresh, "10y")).candles; }
      catch { etf[t] = []; }
    })
  );
  const res = computeSynthetic(symbol, etf, interval);
  if (!res) throw new Error(`Symbole synthétique inconnu : ${symbol}`);
  return { symbol, interval: "1d", cached: false, currency: res.currency, name: res.name, candles: res.candles, fetchedAt: Date.now() };
}

export function fetchCandles(symbol: string, interval = "1d", fresh = false, range?: string): Promise<CandlesResponse> {
  if (isSynthetic(symbol)) return fetchSyntheticCandles(symbol, interval, fresh);
  return rawFetchCandles(symbol, interval, fresh, range);
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
  volume: number | null;
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

// --- Dividendes (#56) ---
// Lus directement chez Supabase dans les deux modes : le backend Node de dev
// n'a pas cette table. Données de marché publiques, lecture seule (RLS `anon`).
const DIV_URL = "https://cucshrxmtwwizzzqthcj.supabase.co/rest/v1/dividends";
const DIV_KEY = "sb_publishable_mbSe0WzTCQixT5Do_WILRg_U2F6DgTE";

export interface Dividend { ex_date: string; amount: number }

const divCache = new Map<string, Promise<Dividend[]>>();

export function fetchDividends(symbol: string): Promise<Dividend[]> {
  const key = symbol.toUpperCase();
  const hit = divCache.get(key);
  if (hit) return hit;
  const q = `?ticker=eq.${encodeURIComponent(key)}&select=ex_date,amount&order=ex_date.asc`;
  const p = fetch(DIV_URL + q, { headers: { apikey: DIV_KEY } })
    .then((r) => (r.ok ? r.json() : []))
    .then((rows) => (Array.isArray(rows) ? (rows as Dividend[]) : []))
    .catch(() => [] as Dividend[]);
  divCache.set(key, p);
  return p;
}
