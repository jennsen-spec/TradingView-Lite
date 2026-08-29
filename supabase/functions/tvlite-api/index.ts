// TVLite API — proxy Yahoo Finance (candles + search) + cache partagé Supabase.
// Porté de backend/src/yahoo.js. Phase 2 : cache-union « gap-filling » sur le journalier.
//
// Déployé sur le projet Supabase partagé (cucshrxmtwwizzzqthcj) via MCP / supabase CLI.
// Tables lues/écrites : public.bars, public.bars_coverage (migration 0006 côté goldencross-radar).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CHART = "https://query2.finance.yahoo.com/v8/finance/chart";
const LOOKUP = "https://query2.finance.yahoo.com/v1/finance/lookup";
const HEADERS = { "User-Agent": "Mozilla/5.0" };

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

const CACHE_TTL_MS = 12 * 3600 * 1000;
const RANGE_DAYS: Record<string, number> = {
  "7d": 7, "60d": 60, "730d": 730, "1y": 365, "2y": 730, "3y": 1095,
  "5y": 1825, "10y": 3650, "30y": 10950, "max": 100000,
};
const rangeDays = (r: string): number => RANGE_DAYS[r] ?? 3650;

const INTERVAL_MAP: Record<string, string> = {
  "1m": "1m", "2m": "2m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "60m",
  "1d": "1d", "1w": "1wk", "1mo": "1mo",
};
const RANGE_FOR: Record<string, string> = {
  "1m": "7d", "2m": "60d", "5m": "60d", "15m": "60d", "30m": "60d", "60m": "730d",
  "1d": "10y", "1wk": "30y", "1mo": "30y",
};
const INTRADAY = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m"]);

function weekKey(dateStr: string): number {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}

const AGG: Record<string, { base: string; range?: string; bucket: (t: any) => any }> = {
  "1w": { base: "1d", range: "30y", bucket: (t) => weekKey(t) },
  "1mo": { base: "1d", range: "30y", bucket: (t) => t.slice(0, 7) },
  "4h": { base: "1h", bucket: (t) => Math.floor(t / (4 * 3600)) },
  "3mo": { base: "1mo", bucket: (t) => { const d = new Date(t + "T00:00:00Z"); return d.getUTCFullYear() * 4 + Math.floor(d.getUTCMonth() / 3); } },
  "6mo": { base: "1mo", bucket: (t) => { const d = new Date(t + "T00:00:00Z"); return d.getUTCFullYear() * 2 + (d.getUTCMonth() < 6 ? 0 : 1); } },
  "12mo": { base: "1mo", bucket: (t) => new Date(t + "T00:00:00Z").getUTCFullYear() },
};

function aggregate(base: any[], bucketFn: (t: any) => any) {
  const out: any[] = [];
  let cur: any = null, curKey: any = null;
  for (const c of base) {
    const k = bucketFn(c.time);
    if (cur && k === curKey) {
      cur.high = Math.max(cur.high, c.high);
      cur.low = Math.min(cur.low, c.low);
      cur.close = c.close;
      cur.volume += c.volume;
    } else {
      if (cur) out.push(cur);
      cur = { time: c.time, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
      curKey = k;
    }
  }
  if (cur) out.push(cur);
  return out;
}

// --- Cache journalier : read-through + write-through « gap-filling » ---
async function readDailyCache(symbol: string, range: string): Promise<any | null> {
  if (!supabase) return null;
  const needRank = rangeDays(range);
  const { data: cov } = await supabase.from("bars_coverage")
    .select("max_range, currency, name, fetched_at")
    .eq("ticker", symbol).eq("interval", "1d").maybeSingle();
  if (!cov) return null;
  const fresh = Date.now() - new Date(cov.fetched_at).getTime() < CACHE_TTL_MS;
  const covered = rangeDays(cov.max_range) >= needRank;
  if (!fresh || !covered) return null;
  const startDate = new Date(Date.now() - needRank * 86400000).toISOString().slice(0, 10);
  // Pagination : PostgREST plafonne les pages (~1000) ; on boucle par tranches.
  const rows: any[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data: page, error } = await supabase.from("bars")
      .select("bar_date,open,high,low,close,volume")
      .eq("ticker", symbol).eq("interval", "1d").gte("bar_date", startDate)
      .order("bar_date", { ascending: true }).range(from, from + PAGE - 1);
    if (error || !page || page.length === 0) break;
    for (const r of page) rows.push(r);
    if (page.length < PAGE) break;
  }
  if (rows.length === 0) return null;
  await supabase.from("bars_coverage").update({ accessed_at: new Date().toISOString() })
    .eq("ticker", symbol).eq("interval", "1d");
  const candles = rows.map((r: any) => ({
    time: r.bar_date, open: +r.open, high: +r.high, low: +r.low, close: +r.close, volume: Number(r.volume) || 0,
  }));
  return { symbol, interval: "1d", cached: true, currency: cov.currency ?? null, name: cov.name ?? null, candles, fetchedAt: new Date(cov.fetched_at).getTime() };
}

async function writeDailyCache(symbol: string, range: string, currency: any, name: any, candles: any[]) {
  if (!supabase || candles.length === 0) return;
  const rows = candles.map((c) => ({
    ticker: symbol, interval: "1d", bar_date: c.time,
    open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume,
  }));
  for (let i = 0; i < rows.length; i += 1000) {
    await supabase.from("bars").upsert(rows.slice(i, i + 1000), { onConflict: "ticker,interval,bar_date" });
  }
  const { data: cov } = await supabase.from("bars_coverage").select("max_range")
    .eq("ticker", symbol).eq("interval", "1d").maybeSingle();
  const existRank = cov ? rangeDays(cov.max_range) : 0;
  const maxRange = existRank >= rangeDays(range) ? cov!.max_range : range;
  const now = new Date().toISOString();
  await supabase.from("bars_coverage").upsert(
    { ticker: symbol, interval: "1d", max_range: maxRange, currency, name, fetched_at: now, accessed_at: now },
    { onConflict: "ticker,interval" },
  );
}

async function getTimeSeries(symbol: string, interval = "1d", reqRange: string | null = null): Promise<any> {
  symbol = symbol.toUpperCase();
  const agg = AGG[interval];
  const baseKey = agg ? interval : (INTERVAL_MAP[interval] || interval);

  if (agg) {
    const src = await getTimeSeries(symbol, agg.base, agg.range || null);
    const candles = aggregate(src.candles, agg.bucket);
    return { symbol, interval: baseKey, cached: src.cached, currency: src.currency, name: src.name ?? null, candles, fetchedAt: src.fetchedAt };
  }

  const yInterval = baseKey;
  const range = reqRange || RANGE_FOR[yInterval] || "10y";

  if (yInterval === "1d") {
    const hit = await readDailyCache(symbol, range);
    if (hit) return hit;
  }

  const url = `${CHART}/${encodeURIComponent(symbol)}?range=${range}&interval=${yInterval}`;
  const res = await fetch(url, { headers: HEADERS });
  const json: any = await res.json();

  const err = json?.chart?.error;
  if (err) throw new Error(err.description || err.code || "Symbole introuvable");
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Aucune donnée pour ce symbole");

  const ts: number[] = result.timestamp || [];
  const q: any = result.indicators?.quote?.[0] || {};
  const gmt = result.meta?.gmtoffset || 0;
  const currency = result.meta?.currency || null;
  const name = result.meta?.longName || result.meta?.shortName || null;

  const intraday = INTRADAY.has(yInterval);
  const candles: any[] = [];
  for (let i = 0; i < ts.length; i++) {
    // Contrat `bars` (partagé avec GCR) : on EXCLUT toute barre où close OU volume
    // est null (même règle que le worker GCR). Garantit volume non-null et un jeu
    // de barres identique quelle que soit la source (TVLite ou GCR).
    if (q.close?.[i] == null || q.volume?.[i] == null) continue;
    candles.push({
      time: intraday ? ts[i] + gmt : new Date((ts[i] + gmt) * 1000).toISOString().slice(0, 10),
      open: q.open[i], high: q.high[i], low: q.low[i], close: q.close[i],
      volume: q.volume[i],
    });
  }

  if (yInterval === "1d") {
    await writeDailyCache(symbol, range, currency, name, candles);
  }
  return { symbol, interval: yInterval, cached: false, currency, name, candles, fetchedAt: Date.now() };
}

// --- Quotes (watchlist) : dernier prix + variation du jour, via meta v8 (pas de crumb) ---
const quoteCache = new Map<string, { t: number; q: any }>();
const QUOTE_TTL_MS = 60_000;

async function getQuote(symbol: string): Promise<any> {
  symbol = symbol.toUpperCase();
  const hit = quoteCache.get(symbol);
  if (hit && Date.now() - hit.t < QUOTE_TTL_MS) return hit.q;
  const url = `${CHART}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, { headers: HEADERS });
  const json: any = await res.json();
  const meta = json?.chart?.result?.[0]?.meta;
  if (!meta) return { symbol, price: null, prevClose: null, changePct: null, currency: null, marketState: null, volume: null };
  const price = meta.regularMarketPrice ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const changePct = price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null;
  const q = { symbol, price, prevClose, changePct, currency: meta.currency ?? null, marketState: meta.marketState ?? null, volume: meta.regularMarketVolume ?? null };
  quoteCache.set(symbol, { t: Date.now(), q });
  return q;
}

async function getQuotes(symbols: string[]): Promise<any[]> {
  const results: any[] = [];
  let i = 0;
  const worker = async () => {
    while (i < symbols.length) {
      const s = symbols[i++];
      try { results.push(await getQuote(s)); }
      catch { results.push({ symbol: s, price: null, prevClose: null, changePct: null, currency: null, marketState: null, volume: null }); }
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, symbols.length) }, worker));
  return results;
}

// --- Détail d'un symbole (volet watchlist) : v7 quote (crumb) + fallback v8 meta ---
let crumbCache: { crumb: string; cookie: string; t: number } | null = null;
const CRUMB_TTL_MS = 3600_000;

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  if (crumbCache && Date.now() - crumbCache.t < CRUMB_TTL_MS) return crumbCache;
  try {
    const r1 = await fetch("https://fc.yahoo.com/", { headers: HEADERS });
    const cookies = (r1.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter(Boolean);
    const cookie = cookies.join("; ");
    const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { ...HEADERS, cookie } });
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.length > 40 || crumb.includes("<")) return null;
    crumbCache = { crumb, cookie, t: Date.now() };
    return crumbCache;
  } catch {
    return null;
  }
}

async function detailFromV8(symbol: string): Promise<any> {
  const url = `${CHART}/${encodeURIComponent(symbol)}?range=1d&interval=1d`;
  const res = await fetch(url, { headers: HEADERS });
  const meta = (await res.json())?.chart?.result?.[0]?.meta ?? {};
  const price = meta.regularMarketPrice ?? null;
  const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? null;
  return {
    symbol, longName: meta.longName ?? meta.shortName ?? null,
    exchange: meta.fullExchangeName ?? meta.exchangeName ?? null,
    quoteType: meta.instrumentType ?? null, currency: meta.currency ?? null,
    price, prevClose,
    change: price != null && prevClose != null ? price - prevClose : null,
    changePct: price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null,
    marketState: meta.marketState ?? null,
    volume: meta.regularMarketVolume ?? null, avgVolume: null, marketCap: null,
  };
}

const detailCache = new Map<string, { t: number; d: any }>();
async function getQuoteDetail(symbol: string): Promise<any> {
  symbol = symbol.toUpperCase();
  const hit = detailCache.get(symbol);
  if (hit && Date.now() - hit.t < QUOTE_TTL_MS) return hit.d;
  let d: any = null;
  const c = await getCrumb();
  if (c) {
    try {
      const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}&crumb=${encodeURIComponent(c.crumb)}`;
      const res = await fetch(url, { headers: { ...HEADERS, cookie: c.cookie } });
      const q = (await res.json())?.quoteResponse?.result?.[0];
      if (q) {
        d = {
          symbol: q.symbol ?? symbol, longName: q.longName ?? q.shortName ?? null,
          exchange: q.fullExchangeName ?? q.exchange ?? null, quoteType: q.quoteType ?? null,
          currency: q.currency ?? null, price: q.regularMarketPrice ?? null,
          prevClose: q.regularMarketPreviousClose ?? null,
          change: q.regularMarketChange ?? null, changePct: q.regularMarketChangePercent ?? null,
          marketState: q.marketState ?? null, volume: q.regularMarketVolume ?? null,
          avgVolume: q.averageDailyVolume3Month ?? null, marketCap: q.marketCap ?? null,
        };
      }
    } catch { /* fallback ci-dessous */ }
  }
  if (!d) d = await detailFromV8(symbol); // v7 KO (crumb, 401…) → dégradation gracieuse
  detailCache.set(symbol, { t: Date.now(), d });
  return d;
}

function mapType(quoteType: string) {
  switch ((quoteType || "").toLowerCase()) {
    case "equity": return { label: "Action", category: "action" };
    case "etf": return { label: "ETF", category: "fonds" };
    case "mutualfund": return { label: "Fonds", category: "fonds" };
    case "index": return { label: "Indice", category: "indice" };
    case "cryptocurrency": return { label: "Crypto", category: "crypto" };
    case "currency": return { label: "Devise", category: "autre" };
    case "future": return { label: "Future", category: "autre" };
    case "bond": return { label: "Obligation", category: "obligation" };
    default: return { label: quoteType || "—", category: "autre" };
  }
}

const EXCHANGES: Record<string, string> = {
  NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NAS: "NASDAQ",
  NYQ: "NYSE", NYS: "NYSE", ASE: "NYSE American", PCX: "NYSE Arca",
  PNK: "OTC", OTC: "OTC", OQB: "OTC", OQX: "OTC", BATS: "Cboe BZX",
  TOR: "Toronto", NEO: "Cboe Canada", VAN: "TSX Venture", CNQ: "CSE",
  LSE: "Londres", IOB: "Londres IOB",
  FRA: "Francfort", GER: "Xetra", STU: "Stuttgart", DUS: "Düsseldorf",
  HAM: "Hambourg", MUN: "Munich", BER: "Berlin", HAN: "Hanovre",
  PAR: "Paris", AMS: "Amsterdam", BRU: "Bruxelles", LIS: "Lisbonne",
  MCE: "Madrid", MIL: "Milan", EBS: "SIX Suisse", VTX: "SIX Suisse",
  STO: "Stockholm", HEL: "Helsinki", OSL: "Oslo", CPH: "Copenhague",
  VIE: "Vienne", WSE: "Varsovie",
  SAO: "São Paulo", BUE: "Buenos Aires", MEX: "Mexico", SGO: "Santiago",
  SET: "Bangkok", HKG: "Hong Kong", TYO: "Tokyo", JPX: "Tokyo",
  NSE: "Inde NSE", BSE: "Inde BSE", ASX: "Australie", JNB: "Johannesburg",
  TLV: "Tel Aviv", CCC: "Crypto", CCY: "Forex",
};

const EXCHANGE_COUNTRY: Record<string, string> = {
  NMS: "USA", NGM: "USA", NCM: "USA", NAS: "USA", NYQ: "USA", NYS: "USA",
  ASE: "USA", PCX: "USA", PNK: "USA", OTC: "USA", OQB: "USA", OQX: "USA", BATS: "USA",
  TOR: "Canada", NEO: "Canada", VAN: "Canada", CNQ: "Canada",
  LSE: "Royaume-Uni", IOB: "Royaume-Uni",
  FRA: "Allemagne", GER: "Allemagne", STU: "Allemagne", DUS: "Allemagne",
  HAM: "Allemagne", MUN: "Allemagne", BER: "Allemagne", HAN: "Allemagne",
  PAR: "France", AMS: "Pays-Bas", BRU: "Belgique", LIS: "Portugal",
  MCE: "Espagne", MIL: "Italie", EBS: "Suisse", VTX: "Suisse",
  STO: "Suède", HEL: "Finlande", OSL: "Norvège", CPH: "Danemark",
  VIE: "Autriche", WSE: "Pologne",
  SAO: "Brésil", BUE: "Argentine", MEX: "Mexique", SGO: "Chili",
  SET: "Thaïlande", HKG: "Hong Kong", TYO: "Japon", JPX: "Japon",
  NSE: "Inde", BSE: "Inde", ASX: "Australie", JNB: "Afrique du Sud",
  TLV: "Israël", CCC: "Crypto", CCY: "Forex",
};

async function searchSymbols(query: string) {
  const url =
    `${LOOKUP}?query=${encodeURIComponent(query)}&type=all&count=40&start=0` +
    `&formatted=false&lang=en-US&region=US`;
  const res = await fetch(url, { headers: HEADERS });
  const json: any = await res.json();
  const docs = json?.finance?.result?.[0]?.documents || [];
  return docs
    .filter((d: any) => d.symbol && d.quoteType !== "option")
    .map((d: any) => {
      const t = mapType(d.quoteType);
      return {
        symbol: d.symbol,
        name: d.shortName || d.symbol,
        exchange: EXCHANGES[d.exchange] || d.exchange || "",
        country: EXCHANGE_COUNTRY[d.exchange] || "Autre",
        type: t.label,
        category: t.category,
      };
    });
}

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
function jsonResponse(body: any, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const url = new URL(req.url);
  try {
    // Préférences (mono-utilisateur) : GET = toutes les prefs, POST = upsert d'une clé.
    if (url.pathname.includes("/prefs")) {
      if (!supabase) return jsonResponse({});
      if (req.method === "POST") {
        const body = await req.json().catch(() => null);
        if (!body?.id) return jsonResponse({ error: "id requis" }, 400);
        await supabase.from("tvlite_prefs").upsert(
          { id: String(body.id), value: String(body.value ?? ""), updated_at: new Date().toISOString() },
          { onConflict: "id" },
        );
        return jsonResponse({ ok: true });
      }
      // `?meta=1` → [{id,value,updated_at}] (réconciliation #48) ; sinon map {id: value} (forme historique).
      // `?id=<clé>` → limite à une clé (lecture avant écriture, sans rapatrier tous les dessins).
      const only = url.searchParams.get("id");
      let q = supabase.from("tvlite_prefs").select("id,value,updated_at");
      if (only) q = q.eq("id", only);
      const { data } = await q;
      if (url.searchParams.get("meta") === "1") return jsonResponse(data ?? []);
      const out: Record<string, string> = {};
      for (const row of data ?? []) out[row.id] = row.value;
      return jsonResponse(out);
    }
    if (url.pathname.includes("/search")) {
      const query = url.searchParams.get("q") || "";
      if (!query.trim()) return jsonResponse([]);
      return jsonResponse(await searchSymbols(query));
    }
    if (url.pathname.includes("/quotes")) {
      const symbols = (url.searchParams.get("symbols") || "")
        .split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
      if (!symbols.length) return jsonResponse([]);
      return jsonResponse(await getQuotes(symbols.slice(0, 60)));
    }
    if (url.pathname.includes("/quote-detail")) {
      const s = (url.searchParams.get("symbol") || "").trim();
      if (!s) return jsonResponse({ error: "Paramètre 'symbol' requis" }, 400);
      return jsonResponse(await getQuoteDetail(s));
    }
    const symbol = url.searchParams.get("symbol");
    if (!symbol) return jsonResponse({ error: "Paramètre 'symbol' requis" }, 400);
    const interval = url.searchParams.get("interval") || "1d";
    const range = url.searchParams.get("range");
    const data = await getTimeSeries(symbol, interval, range);
    return jsonResponse(data);
  } catch (e) {
    return jsonResponse({ error: (e as Error).message }, 400);
  }
});
