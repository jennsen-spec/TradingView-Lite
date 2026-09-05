// Fournisseur FRED — Federal Reserve Bank of St. Louis (#99, épopée #97).
//
// Séries macro : courbe des taux, taux souverains, taux directeur, chômage, prix.
// Gratuit, sans clé pour LIRE une série (la clé n'est requise que pour la recherche
// par mots-clés, qui n'est pas de ce ticket).
//
// Deux particularités par rapport à Yahoo :
// - une série FRED n'a qu'UNE valeur par jour → open = high = low = close. Les bougies
//   sont donc des traits : c'est la donnée qui est ainsi, pas un défaut d'affichage.
// - pas de volume, pas d'intraday.
//
// NB : `fetch` de Node passe, `curl` échoue sur ce domaine (HTTP/2, erreur 92).

import { db } from "./db.js";
import { AGG, aggregate } from "./yahoo.js";

const CSV = "https://fred.stlouisfed.org/graph/fredgraph.csv";
const HEADERS = { "User-Agent": "Mozilla/5.0" };
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 h, comme Yahoo.
const PREFIX = "FRED:";

// Historique borné à ~30 ans : c'est la fenêtre maximale de l'app, et ça évite de
// charger 26 000 points (DFF remonte à 1954) pour un graphique qui en montre 2 500.
const DEPUIS = () => `${new Date().getUTCFullYear() - 30}-01-01`;

// Unité affichée dans la colonne des prix (#11). Les taux sont en %, pas en devise.
const UNITES = {
  T10Y2Y: "%", T10Y3M: "%", DGS10: "%", DGS2: "%", DFF: "%", UNRATE: "%",
  CPIAUCSL: "indice",
};

export const isFred = (symbol) => symbol.toUpperCase().startsWith(PREFIX);
const serieDe = (symbol) => symbol.toUpperCase().slice(PREFIX.length);

const readCache = db.prepare(
  "SELECT payload, fetched_at FROM ohlcv_cache WHERE symbol = ? AND interval = ?"
);
const writeCache = db.prepare(`
  INSERT INTO ohlcv_cache (symbol, interval, payload, fetched_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(symbol, interval) DO UPDATE SET
    payload = excluded.payload, fetched_at = excluded.fetched_at
`);

// CSV FRED : « observation_date,SERIE » puis une ligne par jour. Les valeurs absentes
// sont soit omises, soit notées « . » selon les séries — on saute les deux.
function parseCsv(texte) {
  const candles = [];
  const lignes = texte.trim().split("\n");
  for (let i = 1; i < lignes.length; i++) {
    const [date, brut] = lignes[i].split(",");
    const v = Number(brut);
    if (!date || !brut || brut === "." || !Number.isFinite(v)) continue;
    candles.push({ time: date, open: v, high: v, low: v, close: v, volume: 0 });
  }
  return candles;
}

export async function getFredTimeSeries(symbol, interval = "1d", fresh = false) {
  symbol = symbol.toUpperCase();
  const serie = serieDe(symbol);
  const agg = AGG[interval];

  // Intervalles agrégés : on regroupe le quotidien, comme pour Yahoo.
  if (agg) {
    const src = await getFredTimeSeries(symbol, agg.base === "1h" ? "1d" : agg.base, fresh);
    return { ...src, interval, candles: aggregate(src.candles, agg.bucket) };
  }

  // FRED n'a pas d'intraday : tout intervalle non agrégé retombe sur le quotidien.
  const cacheKey = "1d";
  const cached = readCache.get(symbol, cacheKey);
  if (!fresh && cached && Date.now() - cached.fetched_at < CACHE_TTL_MS) {
    const p = JSON.parse(cached.payload);
    return { symbol, interval: "1d", cached: true, currency: p.currency, name: p.name, candles: p.candles, fetchedAt: cached.fetched_at };
  }

  const url = `${CSV}?id=${encodeURIComponent(serie)}&cosd=${DEPUIS()}`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`Série FRED introuvable : ${serie}`);
  const texte = await res.text();
  if (texte.trimStart().startsWith("<")) throw new Error(`Série FRED introuvable : ${serie}`);

  const candles = parseCsv(texte);
  if (!candles.length) throw new Error(`Aucune donnée FRED pour ${serie}`);

  const currency = UNITES[serie] ?? null;
  const name = serie;
  const now = Date.now();
  writeCache.run(symbol, cacheKey, JSON.stringify({ currency, name, candles }), now);
  return { symbol, interval: "1d", cached: false, currency, name, candles, fetchedAt: now };
}

// Cours d'une série (watchlist + fiche détail) : dernière valeur et variation
// depuis la précédente. Lit le cache posé par getFredTimeSeries.
export async function getFredQuote(symbol) {
  const s = await getFredTimeSeries(symbol, "1d", false);
  const n = s.candles.length;
  const price = n ? s.candles[n - 1].close : null;
  const prevClose = n > 1 ? s.candles[n - 2].close : null;
  return {
    symbol, price, prevClose,
    changePct: price != null && prevClose ? ((price - prevClose) / prevClose) * 100 : null,
    currency: s.currency, marketState: null, volume: null,
  };
}

export async function getFredDetail(symbol) {
  const q = await getFredQuote(symbol);
  return {
    symbol, longName: serieDe(symbol), exchange: "FRED · Fed de St. Louis",
    quoteType: "ECONOMIC", currency: q.currency, price: q.price, prevClose: q.prevClose,
    change: q.price != null && q.prevClose != null ? q.price - q.prevClose : null,
    changePct: q.changePct, marketState: null, volume: null, avgVolume: null, marketCap: null,
  };
}
