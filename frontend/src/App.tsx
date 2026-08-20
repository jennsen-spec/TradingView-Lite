import { useEffect, useState } from "react";
import Chart from "./components/Chart";
import SymbolSearch from "./components/SymbolSearch";
import IntervalSelector from "./components/IntervalSelector";
import WatchlistPanel from "./components/WatchlistPanel";
import { fetchCandles, searchSymbols } from "./lib/api";
import { syncToCloud } from "./lib/cloudPrefs";
import type { Candle } from "./lib/indicators";

// Historique journalier long pour la SOURCE des SMA (au-delà de l'affichage) → SMA pleines
// sur tout le graphe, sans trou d'amorçage à gauche. 30 ans = historique complet chez Yahoo
// (au-delà, "max" downsample).
const DAILY_SMA_RANGE = "30y";

// Horodatage local « jj-mm-aaaa à hh:mm » (24 h).
function fmtDate(ms: number): string {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export default function App() {
  const [symbol, setSymbol] = useState("AAPL");
  const [interval, setInterval] = useState("1d");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [dailyCandles, setDailyCandles] = useState<Candle[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [theme, setTheme] = useState<"dark" | "light">(() =>
    localStorage.getItem("tvlike:theme") === "dark" ? "dark" : "light"
  );

  // Applique + persiste le thème (le pré-réglage anti-flash est dans index.html).
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("tvlike:theme", theme);
    syncToCloud("tvlike:theme");
  }, [theme]);

  // Titre d'onglet façon TradingView : symbole + prix + variation du jour.
  useEffect(() => {
    const n = dailyCandles.length;
    if (n === 0) { document.title = symbol ? `${symbol} · TV-Like` : "TV-Like"; return; }
    const price = dailyCandles[n - 1].close;
    const prev = n > 1 ? dailyCandles[n - 2].close : price;
    const chg = prev ? ((price - prev) / prev) * 100 : 0;
    const arrow = chg >= 0 ? "▲" : "▼";
    const priceStr = price.toLocaleString("fr-FR", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    document.title = `${symbol} ${priceStr} ${arrow} ${chg >= 0 ? "+" : "−"}${Math.abs(chg).toFixed(2).replace(".", ",")}%`;
  }, [symbol, dailyCandles]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    // Bougies affichées (intervalle choisi) + source SMA journalière LONGUE (30 ans) → SMA pleines.
    const p = fetchCandles(symbol, interval);
    const pDaily = fetchCandles(symbol, "1d", false, DAILY_SMA_RANGE);
    Promise.all([p, pDaily])
      .then(([res, daily]) => {
        if (!cancelled) {
          setCandles(res.candles);
          setDailyCandles(daily.candles);
          setCurrency(res.currency);
          setName(res.name ?? null);
          if (res.fetchedAt) setFetchedAt(res.fetchedAt);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message);
          setCandles([]);
          setDailyCandles([]);
          setCurrency(null);
          setName(null);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [symbol, interval]);

  // Repli du nom : si le backend n'a pas fourni de nom (entrée en cache d'avant l'ajout du champ,
  // ou meta Yahoo sans nom), on le résout via la recherche (match exact du ticker).
  useEffect(() => {
    if (name || !symbol) return;
    let cancelled = false;
    searchSymbols(symbol)
      .then((res) => {
        if (cancelled) return;
        const hit = res.find((h) => h.symbol.toUpperCase() === symbol.toUpperCase());
        if (hit) setName(hit.name);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [symbol, name]);

  // Bouton refresh : recharge le (symbole, intervalle) courants en forçant le contournement du cache.
  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    const p = fetchCandles(symbol, interval, true);
    const pDaily = fetchCandles(symbol, "1d", true, DAILY_SMA_RANGE);
    Promise.all([p, pDaily])
      .then(([res, daily]) => {
        setCandles(res.candles);
        setDailyCandles(daily.candles);
        setCurrency(res.currency);
        setName(res.name ?? null);
        if (res.fetchedAt) setFetchedAt(res.fetchedAt);
        setError(null);
      })
      .catch((err) => setError(err.message))
      .finally(() => setRefreshing(false));
  };

  return (
    <div className="app">
      <header className="toolbar">
        <button className="symbol-trigger" onClick={() => setSearchOpen(true)}>
          <span className="st-ticker">{symbol}</span>
        </button>

        <IntervalSelector value={interval} onChange={setInterval} />

        {/* Le bouton « Indicateurs » (rendu par Chart via un portail) se place ici, à droite des intervalles. */}
        <div id="ind-toolbar-slot" className="ind-toolbar-slot" />

        {/* La barre d'outils de dessins (rendue par DrawingLayer via un portail) se place à droite d'« Indicateurs ». */}
        <div id="draw-toolbar-slot" className="draw-toolbar-slot" />

        <div className="status">
          {loading && <span className="muted">chargement…</span>}
          {error && <span className="err">{error}</span>}
        </div>

        <div className="refresh-cluster">
          <span className="refresh-info" title="Dernière mise à jour des données">
            {fetchedAt ? fmtDate(fetchedAt) : "—"}
          </span>
          <button
            className={`refresh-btn${refreshing ? " spinning" : ""}`}
            onClick={refresh}
            disabled={refreshing}
            title="Recharger les données (contourne le cache)"
            aria-label="Recharger"
          >
            <span className="refresh-ico">↻</span>
          </button>
          <button
            className="theme-btn"
            onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
            title={theme === "dark" ? "Passer en thème clair" : "Passer en thème sombre"}
            aria-label="Basculer le thème"
          >
            {theme === "dark" ? "☀" : "☽"}
          </button>
          <button
            className={`wl-btn${watchlistOpen ? " active" : ""}`}
            onClick={() => setWatchlistOpen((o) => !o)}
            title="Collection (watchlist)"
            aria-label="Collection"
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="9" y1="6" x2="20" y2="6" /><line x1="9" y1="12" x2="20" y2="12" /><line x1="9" y1="18" x2="20" y2="18" />
              <circle cx="4.5" cy="6" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="4.5" cy="12" r="1.3" fill="currentColor" stroke="none" />
              <circle cx="4.5" cy="18" r="1.3" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </header>
      <div className="workspace">
        <main className="chart-area">
          <Chart candles={candles} dailyCandles={dailyCandles} currency={currency} symbol={symbol} name={name} interval={interval} theme={theme} />
        </main>
        {watchlistOpen && (
          <WatchlistPanel
            onClose={() => setWatchlistOpen(false)}
            onSelectSymbol={(s) => setSymbol(s)}
            currentSymbol={symbol}
          />
        )}
      </div>
      {searchOpen && (
        <SymbolSearch
          onSelect={(s) => {
            setSymbol(s);
            setSearchOpen(false);
          }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  );
}
