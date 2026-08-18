import { db } from "./db.js";

// Source de données: Yahoo Finance (non-officiel, sans clé, couvre toutes les bourses).
// Suffixes utiles: .TO (Toronto TSX), .V (TSXV), .NE (Cboe Canada), rien = US, .PA (Paris)...
const CHART = "https://query2.finance.yahoo.com/v8/finance/chart";
const LOOKUP = "https://query2.finance.yahoo.com/v1/finance/lookup";
const HEADERS = { "User-Agent": "Mozilla/5.0" }; // Yahoo bloque les requêtes sans UA.
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12h.

// Clés d'intervalle (front) -> intervalles Yahoo natifs.
const INTERVAL_MAP = {
  "1m": "1m", "2m": "2m", "5m": "5m", "15m": "15m", "30m": "30m", "1h": "60m",
  "1d": "1d", "1w": "1wk", "1mo": "1mo", "3mo": "3mo",
};
// Fenêtre d'historique par intervalle Yahoo.
// NB: range=max fait downsampler Yahoo (~168 pts) → pour hebdo/mensuel on borne le range.
const RANGE_FOR = {
  "1m": "7d", "2m": "60d", "5m": "60d", "15m": "60d", "30m": "60d", "60m": "730d",
  "1d": "10y", "1wk": "30y", "1mo": "30y", "3mo": "max",
};
// Intervalles intraday : on renvoie un timestamp (secondes) au lieu d'une date.
const INTRADAY = new Set(["1m", "2m", "5m", "15m", "30m", "60m", "90m"]);

// Lundi (UTC) de la semaine d'une date "YYYY-MM-DD", en ms → clé de bucket hebdo stable.
function weekKey(dateStr) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.getTime();
}

// Intervalles agrégés (non servis proprement par Yahoo) : on regroupe des bougies d'un intervalle de base.
// - 1w/1mo = semaine ISO / mois civil sur le JOURNALIER (Yahoo renvoie des high hebdo/mensuels
//   parfois corrompus, ex. ZEQT.TO ~3× le prix ; le journalier est fiable → on l'agrège nous-mêmes).
//   Range 30 ans sur la base journalière pour conserver l'historique long (réutilise le cache SMA).
// - 4h  = fenêtres de 4h "horloge" sur le 1h (time intraday = ts+gmt déjà en secondes locales)
// - 6mo/12mo = semestre / année civile sur le mensuel (désormais propre car agrégé du journalier)
const AGG = {
  "1w": { base: "1d", range: "30y", bucket: (t) => weekKey(t) },
  "1mo": { base: "1d", range: "30y", bucket: (t) => t.slice(0, 7) },
  "4h": { base: "1h", bucket: (t) => Math.floor(t / (4 * 3600)) },
  "6mo": { base: "1mo", bucket: (t) => { const d = new Date(t + "T00:00:00Z"); return d.getUTCFullYear() * 2 + (d.getUTCMonth() < 6 ? 0 : 1); } },
  "12mo": { base: "1mo", bucket: (t) => new Date(t + "T00:00:00Z").getUTCFullYear() },
};

// Regroupe des bougies consécutives par clé de bucket : open=1ère, close=dernière, high/low, volume=somme.
// Le temps du bucket = temps de la 1ère bougie qu'il contient.
function aggregate(base, bucketFn) {
  const out = [];
  let cur = null;
  let curKey = null;
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

const readCache = db.prepare(
  "SELECT payload, fetched_at FROM ohlcv_cache WHERE symbol = ? AND interval = ?"
);
const writeCache = db.prepare(`
  INSERT INTO ohlcv_cache (symbol, interval, payload, fetched_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(symbol, interval) DO UPDATE SET
    payload = excluded.payload, fetched_at = excluded.fetched_at
`);

// Renvoie les bougies au format Lightweight Charts: { time, open, high, low, close, volume }.
export async function getTimeSeries(symbol, interval = "1d", fresh = false, reqRange = null) {
  symbol = symbol.toUpperCase();
  const agg = AGG[interval];
  // Clé de cache : l'intervalle Yahoo (agrégé = tel quel) ; suffixée si un range custom est demandé
  // (ex. la source SMA journalière 30 ans, distincte de l'affichage journalier 10 ans).
  const baseKey = agg ? interval : INTERVAL_MAP[interval] || interval;
  const cacheKey = reqRange ? `${baseKey}|r=${reqRange}` : baseKey;

  const cached = readCache.get(symbol, cacheKey);
  // fresh = on ignore le cache (bouton refresh) et on ira le réécrire.
  if (!fresh && cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    const parsed = JSON.parse(cached.payload);
    // Compat: anciennes entrées = tableau de bougies; nouvelles = { currency, candles }.
    const candles = Array.isArray(parsed) ? parsed : parsed.candles;
    const currency = Array.isArray(parsed) ? null : parsed.currency;
    const name = Array.isArray(parsed) ? null : parsed.name ?? null;
    return { symbol, interval: baseKey, cached: true, currency, name, candles, fetchedAt: cached.fetched_at };
  }

  // Intervalle agrégé : on récupère l'intervalle de base (avec son propre cache) puis on regroupe.
  if (agg) {
    const src = await getTimeSeries(symbol, agg.base, fresh, agg.range || null);
    const candles = aggregate(src.candles, agg.bucket);
    const now = Date.now();
    writeCache.run(symbol, cacheKey, JSON.stringify({ currency: src.currency, name: src.name ?? null, candles }), now);
    return { symbol, interval: baseKey, cached: false, currency: src.currency, name: src.name ?? null, candles, fetchedAt: now };
  }

  const yInterval = baseKey;
  const range = reqRange || RANGE_FOR[yInterval] || "10y";
  const url = `${CHART}/${encodeURIComponent(symbol)}?range=${range}&interval=${yInterval}`;
  const res = await fetch(url, { headers: HEADERS });
  const json = await res.json();

  const err = json?.chart?.error;
  if (err) throw new Error(err.description || err.code || "Symbole introuvable");
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error("Aucune donnée pour ce symbole");

  const ts = result.timestamp || [];
  const q = result.indicators?.quote?.[0] || {};
  const gmt = result.meta?.gmtoffset || 0; // pour obtenir la date locale de la bourse
  const currency = result.meta?.currency || null;
  const name = result.meta?.longName || result.meta?.shortName || null;

  const intraday = INTRADAY.has(yInterval);
  const candles = [];
  for (let i = 0; i < ts.length; i++) {
    if (q.close?.[i] == null) continue; // saute les jours sans cotation
    candles.push({
      // Intraday: timestamp (secondes, +gmt pour l'heure locale de la bourse). Sinon: date.
      time: intraday ? ts[i] + gmt : new Date((ts[i] + gmt) * 1000).toISOString().slice(0, 10),
      open: q.open[i],
      high: q.high[i],
      low: q.low[i],
      close: q.close[i],
      volume: q.volume?.[i] ?? 0,
    });
  }

  const now = Date.now();
  writeCache.run(symbol, cacheKey, JSON.stringify({ currency, name, candles }), now);
  return { symbol, interval: yInterval, cached: false, currency, name, candles, fetchedAt: now };
}

// quoteType Yahoo -> libellé FR + catégorie (pour les onglets de filtre).
function mapType(quoteType) {
  switch ((quoteType || "").toLowerCase()) {
    case "equity":
      return { label: "Action", category: "action" };
    case "etf":
      return { label: "ETF", category: "fonds" };
    case "mutualfund":
      return { label: "Fonds", category: "fonds" };
    case "index":
      return { label: "Indice", category: "indice" };
    case "cryptocurrency":
      return { label: "Crypto", category: "crypto" };
    case "currency":
      return { label: "Devise", category: "autre" };
    case "future":
      return { label: "Future", category: "autre" };
    case "bond":
      return { label: "Obligation", category: "obligation" };
    default:
      return { label: quoteType || "—", category: "autre" };
  }
}

// Codes de bourse Yahoo -> noms lisibles (fallback : le code brut).
const EXCHANGES = {
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

// Code de bourse -> pays (pour le filtre par pays).
const EXCHANGE_COUNTRY = {
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

export async function searchSymbols(query) {
  const url =
    `${LOOKUP}?query=${encodeURIComponent(query)}&type=all&count=40&start=0` +
    `&formatted=false&lang=en-US&region=US`;
  const res = await fetch(url, { headers: HEADERS });
  const json = await res.json();
  const docs = json?.finance?.result?.[0]?.documents || [];
  return docs
    .filter((d) => d.symbol && d.quoteType !== "option")
    .map((d) => {
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
