import express from "express";
import cors from "cors";
import { db } from "./db.js";
import { getTimeSeries, searchSymbols, getQuotes, getQuoteDetail } from "./yahoo.js";
import { isFred, getFredTimeSeries, getFredQuote, getFredDetail } from "./fred.js";

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

const PORT = process.env.PORT || 8787;

app.get("/api/health", (req, res) => {
  res.json({ ok: true, providers: ["yahoo", "fred"] });
});

app.get("/api/candles/:symbol", async (req, res) => {
  try {
    const interval = req.query.interval || "1day";
    const fresh = req.query.fresh === "1" || req.query.fresh === "true";
    const range = req.query.range || null; // range custom (ex. source SMA journalière 30 ans)
    const sym = req.params.symbol;
    // Routage par fournisseur (#99) : le préfixe du ticker désigne la source.
    const data = isFred(sym)
      ? await getFredTimeSeries(sym, interval, fresh)
      : await getTimeSeries(sym, interval, fresh, range);
    res.json(data);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/search", async (req, res) => {
  try {
    const q = (req.query.q || "").toString();
    if (!q) return res.json([]);
    res.json(await searchSymbols(q));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/quotes", async (req, res) => {
  try {
    const symbols = (req.query.symbols || "").toString()
      .split(",").map((s) => s.trim()).filter(Boolean);
    if (!symbols.length) return res.json([]);
    // Chaque fournisseur répond pour les siens, puis on recolle dans l'ordre demandé.
    const fred = symbols.filter(isFred);
    const yahoo = symbols.filter((s) => !isFred(s));
    const rows = [
      ...(yahoo.length ? await getQuotes(yahoo) : []),
      ...(await Promise.all(fred.map((s) => getFredQuote(s).catch(() => ({ symbol: s, price: null, prevClose: null, changePct: null, currency: null, marketState: null, volume: null }))))),
    ];
    res.json(rows);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/quote-detail", async (req, res) => {
  try {
    const symbol = (req.query.symbol || "").toString().trim();
    if (!symbol) return res.status(400).json({ error: "symbol requis" });
    res.json(isFred(symbol) ? await getFredDetail(symbol) : await getQuoteDetail(symbol));
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// --- Stockage clé/valeur (listes, layout, dessins) ---
const kvGet = db.prepare("SELECT value FROM kv_store WHERE key = ?");
const kvSet = db.prepare(`
  INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
`);

app.get("/api/store/:key", (req, res) => {
  const row = kvGet.get(req.params.key);
  res.json(row ? JSON.parse(row.value) : null);
});

app.put("/api/store/:key", (req, res) => {
  kvSet.run(req.params.key, JSON.stringify(req.body ?? null), Date.now());
  res.json({ ok: true });
});

const server = app.listen(PORT, () => {
  console.log(`Backend prêt sur http://localhost:${PORT}`);
});
server.on("error", (e) => console.error("Erreur listen:", e.code, e.message));
