import { useEffect, useState } from "react";
import Chart from "./components/Chart";
import SymbolSearch from "./components/SymbolSearch";
import IntervalSelector from "./components/IntervalSelector";
import WatchlistPanel from "./components/WatchlistPanel";
import { fetchCandles, searchSymbols } from "./lib/api";
import { syncToCloud } from "./lib/cloudPrefs";
import { useIsMobile } from "./lib/useIsMobile";
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
  const [symbol, setSymbol] = useState("EQ.SYNTH");
  const [interval, setInterval] = useState("1d");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [dailyCandles, setDailyCandles] = useState<Candle[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);
  const [name, setName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  // Coquille mobile (#84) : sous la rupture, un volet à la fois + onglets en bas.
  // Le graphique et la watchlist restent montés (masqués en CSS) pour garder leur état.
  const isMobile = useIsMobile();
  const [mobileTab, setMobileTab] = useState<"watchlist" | "chart">("chart");
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
    <div className={`app${isMobile ? ` mobile mtab-${mobileTab}` : ""}`}>
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
          {/* Rapport mensuel du duo : page autonome générée par `npm run rapport`
              dans frontend/public/, donc servie par le même déploiement. */}
          <a
            className="rapport-btn"
            href={`${import.meta.env.BASE_URL}rapport.html`}
            target="_blank"
            rel="noopener"
            title="Rapport mensuel — duo industrie-techno"
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="14" y2="13" /><line x1="8" y1="17" x2="12" y2="17" />
            </svg>
            <span>Rapport</span>
          </a>
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
        {(isMobile || watchlistOpen) && (
          <WatchlistPanel
            onClose={() => (isMobile ? setMobileTab("chart") : setWatchlistOpen(false))}
            onSelectSymbol={(s) => {
              setSymbol(s);
              if (isMobile) setMobileTab("chart");
            }}
            currentSymbol={symbol}
          />
        )}
      </div>
      {isMobile && (
        <nav className="bottom-tabs">
          <button
            className={`bt-tab${mobileTab === "watchlist" ? " active" : ""}`}
            onClick={() => setMobileTab("watchlist")}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="4" y="3" width="16" height="18" rx="2" />
              <line x1="8" y1="8" x2="16" y2="8" /><line x1="8" y1="12" x2="16" y2="12" /><line x1="8" y1="16" x2="13" y2="16" />
            </svg>
            <span>Watchlist</span>
          </button>
          <button
            className={`bt-tab${mobileTab === "chart" ? " active" : ""}`}
            onClick={() => setMobileTab("chart")}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 17l5-6 4 3 6-8 3 4" />
              <line x1="3" y1="21" x2="21" y2="21" />
            </svg>
            <span>Graphique</span>
          </button>
        </nav>
      )}
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
