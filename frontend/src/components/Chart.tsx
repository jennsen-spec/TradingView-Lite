import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  PriceScaleMode,
  CrosshairMode,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type IPriceScaleApi,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Candle, LinePoint, Time } from "../lib/indicators";
import { sma, rsi, atr, smaOfPoints, adjustedCloses, mansfieldRS } from "../lib/indicators";
import type { Dividend as DividendRow } from "../lib/indicators";
import { fetchDividends, fetchCandles as fetchCandlesApi } from "../lib/api";
import IndicatorSettings from "./IndicatorSettings";
import IndicatorCatalog from "./IndicatorCatalog";
import DrawingLayer from "./DrawingLayer";
import type { IndicatorSettings as IndSettings, LineStyleName, IndType } from "../lib/indicatorSettings";
import { rgba, visibleForInterval, loadIndicators, saveIndicators, smaDefault, SMA_COLORS } from "../lib/indicatorSettings";
import { fmtTimeByInterval } from "../lib/timeFormat";

// Temps -> secondes (nombre). Date "YYYY-MM-DD" → Date.parse ; intraday = déjà un timestamp.
const tsOf = (t: Time) => (typeof t === "number" ? t : Date.parse(t) / 1000);

// Aligne des points journaliers (SMA jour) sur la timeline de l'intervalle :
// pour chaque bougie, on prend la dernière valeur journalière dont la date <= celle de la bougie.
function alignDailyToCandles(dailyPts: LinePoint[], candles: Candle[]): Map<Time, number> {
  const map = new Map<Time, number>();
  if (dailyPts.length === 0) return map;
  const dTs = dailyPts.map((p) => tsOf(p.time));
  let j = 0;
  for (const c of candles) {
    const ct = tsOf(c.time);
    while (j + 1 < dTs.length && dTs[j + 1] <= ct) j++;
    if (dTs[0] <= ct) map.set(c.time, dailyPts[j].value);
  }
  return map;
}

// Primitive : bande ombrée horizontale entre deux niveaux de prix (fond du RSI).
class BandRenderer {
  constructor(private _src: RsiBand) {}
  draw(target: any) {
    const s = this._src;
    if (!s.visible) return;
    const yU = s.series.priceToCoordinate(s.upper);
    const yL = s.series.priceToCoordinate(s.lower);
    if (yU === null || yL === null) return;
    target.useBitmapCoordinateSpace((scope: any) => {
      const ctx = scope.context;
      const top = Math.min(yU, yL) * scope.verticalPixelRatio;
      const bottom = Math.max(yU, yL) * scope.verticalPixelRatio;
      ctx.fillStyle = s.color;
      ctx.fillRect(0, top, scope.bitmapSize.width, bottom - top);
    });
  }
}
class BandPaneView {
  private _renderer: BandRenderer;
  constructor(src: RsiBand) {
    this._renderer = new BandRenderer(src);
  }
  zOrder() {
    return "bottom" as const;
  }
  renderer() {
    return this._renderer;
  }
}
class RsiBand {
  private _views: BandPaneView[];
  public visible = true;
  private _requestUpdate?: () => void;
  constructor(
    public series: ISeriesApi<"Line">,
    public lower: number,
    public upper: number,
    public color: string
  ) {
    this._views = [new BandPaneView(this)];
  }
  attached(p: { requestUpdate: () => void }) {
    this._requestUpdate = p.requestUpdate;
  }
  // Met à jour la bande (bornes / couleur / visibilité) et déclenche un redraw.
  apply(lower: number, upper: number, color: string, visible: boolean) {
    this.lower = lower;
    this.upper = upper;
    this.color = color;
    this.visible = visible;
    this._requestUpdate?.();
  }
  updateAllViews() {}
  paneViews() {
    return this._views;
  }
}

interface Props {
  candles: Candle[];
  dailyCandles: Candle[];
  currency: string | null;
  symbol: string;
  name?: string | null;
  interval: string;
  theme: "dark" | "light";
}

// Couleurs du graphique par thème (bougies + indicateurs inchangés ; seuls fond/texte/grille/bordures changent).
const CHART_THEME = {
  dark: { bg: "#0e1117", text: "#c9d1d9", grid: "#1b2027", border: "#30363d", sep: "#30363d", sepHover: "#3d444d" },
  light: { bg: "#ffffff", text: "#131722", grid: "#eaecef", border: "#e0e3eb", sep: "#e0e3eb", sepHover: "#c9cdd8" },
} as const;

interface PaneScale {
  auto: boolean; // A : auto-échelle
  log: boolean; // L : échelle logarithmique
}
interface PaneBox {
  top: number;
  height: number;
}

// Temps -> timestamp (secondes) attendu par lightweight-charts.
const toTime = (d: Time) => tsOf(d) as UTCTimestamp;

// Format volume : 38,82 M / 1,20 Md…
const fmtVol = (v: number) =>
  v >= 1e9 ? (v / 1e9).toFixed(2) + "Md" : v >= 1e6 ? (v / 1e6).toFixed(2) + "M" : v >= 1e3 ? (v / 1e3).toFixed(2) + "K" : String(Math.round(v));
const f2 = (v: number | null | undefined) => (v == null ? "—" : v.toFixed(2));

interface LegendRow {
  o: number; h: number; l: number; c: number; change: number; pct: number;
  sma: Record<string, number | null>; // valeur par id de SMA
  vol: number; volMa: number | null; rsi: number | null; rsiMa: number | null;
  atr: number | null;
  rs: number | null;
}

// Outil de mesure (Shift + clic). Points ancrés aux données (prix + position logique)
// pour suivre le pan/zoom. phase: "measuring" (suit le curseur) → "done" (figée).
interface DataPt { price: number; logical: number; }
interface Measure {
  phase: "measuring" | "done";
  p0: DataPt;
  p1: DataPt;
}

// Type d'un id d'instance. Les SMA ont un id commençant par "sma" (sma9/sma50/sma200/sma-<n>).
const typeOf = (id: string): IndType => (id === "volume" ? "volume" : id === "rsi" ? "rsi" : id === "atr" ? "atr" : id === "rs" ? "rs" : "sma");
// Sous-séries (clés seriesRef) contrôlées ensemble par une instance.
const seriesKeysOf = (id: string): string[] =>
  id === "volume" ? ["volume", "volumeMa"] : id === "rsi" ? ["rsi", "rsiMa"] : [id];

const LINE_STYLE_MAP: Record<LineStyleName, LineStyle> = {
  solid: LineStyle.Solid,
  dashed: LineStyle.Dashed,
  dotted: LineStyle.Dotted,
};

// Valeurs de la SMA alignées sur la timeline du graphique, selon la longueur + plage temporelle.
function smaValues(s: IndSettings, candles: Candle[], daily: Candle[]): Map<Time, number> {
  const length = s.length ?? 50;
  if (s.timeframe === "chart") {
    return new Map(sma(candles, length).map((p) => [p.time, p.value]));
  }
  const d = daily.length ? daily : candles;
  return alignDailyToCandles(sma(d, length), candles);
}

// RSI + sa moyenne mobile, alignés sur la timeline, selon longueur RSI / longueur MA / plage temporelle.
function rsiValues(s: IndSettings, candles: Candle[], daily: Candle[]): { rsiMap: Map<Time, number>; maMap: Map<Time, number> } {
  const length = s.length ?? 14;
  const maLen = s.maLength ?? 14;
  const daySrc = s.timeframe === "1d";
  const src = daySrc ? (daily.length ? daily : candles) : candles;
  const rsiPts = rsi(src, length);
  const maPts = smaOfPoints(rsiPts, maLen);
  if (daySrc) {
    return { rsiMap: alignDailyToCandles(rsiPts, candles), maMap: alignDailyToCandles(maPts, candles) };
  }
  return { rsiMap: new Map(rsiPts.map((p) => [p.time, p.value])), maMap: new Map(maPts.map((p) => [p.time, p.value])) };
}

// Icônes (Feather-style) pour les contrôles au survol.
const IcoEye = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const IcoEyeOff = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);
const IcoGear = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
const IcoTrash = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// Hauteurs de panneaux (stretch factors) persistées → conservées d'une session à l'autre.
const LS_STRETCH = "tvlike:pane-stretch";
const DEFAULT_STRETCH = [3, 1, 1, 1, 1]; // prix 60% ; volume, RSI, ATR, RS à 20% chacun
const loadStretch = (): number[] | null => {
  try {
    const r = localStorage.getItem(LS_STRETCH);
    if (r) return JSON.parse(r);
  } catch {
    /* ignore */
  }
  return null;
};

const N_PANES = 5; // principal, volume, RSI, ATR, RS (les deux derniers créés dynamiquement)
const RIGHT_OFFSET = 20; // marge future visible par défaut (barres)
const INITIAL_FUTURE = 120; // barres "whitespace" futures pré-générées au chargement
const EXTEND_CHUNK = 300; // barres futures ajoutées quand on approche du bord
const EXTEND_THRESHOLD = 60; // on étend quand il reste < N barres futures visibles à droite

export default function Chart({ candles, dailyCandles, currency, symbol, name, interval, theme }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const chartElRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<Record<string, ISeriesApi<any>>>({});
  const paneScalesRef = useRef<IPriceScaleApi[]>([]);
  // Hauteurs enregistrées, relues par l'ATR et le RS à leur création (créés après le graphique).
  const stretchRef = useRef<number[] | null>(null);
  // Décorations RSI : lignes de niveau (upper/middle/lower) + bande ombrée (primitive).
  const rsiLinesRef = useRef<{ upper: any; middle: any; lower: any } | null>(null);
  const rsiBandRef = useRef<RsiBand | null>(null);
  // Plage de prix manuelle par panneau (pour zoom vertical illimité via autoscaleInfoProvider).
  const manualRangeRef = useRef<Record<number, { min: number; max: number } | null>>({
    0: null,
    1: null,
    2: null,
    3: null, // ATR, ou RS quand l'ATR est éteint
    4: null, // RS quand l'ATR est allumé
  });
  // Données alignées par bougie pour la légende dynamique + index par temps.
  const legendRowsRef = useRef<LegendRow[]>([]);
  const timeIdxRef = useRef<Map<number, number>>(new Map());
  const [legend, setLegend] = useState<LegendRow | null>(null);
  // Outil de mesure (Shift + clic) : état + ref (pour les écouteurs natifs).
  const [meas, setMeas] = useState<Measure | null>(null);
  const measRef = useRef<Measure | null>(null);
  const applyMeas = useCallback((m: Measure | null) => {
    measRef.current = m;
    setMeas(m);
  }, []);
  // Force un re-render quand le graphique bouge, pour recalculer les pixels des overlays ancrés.
  const [, setTick] = useState(0);
  const tickPendingRef = useRef(false); // coalesce les setTick (1 par frame) + les diffère hors rendu
  // --- Indicateurs (#9) : SMA en liste dynamique, Volume/RSI en singletons présents ou non ---
  const cfg0 = useMemo(loadIndicators, []);
  const [smaOrder, setSmaOrder] = useState<string[]>(cfg0.smaOrder);
  const [activeVolume, setActiveVolume] = useState(cfg0.activeVolume);
  const [activeRsi, setActiveRsi] = useState(cfg0.activeRsi);
  const [activeAtr, setActiveAtr] = useState(cfg0.activeAtr);
  const [activeRs, setActiveRs] = useState(cfg0.activeRs);
  // RS (#56) : série de la référence et dividendes, chargés à part du symbole affiché.
  const [rsRefData, setRsRefData] = useState<{ ref: string; byDate: Map<string, number> } | null>(null);
  const [rsDivs, setRsDivs] = useState<{ sym: string; divs: DividendRow[] } | null>(null);
  const rsPaneRef = useRef<number>(-1); // index utilisé, lu dans les effets
  // Le rendu en dépend (position de la légende) : une ref ne redéclenche pas le rendu, il faut un état.
  const [rsPane, setRsPane] = useState(-1);
  // Incrémenté à chaque (re)création du chart → ré-attache l'ATR au nouveau chart.
  const [chartEpoch, setChartEpoch] = useState(0);
  const [favorites, setFavorites] = useState<IndType[]>(cfg0.favorites);
  const [settings, setSettings] = useState<Record<string, IndSettings>>(cfg0.settings);
  const [hidden, setHidden] = useState<Record<string, boolean>>({}); // œil (non persisté)
  // Provider d'auto-échelle (pane 0), stocké pour créer les SMA dynamiquement.
  const providerRef = useRef<((pane: number) => (orig: () => any) => any) | null>(null);
  // Compteur d'ids pour les nouvelles SMA (ne collisionne pas avec les ids persistés "sma-N").
  const smaIdCounterRef = useRef(
    Math.max(0, ...cfg0.smaOrder.map((id) => { const m = id.match(/^sma-(\d+)$/); return m ? Number(m[1]) : 0; })) + 1
  );
  // Cible du portail : le slot dans la barre d'outils (App) où s'affiche le bouton « Indicateurs ».
  const [toolbarSlot, setToolbarSlot] = useState<HTMLElement | null>(null);
  useEffect(() => { setToolbarSlot(document.getElementById("ind-toolbar-slot")); }, []);

  // Persistance de toute la config d'indicateurs (structure + réglages + favoris).
  useEffect(() => {
    saveIndicators({ smaOrder, activeVolume, activeRsi, activeAtr, activeRs, favorites, settings });
  }, [smaOrder, activeVolume, activeRsi, activeAtr, activeRs, favorites, settings]);

  const toggleIndicator = (id: string) => setHidden((h) => ({ ...h, [id]: !h[id] }));
  const removeIndicator = (id: string) => {
    if (typeOf(id) === "sma") {
      const chart = chartRef.current;
      const s = seriesRef.current[id];
      if (s && chart) {
        try { chart.removeSeries(s); } catch { /* déjà retirée */ }
        delete seriesRef.current[id];
      }
      setSmaOrder((o) => o.filter((x) => x !== id));
      setSettings((prev) => { const n = { ...prev }; delete n[id]; return n; });
    } else if (id === "volume") setActiveVolume(false);
    else if (id === "rsi") setActiveRsi(false);
    else if (id === "atr") setActiveAtr(false);
    else if (id === "rs") setActiveRs(false);
    setHidden((h) => { const n = { ...h }; delete n[id]; return n; });
  };
  const addIndicator = (type: IndType) => {
    if (type === "volume") { setActiveVolume(true); setHidden((h) => ({ ...h, volume: false })); return; }
    if (type === "rsi") { setActiveRsi(true); setHidden((h) => ({ ...h, rsi: false })); return; }
    if (type === "atr") { setActiveAtr(true); setHidden((h) => ({ ...h, atr: false })); return; }
    if (type === "rs") { setActiveRs(true); setHidden((h) => ({ ...h, rs: false })); return; }
    // Nouvelle SMA : couleur non encore utilisée, longueur 50 par défaut.
    const id = `sma-${smaIdCounterRef.current++}`;
    const used = new Set(smaOrder.map((x) => settings[x]?.color));
    const color = SMA_COLORS.find((c) => !used.has(c)) ?? SMA_COLORS[0];
    setSettings((prev) => ({ ...prev, [id]: smaDefault(50, color) }));
    setSmaOrder((o) => [...o, id]);
  };
  const toggleFavorite = (type: IndType) =>
    setFavorites((f) => (f.includes(type) ? f.filter((t) => t !== type) : [...f, type]));

  // Paramètres d'indicateurs (pop-up ⚙) : pop-up ouverte + snapshot pour Annuler.
  const [settingsOpenId, setSettingsOpenId] = useState<string | null>(null);
  const settingsSnapshotRef = useRef<IndSettings | null>(null);
  const openSettings = (id: string) => {
    if (!settings[id]) return;
    settingsSnapshotRef.current = settings[id];
    setSettingsOpenId(id);
  };
  const changeSettings = (s: IndSettings) => {
    if (settingsOpenId) setSettings((prev) => ({ ...prev, [settingsOpenId]: s }));
  };
  const cancelSettings = () => {
    const snap = settingsSnapshotRef.current;
    if (settingsOpenId && snap) setSettings((prev) => ({ ...prev, [settingsOpenId]: snap }));
    setSettingsOpenId(null);
  };
  const okSettings = () => setSettingsOpenId(null); // la persistance est gérée par l'effet ci-dessus
  // Buffer de données (bougies + barres futures) pour l'extension infinie du futur.
  const candleDataRef = useRef<any[]>([]);
  // Le chart n'est cadré (fit) qu'UNE fois, au tout premier chargement de données. Ensuite on garde
  // toujours le cadre (zoom/pan) de l'utilisateur — même au changement de symbole / intervalle / réglage.
  const hasFittedRef = useRef(false);
  const futureRef = useRef<{ t: number; i: number; pattern: number[] }>({
    t: 0,
    i: 0,
    pattern: [86400],
  });

  // État A/L par panneau (défaut : manuel + linéaire), persistant.
  const [paneState, setPaneState] = useState<PaneScale[]>(
    Array.from({ length: N_PANES }, () => ({ auto: false, log: false }))
  );
  const paneStateRef = useRef(paneState);
  paneStateRef.current = paneState;

  // Nouveau titre → échelles de prix en « Automatique » (le prix du nouveau titre reste visible),
  // MAIS on garde le cadre horizontal (zoom/position) : LWC conserve le bar spacing + l'ancrage
  // à droite, donc on retrouve le même scope sur le nouveau titre.
  useEffect(() => {
    setPaneState((prev) => prev.map((s) => ({ ...s, auto: true })));
  }, [symbol]);

  const [layout, setLayout] = useState<PaneBox[]>([]);
  const layoutRef = useRef<PaneBox[]>([]);
  layoutRef.current = layout;
  const [hovered, setHovered] = useState<number | null>(null);

  // Mesure la géométrie des panneaux pour positionner les boutons.
  const measure = useCallback(() => {
    const chart = chartRef.current;
    const wrap = wrapRef.current;
    const candle = seriesRef.current.candle;
    if (!chart || !wrap || !candle) return;

    const panes = chart.panes();
    const contH = wrap.clientHeight;
    const tsH = chart.timeScale().height();
    const heights = panes.map((p) => p.getHeight());
    const sum = heights.reduce((a, b) => a + b, 0);
    const sep = panes.length > 1 ? Math.max(0, (contH - tsH - sum) / (panes.length - 1)) : 0;

    const boxes: PaneBox[] = [];
    let top = 0;
    for (let i = 0; i < panes.length; i++) {
      boxes.push({ top, height: heights[i] });
      top += heights[i] + sep;
    }
    // Ne met à jour que si la géométrie a changé (appelable souvent sans surcoût).
    const prev = layoutRef.current;
    const same =
      prev.length === boxes.length &&
      prev.every((p, i) => p.top === boxes[i].top && p.height === boxes[i].height);
    if (!same) setLayout(boxes);
  }, []);

  // Création unique du graphique + des séries (panes).
  useEffect(() => {
    if (!chartElRef.current) return;

    const th = CHART_THEME[theme];
    const chart = createChart(chartElRef.current, {
      autoSize: true,
      layout: {
        background: { color: th.bg },
        textColor: th.text,
        attributionLogo: false, // retire le logo TradingView en bas à gauche
        panes: { separatorColor: th.sep, separatorHoverColor: th.sepHover },
      },
      grid: {
        vertLines: { color: th.grid },
        horzLines: { color: th.grid },
      },
      rightPriceScale: { borderColor: th.border },
      // Crosshair libre : le prix affiché suit le niveau du curseur (pas la donnée la plus proche).
      crosshair: { mode: CrosshairMode.Normal },
      timeScale: { borderColor: th.border, timeVisible: false, rightOffset: RIGHT_OFFSET },
      // Glisser sur un axe le met à l'échelle (drag vertical sur l'axe des prix = zoom vertical).
      handleScale: { axisPressedMouseMove: { time: true, price: true } },
    });
    chartRef.current = chart;
    // Nouveau chart → il devra être cadré à sa 1ère charge de données (robuste au StrictMode).
    hasFittedRef.current = false;

    // Pane 0 : bougies (les SMA sont créées dynamiquement, cf. effet données).
    const candleSeries = chart.addSeries(CandlestickSeries, {
      // Corps rempli à 30 % ; bordure + mèche à 100 %.
      upColor: "rgba(38, 166, 154, 0.3)",
      downColor: "rgba(239, 83, 80, 0.3)",
      borderVisible: true,
      borderUpColor: "#26a69a",
      borderDownColor: "#ef5350",
      wickUpColor: "#26a69a",
      wickDownColor: "#ef5350",
    });

    // Pane 1 : volume + sa moyenne mobile.
    const volumeSeries = chart.addSeries(
      HistogramSeries,
      { priceFormat: { type: "volume" }, priceLineVisible: false },
      1
    );
    const volumeMaSeries = chart.addSeries(
      LineSeries,
      { color: "#3f8cff", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      1
    );

    // Pane 2 : RSI + sa moyenne mobile.
    const rsiSeries = chart.addSeries(
      LineSeries,
      { color: "#7e57c2", lineWidth: 2, priceLineVisible: false },
      2
    );
    const rsiMaSeries = chart.addSeries(
      LineSeries,
      { color: "rgba(242, 201, 76, 0.65)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false },
      2
    );
    // Lignes de repère 70 / 50 / 30 (valeurs + couleurs pilotées par les réglages).
    const upperLine = rsiSeries.createPriceLine({ price: 70, color: "#787b86", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    const middleLine = rsiSeries.createPriceLine({ price: 50, color: "#8b949e", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    const lowerLine = rsiSeries.createPriceLine({ price: 30, color: "#787b86", lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: false });
    rsiLinesRef.current = { upper: upperLine, middle: middleLine, lower: lowerLine };
    // Bande ombrée (fond du RSI).
    const rsiBand = new RsiBand(rsiSeries, 30, 70, "rgba(126, 87, 194, 0.12)");
    rsiSeries.attachPrimitive(rsiBand as any);
    rsiBandRef.current = rsiBand;

    seriesRef.current = {
      candle: candleSeries,
      volume: volumeSeries,
      volumeMa: volumeMaSeries,
      rsi: rsiSeries,
      rsiMa: rsiMaSeries,
    };
    // autoscaleInfoProvider : si une plage manuelle est définie pour le panneau,
    // on l'impose (zoom vertical illimité) ; sinon comportement par défaut.
    const provider = (pane: number) => (orig: () => any) => {
      const r = manualRangeRef.current[pane];
      // Mode manuel/zoom : plage exacte (marges à 0 → pas de distorsion).
      if (r) return { priceRange: { minValue: r.min, maxValue: r.max } };
      // Mode auto : on ajoute un petit padding pour ne pas coller aux bords.
      const base = orig();
      if (base && base.priceRange) {
        const { minValue, maxValue } = base.priceRange;
        const pad = (maxValue - minValue) * 0.1 || 1;
        return { priceRange: { minValue: minValue - pad, maxValue: maxValue + pad } };
      }
      return base;
    };
    providerRef.current = provider; // pour créer les SMA dynamiquement avec la bonne échelle
    setChartEpoch((e) => e + 1); // signale un nouveau chart → ré-attache l'ATR
    candleSeries.applyOptions({ autoscaleInfoProvider: provider(0) });
    volumeSeries.applyOptions({ autoscaleInfoProvider: provider(1) });
    volumeMaSeries.applyOptions({ autoscaleInfoProvider: provider(1) });
    rsiSeries.applyOptions({ autoscaleInfoProvider: provider(2) });
    rsiMaSeries.applyOptions({ autoscaleInfoProvider: provider(2) });
    // Marges à 0 : la plage du provider correspond exactement à la vue → zoom exact.
    candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
    volumeSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
    rsiSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });

    // Une échelle de prix (droite) par panneau, dans l'ordre des panneaux.
    paneScalesRef.current = [
      candleSeries.priceScale(),
      volumeSeries.priceScale(),
      rsiSeries.priceScale(),
    ];

    // Hauteurs de panes : restaurées depuis localStorage (sinon 60% / 20% / 20%).
    const panes = chart.panes();
    const saved = loadStretch();
    stretchRef.current = saved;
    // On applique panneau par panneau. L'ancienne version exigeait `saved.length === panes.length`
    // et jetait TOUT sinon — or à cet instant seuls 3 panneaux existent, l'ATR et le RS étant
    // créés plus tard : dès qu'ils étaient actifs, les hauteurs enregistrées étaient perdues.
    panes.forEach((p, i) => p.setStretchFactor(saved?.[i] ?? DEFAULT_STRETCH[i] ?? 1));

    // Sauvegarde (debouncée) des hauteurs après un redimensionnement de panneau.
    let saveTimer: ReturnType<typeof setTimeout> | undefined;
    const saveStretch = () => {
      const c = chartRef.current;
      if (!c) return;
      const facs = c.panes().map((p) => p.getStretchFactor());
      if (!facs.length) return;
      // FUSION, jamais remplacement. Le ResizeObserver se declenche pendant la mise en
      // place de la page, souvent AVANT que l'ATR et le RS n'existent : un remplacement
      // enregistrait alors 3 hauteurs et effacait les 5 precedentes. Au rechargement
      // suivant, les panneaux dynamiques n'avaient plus rien et reprenaient celle du volume.
      const fusion = [...(stretchRef.current ?? [])];
      facs.forEach((f, i) => { fusion[i] = f; });
      stretchRef.current = fusion;
      try {
        localStorage.setItem(LS_STRETCH, JSON.stringify(fusion));
      } catch {
        /* ignore */
      }
    };
    const saveStretchDebounced = () => {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(saveStretch, 300);
    };

    // measure() ne re-render que si la géométrie change → on peut observer large.
    const ro = new ResizeObserver(() => {
      measure();
      saveStretchDebounced();
    });
    if (wrapRef.current) ro.observe(wrapRef.current);
    // Observe aussi chaque ligne de panneau : le drag d'un séparateur change leur
    // hauteur → measure() → la légende (et les boutons A/L) suivent.
    requestAnimationFrame(() => {
      chartElRef.current?.querySelectorAll("table tr").forEach((r) => ro.observe(r));
      measure();
    });

    // Extension "infinie" du futur : quand on scrolle près du bord droit,
    // on rallonge le buffer de barres futures (grille qui continue au même rythme).
    const onRangeChange = (range: { from: number; to: number } | null) => {
      if (!range) return;
      // Recalcule les overlays ancrés (mesure #27 + dessins #4) → ils suivent le pan/zoom.
      // Différé en rAF : la lecture de coordonnées pendant le rendu de DrawingLayer peut déclencher
      // cette callback → on évite un setState pendant le rendu (warning React), en coalesçant par frame.
      if (!tickPendingRef.current) {
        tickPendingRef.current = true;
        requestAnimationFrame(() => { tickPendingRef.current = false; setTick((t) => t + 1); });
      }
      const data = candleDataRef.current;
      const candle = seriesRef.current.candle;
      if (!candle || data.length === 0) return;
      if (range.to > data.length - EXTEND_THRESHOLD) {
        const fs = futureRef.current;
        for (let k = 0; k < EXTEND_CHUNK; k++) {
          fs.t += fs.pattern[fs.i % fs.pattern.length];
          fs.i++;
          data.push({ time: fs.t as UTCTimestamp });
        }
        candle.setData(data);
      }
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(onRangeChange);

    // Zoom vertical à la molette SUR la colonne des prix (façon TradingView),
    // ou avec ⌘ (Mac) / Ctrl (Windows) depuis n'importe où.
    const onWheel = (e: WheelEvent) => {
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const boxes = layoutRef.current;
      let idx = -1;
      for (let i = 0; i < boxes.length; i++) {
        if (y >= boxes[i].top && y <= boxes[i].top + boxes[i].height) {
          idx = i;
          break;
        }
      }
      if (idx < 0) return;
      const ps = paneScalesRef.current[idx];
      // Les panneaux 0-2 sont fixes ; l'ATR et le RS sont créés dynamiquement et
      // n'étaient pas dans ce tableau — d'où l'absence de zoom vertical sur eux.
      const sr = seriesRef.current;
      const series =
        idx === 0 ? sr.candle
        : idx === 1 ? sr.volume
        : idx === 2 ? sr.rsi
        : idx === rsPaneRef.current ? sr.rs
        : sr.atr;
      if (!ps || !series) return;

      // Zoom vertical UNIQUEMENT sur la colonne des prix ; ailleurs → zoom horizontal (temps) natif.
      const overPriceAxis = x >= rect.width - ps.width() - 2;
      if (!overPriceAxis) return;
      e.preventDefault();
      e.stopPropagation();

      // Plage de prix courante du panneau + prix sous le curseur (ancrage).
      const yInPane = y - boxes[idx].top;
      const maxP = series.coordinateToPrice(0);
      const minP = series.coordinateToPrice(boxes[idx].height);
      const curP = series.coordinateToPrice(yInPane);
      if (maxP == null || minP == null || curP == null || maxP <= minP) return;

      // molette haut = zoom avant : la plage se resserre autour du curseur (illimité).
      const factor = e.deltaY < 0 ? 0.955 : 1.047;
      const newMin = curP - (curP - minP) * factor;
      const newMax = curP + (maxP - curP) * factor;
      if (newMax - newMin < 1e-9) return;
      manualRangeRef.current[idx] = { min: newMin, max: newMax };

      // Le zoom vertical coupe le mode A (auto) du panneau s'il était actif.
      if (paneStateRef.current[idx]?.auto) {
        setPaneState((prev) => prev.map((s, i) => (i === idx ? { ...s, auto: false } : s)));
      }
      // On applique la plage via le provider (autoScale ON un instant) puis on fige.
      try {
        ps.applyOptions({ autoScale: true });
        requestAnimationFrame(() => {
          try {
            ps.applyOptions({ autoScale: false });
            setTick((t) => t + 1); // les dessins #4 suivent le zoom vertical
          } catch {
            /* chart détruit — ignoré */
          }
        });
      } catch {
        /* échelle pas prête — ignoré */
      }
    };
    const wheelEl = wrapRef.current;
    wheelEl?.addEventListener("wheel", onWheel, { passive: false, capture: true });

    // Outil de mesure : Shift + clic démarre ; clic fige ; clic ferme (façon TradingView).
    // Point (prix + position logique) sous le curseur, borné au panneau des prix.
    const ptAt = (x: number, y: number): DataPt | null => {
      const p0 = layoutRef.current[0];
      const s = seriesRef.current.candle;
      const chart = chartRef.current;
      if (!p0 || !s || !chart) return null;
      const yInPane = Math.max(0, Math.min(y - p0.top, p0.height));
      const price = s.coordinateToPrice(yInPane);
      const logical = chart.timeScale().coordinateToLogical(x);
      if (price == null || logical == null) return null;
      return { price, logical };
    };
    const onMeasureDown = (e: MouseEvent) => {
      const cur = measRef.current;
      // Mesure active : ce clic la fige (measuring→done) ou la ferme (done→null).
      if (cur) {
        if (cur.phase === "measuring") {
          e.preventDefault();
          e.stopPropagation();
          applyMeas({ ...cur, phase: "done" });
        } else {
          applyMeas(null); // clic de fermeture (laisse le graphique gérer un éventuel pan)
        }
        return;
      }
      // Sinon : démarrage uniquement sur Shift + clic dans le panneau des prix.
      if (!e.shiftKey) return;
      const wrap = wrapRef.current;
      if (!wrap) return;
      // Pas de mesure si un outil de dessin est actif, ou si un dessin vient d'être finalisé
      // (le dernier clic d'un tracé au Shift ne doit pas enchaîner sur une mesure).
      if (wrap.dataset.drawTool === "1") return;
      if (Date.now() - Number(wrap.dataset.drawTs || 0) < 500) return;
      const rect = wrap.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const p0 = layoutRef.current[0];
      if (!p0 || y < p0.top || y > p0.top + p0.height) return; // hors panneau des prix
      const pt = ptAt(x, y);
      if (!pt) return;
      e.preventDefault(); // pas de pan ni de sélection de texte
      e.stopPropagation();
      applyMeas({ phase: "measuring", p0: pt, p1: pt });
    };
    const onMeasureMove = (e: MouseEvent) => {
      const cur = measRef.current;
      const wrap = wrapRef.current;
      if (!cur || cur.phase !== "measuring" || !wrap) return;
      const rect = wrap.getBoundingClientRect();
      const pt = ptAt(e.clientX - rect.left, e.clientY - rect.top);
      if (!pt) return;
      applyMeas({ ...cur, p1: pt });
    };
    wheelEl?.addEventListener("mousedown", onMeasureDown, { capture: true });
    window.addEventListener("mousemove", onMeasureMove);

    // Légende dynamique : valeurs à la bougie survolée (sinon dernière bougie).
    const onCrosshair = (param: { time?: unknown }) => {
      const rows = legendRowsRef.current;
      if (rows.length === 0) return;
      let idx = rows.length - 1;
      if (param.time != null) {
        const found = timeIdxRef.current.get(param.time as number);
        if (found != null) idx = found;
      }
      setLegend(rows[idx]);
    };
    chart.subscribeCrosshairMove(onCrosshair);

    return () => {
      chart.unsubscribeCrosshairMove(onCrosshair);
      wheelEl?.removeEventListener("wheel", onWheel, { capture: true } as any);
      wheelEl?.removeEventListener("mousedown", onMeasureDown, { capture: true } as any);
      window.removeEventListener("mousemove", onMeasureMove);
      chart.timeScale().unsubscribeVisibleLogicalRangeChange(onRangeChange);
      clearTimeout(saveTimer);
      ro.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = {};
      paneScalesRef.current = [];
    };
  }, [measure, applyMeas]);

  // Applique l'état A/L de chaque panneau à son échelle de prix.
  useEffect(() => {
    paneState.forEach((st, i) => {
      const ps = paneScalesRef.current[i];
      if (!ps) return;
      if (st.auto) manualRangeRef.current[i] = null; // A activé → retour à l'auto-fit
      try {
        ps.applyOptions({
          autoScale: st.auto,
          mode: st.log ? PriceScaleMode.Logarithmic : PriceScaleMode.Normal,
        });
      } catch {
        // échelle pas encore prête (transient au montage) — ignoré
      }
    });
  }, [paneState]);

  // Couleurs du graphique selon le thème (fond / texte / grille / bordures / séparateurs).
  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const th = CHART_THEME[theme];
    try {
      chart.applyOptions({
        layout: { background: { color: th.bg }, textColor: th.text, panes: { separatorColor: th.sep, separatorHoverColor: th.sepHover } },
        grid: { vertLines: { color: th.grid }, horzLines: { color: th.grid } },
        rightPriceScale: { borderColor: th.border },
        timeScale: { borderColor: th.border },
      });
    } catch {
      /* chart pas prêt */
    }
  }, [theme]);

  // Signature des réglages qui affectent les DONNÉES (recalcul) : SMA (ordre + longueur/plage) + volume + rsi.
  const v = settings.volume;
  const r = settings.rsi;
  const dataSig =
    smaOrder.map((id) => `${id}:${settings[id]?.length}:${settings[id]?.timeframe}`).join("|") +
    `|vol:${v?.maLength}:${v?.upColor}:${v?.upOpacity}:${v?.downColor}:${v?.downOpacity}` +
    `|rsi:${r?.length}:${r?.maLength}:${r?.timeframe}` +
    `|atr:${settings.atr?.length}`;

  // Style des lignes (couleur/opacité/épaisseur/style) — applyOptions léger, sans recalcul.
  useEffect(() => {
    const applyLine = (key: string, color?: string, opacity?: number, width?: number, style?: LineStyleName) => {
      try {
        seriesRef.current[key]?.applyOptions({
          color: rgba(color ?? "#3f8cff", opacity),
          lineWidth: (width ?? 1) as 1 | 2 | 3 | 4,
          lineStyle: LINE_STYLE_MAP[style ?? "solid"],
        });
      } catch {
        /* série pas prête */
      }
    };
    smaOrder.forEach((id) => {
      const st = settings[id];
      if (st) applyLine(id, st.color, st.opacity, st.lineWidth, st.lineStyle);
    });
    const vol = settings.volume;
    vol && applyLine("volumeMa", vol.maColor, vol.maOpacity, vol.maWidth, vol.maStyle);
    const rs = settings.rsi;
    rs && applyLine("rsi", rs.color, rs.opacity, rs.lineWidth, rs.lineStyle);
    rs && applyLine("rsiMa", rs.maColor, rs.maOpacity, rs.maWidth, rs.maStyle);
    const at = settings.atr;
    at && applyLine("atr", at.color, at.opacity, at.lineWidth, at.lineStyle);
  }, [settings, smaOrder]);

  // Une sous-série est-elle activée dans les réglages Style (case à cocher d'un élément) ?
  const elementOn = (id: string, key: string): boolean => {
    const st = settings[id];
    if (!st) return true;
    if (id === "volume") return key === "volume" ? st.volOn !== false : st.maOn !== false;
    if (id === "rsi") return key === "rsi" ? st.rsiOn !== false : st.maOn !== false;
    return true;
  };

  // Décorations RSI (lignes de niveau + bande ombrée) — pilotées par les réglages Style + visibilité globale.
  useEffect(() => {
    const rs = settings.rsi;
    const lines = rsiLinesRef.current;
    const band = rsiBandRef.current;
    if (!rs) return;
    const base = activeRsi && visibleForInterval(interval, rs.visibility) && !hidden.rsi;
    const applyPl = (pl: any, on?: boolean, color?: string, opacity?: number, value?: number) => {
      try {
        pl?.applyOptions({ price: value, color: rgba(color ?? "#787b86", opacity), lineVisible: (on !== false) && base });
      } catch {
        /* ligne retirée avec la série */
      }
    };
    if (lines) {
      applyPl(lines.upper, rs.upperOn, rs.upperColor, rs.upperOpacity, rs.upperValue ?? 70);
      applyPl(lines.middle, rs.middleOn, rs.middleColor, rs.middleOpacity, rs.middleValue ?? 50);
      applyPl(lines.lower, rs.lowerOn, rs.lowerColor, rs.lowerOpacity, rs.lowerValue ?? 30);
    }
    if (band) {
      band.apply(rs.lowerValue ?? 30, rs.upperValue ?? 70, rgba(rs.bgColor ?? "#7e57c2", rs.bgOpacity), (rs.bgOn !== false) && base);
    }
  }, [settings, interval, hidden.rsi, activeRsi]);

  // Visibilité de chaque série = actif ET autorisé par l'intervalle ET non masqué (œil) ET élément activé.
  useEffect(() => {
    const activeIds = [...smaOrder, ...(activeVolume ? ["volume"] : []), ...(activeRsi ? ["rsi"] : []), ...(activeAtr ? ["atr"] : []), ...(activeRs ? ["rs"] : [])];
    activeIds.forEach((id) => {
      const st = settings[id];
      const allowed = st ? visibleForInterval(interval, st.visibility) : true;
      const base = allowed && !hidden[id];
      seriesKeysOf(id).forEach((k) => {
        try {
          seriesRef.current[k]?.applyOptions({ visible: base && elementOn(id, k) });
        } catch {
          /* série pas prête */
        }
      });
    });
    // Volume / RSI retirés → on masque leurs séries (conservées pour garder les panneaux).
    if (!activeVolume) seriesKeysOf("volume").forEach((k) => { try { seriesRef.current[k]?.applyOptions({ visible: false }); } catch { /* */ } });
    if (!activeRsi) seriesKeysOf("rsi").forEach((k) => { try { seriesRef.current[k]?.applyOptions({ visible: false }); } catch { /* */ } });
  }, [settings, interval, hidden, smaOrder, activeVolume, activeRsi, activeAtr]);

  // RS (#56) : charge la série de la référence + les dividendes des deux côtés.
  // Fait à part du symbole affiché : une seule requête tant que la référence ne change pas.
  useEffect(() => {
    if (!activeRs) return;
    const st = settings.rs;
    const ref = (st?.rsRef || "XIU.TO").toUpperCase();
    let annule = false;
    (async () => {
      try {
        const r = await fetchCandlesApi(ref, interval);
        if (annule) return;
        const divs = st?.rsAdjusted !== false ? await fetchDividends(ref) : [];
        if (annule) return;
        const closes = st?.rsAdjusted !== false ? adjustedCloses(r.candles, divs) : r.candles.map((c) => c.close);
        const byDate = new Map<string, number>();
        r.candles.forEach((c, i) => byDate.set(String(c.time), closes[i]));
        setRsRefData({ ref, byDate });
      } catch {
        if (!annule) setRsRefData({ ref, byDate: new Map() }); // référence indisponible → panneau vide
      }
    })();
    return () => { annule = true; };
  }, [activeRs, settings.rs?.rsRef, settings.rs?.rsAdjusted, interval]);

  // Dividendes du titre affiché (pour ajuster son propre cours).
  useEffect(() => {
    if (!activeRs || settings.rs?.rsAdjusted === false) { setRsDivs(null); return; }
    let annule = false;
    fetchDividends(symbol).then((divs) => { if (!annule) setRsDivs({ sym: symbol, divs }); });
    return () => { annule = true; };
  }, [activeRs, symbol, settings.rs?.rsAdjusted]);

  // Points du RS : recalculés dès que le titre, la référence ou les réglages changent.
  const rsPoints = useMemo(() => {
    if (!activeRs || !rsRefData || candles.length === 0) return [];
    const st = settings.rs;
    const ajuste = st?.rsAdjusted !== false;
    const divs = ajuste && rsDivs?.sym === symbol ? rsDivs.divs : [];
    const closes = ajuste ? adjustedCloses(candles, divs) : candles.map((c) => c.close);
    // 52 BARRES DE L'INTERVALLE AFFICHÉ — comme l'indicateur d'origine de stageanalysis
    // (`ta.sma(ratio, 52)`), et non 52 semaines converties. Sur un graphique journalier
    // cela fait donc ~10 semaines, pas un an : c'est ce que montre TradingView.
    const per = Math.max(2, st?.length ?? 52);
    return mansfieldRS(candles, closes, rsRefData.byDate, per);
  }, [activeRs, rsRefData, rsDivs, candles, symbol, interval, settings.rs?.length, settings.rs?.rsAdjusted]);

  // ATR : panneau créé dynamiquement à l'activation (en bas, hauteur type volume),
  // retiré à la désactivation (pas de panneau vide, contrairement à Volume/RSI).
  useEffect(() => {
    const chart = chartRef.current;
    const s = seriesRef.current;
    if (!chart) return;
    if (activeAtr && !s.atr) {
      const st = settings.atr;
      const atrSeries = chart.addSeries(
        LineSeries,
        {
          color: rgba(st?.color ?? "#ef5350", st?.opacity),
          lineWidth: (st?.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          lineStyle: LINE_STYLE_MAP[st?.lineStyle ?? "solid"],
          priceLineVisible: false,
        },
        3
      );
      const prov = providerRef.current;
      if (prov) atrSeries.applyOptions({ autoscaleInfoProvider: prov(3) });
      atrSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
      s.atr = atrSeries;
      paneScalesRef.current[3] = atrSeries.priceScale();
      const panes = chart.panes();
      // Hauteur enregistrée de CE panneau si elle existe, sinon celle du volume.
      if (panes[3]) panes[3].setStretchFactor(stretchRef.current?.[3] ?? panes[1]?.getStretchFactor() ?? 1);
      atrSeries.setData(atr(candles, st?.length ?? 14).map((p) => ({ time: toTime(p.time), value: p.value })));
      requestAnimationFrame(() => measure());
    } else if (!activeAtr && s.atr) {
      try { chart.removeSeries(s.atr); } catch { /* déjà retirée */ }
      delete s.atr;
      paneScalesRef.current = paneScalesRef.current.slice(0, 3);
      requestAnimationFrame(() => measure());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAtr, chartEpoch]);

  // RS : panneau créé dynamiquement. L'index n'est PAS figé à 4 — si l'ATR est éteint,
  // il n'y a pas de panneau 3, et demander le 4 en créerait un vide au milieu.
  useEffect(() => {
    const chart = chartRef.current;
    const sr = seriesRef.current;
    if (!chart) return;
    // Index déterministe : 0 prix, 1 volume, 2 RSI existent toujours (même éteints),
    // 3 = ATR quand il est actif. Le RS prend donc le 4, ou le 3 sans ATR.
    // Ne PAS utiliser `panes().length` : il compte le panneau du RS lui-même, et la
    // garde de recréation ci-dessous se déclencherait en boucle.
    // Cet effet doit rester APRÈS celui de l'ATR : Lightweight Charts ne crée qu'un
    // panneau à la fois, demander le 4 avant que le 3 existe le rabattrait sur le 3.
    const attendu = activeAtr ? 4 : 3;
    // Si l'ATR s'allume ou s'éteint pendant que le RS est affiché, il faut le recréer ailleurs.
    if (sr.rs && rsPaneRef.current !== attendu) {
      try { chart.removeSeries(sr.rs); } catch { /* déjà retirée */ }
      delete sr.rs;
      rsPaneRef.current = -1;
      setRsPane(-1);
    }
    if (activeRs && !sr.rs) {
      const st = settings.rs;
      const idx = attendu;
      const rsSeries = chart.addSeries(
        LineSeries,
        {
          color: rgba(st?.color ?? "#26a69a", st?.opacity),
          lineWidth: (st?.lineWidth ?? 2) as 1 | 2 | 3 | 4,
          lineStyle: LINE_STYLE_MAP[st?.lineStyle ?? "solid"],
          priceLineVisible: false,
        },
        idx
      );
      const prov = providerRef.current;
      if (prov) rsSeries.applyOptions({ autoscaleInfoProvider: prov(idx) });
      rsSeries.priceScale().applyOptions({ scaleMargins: { top: 0, bottom: 0 } });
      // Ligne ZÉRO : le repère qui donne tout son sens au Mansfield.
      if (st?.zeroOn !== false) {
        rsSeries.createPriceLine({
          price: 0, color: st?.zeroColor ?? "#8b949e", lineWidth: 1,
          lineStyle: LineStyle.Dashed, axisLabelVisible: false,
        });
      }
      sr.rs = rsSeries;
      rsPaneRef.current = idx;
      setRsPane(idx);
      paneScalesRef.current[idx] = rsSeries.priceScale();
      const panes = chart.panes();
      if (panes[idx]) panes[idx].setStretchFactor(stretchRef.current?.[idx] ?? panes[1]?.getStretchFactor() ?? 1);
      requestAnimationFrame(() => measure());
    } else if (!activeRs && sr.rs) {
      try { chart.removeSeries(sr.rs); } catch { /* déjà retirée */ }
      delete sr.rs;
      if (rsPaneRef.current >= 0) paneScalesRef.current = paneScalesRef.current.slice(0, rsPaneRef.current);
      rsPaneRef.current = -1;
      setRsPane(-1);
      requestAnimationFrame(() => measure());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRs, activeAtr, chartEpoch]);

  // Alimente la série du RS.
  useEffect(() => {
    const sr = seriesRef.current;
    if (!sr.rs) return;
    sr.rs.setData(rsPoints.map((p) => ({ time: toTime(p.time), value: p.value })));
  }, [rsPoints]);


  // Mise à jour des données quand les bougies changent.
  useEffect(() => {
    const s = seriesRef.current;
    if (!s.candle || candles.length === 0) return;

    // Intraday (time numérique) → afficher l'heure sur l'axe des temps.
    const intraday = typeof candles[0].time === "number";
    chartRef.current?.timeScale().applyOptions({ timeVisible: intraday, secondsVisible: false });

    const candleData: any[] = candles.map((c) => ({
      time: toTime(c.time),
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
    }));
    // Barres "whitespace" futures (points de temps sans valeur) → la grille
    // verticale se dessine dans le futur, au-delà de la dernière bougie.
    if (candles.length >= 3) {
      const times = candles.map((c) => tsOf(c.time));
      // Reproduit la cadence réelle des dernières barres (jours ouvrés / semaines /
      // mois selon l'intervalle) pour que la grille future garde le même rythme.
      const pattern: number[] = [];
      for (let i = Math.max(1, times.length - 6); i < times.length; i++) {
        const d = times[i] - times[i - 1];
        if (d > 0) pattern.push(d);
      }
      if (pattern.length === 0) pattern.push(86400);
      const fs = { t: times[times.length - 1], i: 0, pattern };
      for (let k = 0; k < INITIAL_FUTURE; k++) {
        fs.t += fs.pattern[fs.i % fs.pattern.length];
        fs.i++;
        candleData.push({ time: fs.t as UTCTimestamp });
      }
      futureRef.current = fs; // pour étendre le futur au scroll
    }
    candleDataRef.current = candleData;
    s.candle.setData(candleData);

    // --- SMA dynamiques : synchronise les séries (pane 0) avec smaOrder, puis calcule/pose les données ---
    const chart = chartRef.current;
    const FIXED = new Set(["candle", "volume", "volumeMa", "rsi", "rsiMa", "atr", "rs"]);
    // Retire les SMA qui ne sont plus dans l'ordre.
    Object.keys(s).forEach((k) => {
      if (!FIXED.has(k) && !smaOrder.includes(k)) {
        try { chart?.removeSeries(s[k]); } catch { /* déjà retirée */ }
        delete s[k];
      }
    });
    // Crée les SMA manquantes.
    for (const id of smaOrder) {
      if (!s[id] && chart) {
        const st = settings[id];
        const line = chart.addSeries(
          LineSeries,
          {
            color: rgba(st?.color ?? "#3f8cff", st?.opacity),
            lineWidth: (st?.lineWidth ?? 1) as 1 | 2 | 3 | 4,
            lineStyle: LINE_STYLE_MAP[st?.lineStyle ?? "solid"],
            priceLineVisible: false,
            lastValueVisible: false,
          },
          0
        );
        const prov = providerRef.current;
        if (prov) line.applyOptions({ autoscaleInfoProvider: prov(0) });
        s[id] = line;
      }
    }
    // Valeurs de chaque SMA (longueur + plage temporelle depuis les réglages).
    const smaMaps: Record<string, Map<Time, number>> = {};
    for (const id of smaOrder) {
      const map = smaValues(settings[id] ?? smaDefault(50, "#3f8cff"), candles, dailyCandles);
      smaMaps[id] = map;
      s[id]?.setData([...map].map(([t, val]) => ({ time: toTime(t), value: val })));
    }

    // RSI + sa MA : longueur / longueur MA / plage temporelle depuis les réglages.
    const { rsiMap, maMap: rsiMaMap } = rsiValues(settings.rsi, candles, dailyCandles);
    // ATR : lissage de Wilder du True Range sur l'intervalle affiché.
    const atrMap = new Map(atr(candles, settings.atr?.length ?? 14).map((p) => [p.time, p.value]));
    const rsByTime = new Map(rsPoints.map((p) => [p.time, p.value]));
    // Volume MA : moyenne mobile du volume (longueur réglable).
    const vol = settings.volume;
    const volMaPts = smaOfPoints(candles.map((c) => ({ time: c.time, value: c.volume })), vol.maLength ?? 20);
    const mVolMa = new Map(volMaPts.map((p) => [p.time, p.value]));

    s.volume?.setData(
      candles.map((c) => ({
        time: toTime(c.time),
        value: c.volume,
        color: c.close >= c.open ? rgba(vol.upColor ?? "#26a69a", vol.upOpacity) : rgba(vol.downColor ?? "#ef5350", vol.downOpacity),
      }))
    );
    s.volumeMa?.setData(volMaPts.map((p) => ({ time: toTime(p.time), value: p.value })));
    s.rsi?.setData([...rsiMap].map(([t, v]) => ({ time: toTime(t), value: v })));
    s.rsiMa?.setData([...rsiMaMap].map(([t, v]) => ({ time: toTime(t), value: v })));
    s.atr?.setData([...atrMap].map(([t, v]) => ({ time: toTime(t), value: v })));

    // Lignes pour la légende dynamique.
    const rows: LegendRow[] = candles.map((c, i) => {
      const prevC = i > 0 ? candles[i - 1].close : c.close;
      const sma: Record<string, number | null> = {};
      for (const id of smaOrder) sma[id] = smaMaps[id].get(c.time) ?? null;
      return {
        o: c.open, h: c.high, l: c.low, c: c.close,
        change: c.close - prevC, pct: prevC ? ((c.close - prevC) / prevC) * 100 : 0,
        sma,
        vol: c.volume, volMa: mVolMa.get(c.time) ?? null,
        rsi: rsiMap.get(c.time) ?? null, rsiMa: rsiMaMap.get(c.time) ?? null,
        atr: atrMap.get(c.time) ?? null,
        rs: rsByTime.get(c.time) ?? null,
      };
    });
    legendRowsRef.current = rows;
    timeIdxRef.current = new Map(candles.map((c, i) => [toTime(c.time) as number, i]));
    setLegend(rows[rows.length - 1] ?? null);

    if (hasFittedRef.current) {
      // Déjà cadré une fois → on garde le cadre de l'utilisateur (changement de symbole/intervalle/réglage).
      requestAnimationFrame(() => measure());
      return;
    }
    hasFittedRef.current = true;

    // Premier chargement seulement : cadre tout l'historique + un espace futur (RIGHT_OFFSET).
    chartRef.current
      ?.timeScale()
      .setVisibleLogicalRange({ from: 0, to: candles.length - 1 + RIGHT_OFFSET });

    // Recalage vertical unique pour les panneaux en mode manuel (A off) :
    // on active l'auto le temps d'un rendu pour cadrer le nouveau symbole, puis on refige.
    requestAnimationFrame(() => {
      paneScalesRef.current.forEach((ps, i) => {
        if (!ps || paneStateRef.current[i]?.auto) return;
        try {
          ps.applyOptions({ autoScale: true });
        } catch {
          return; // échelle pas encore prête — ignoré
        }
        requestAnimationFrame(() => {
          try {
            if (!paneStateRef.current[i]?.auto) ps.applyOptions({ autoScale: false });
          } catch {
            // chart détruit entre-temps (StrictMode) — ignoré
          }
        });
      });
      measure();
    });
    // Dépendance sur la longueur/plage des SMA : recalcule les données quand elles changent
    // (la couleur/épaisseur/visibilité passent par des effets légers, sans recalcul).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candles, dailyCandles, measure, dataSig, rsPoints]);

  const toggleAuto = (i: number) =>
    setPaneState((prev) => prev.map((s, idx) => (idx === i ? { ...s, auto: !s.auto } : s)));
  const toggleLog = (i: number) =>
    setPaneState((prev) => prev.map((s, idx) => (idx === i ? { ...s, log: !s.log } : s)));

  // Détecte le panneau dont le coin bas-droite est survolé.
  const onMove = (e: React.MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let idx: number | null = null;
    if (x > rect.width - 140) {
      for (let i = 0; i < layout.length; i++) {
        if (y >= layout[i].top && y <= layout[i].top + layout[i].height) {
          idx = i;
          break;
        }
      }
    }
    setHovered((prev) => (prev === idx ? prev : idx));
  };

  // Pixels de la mesure, recalculés à chaque rendu depuis les points ancrés (suit le pan/zoom).
  const ptToXY = (pt: DataPt) => {
    const chart = chartRef.current;
    const s = seriesRef.current.candle;
    const p0 = layout[0];
    if (!chart || !s || !p0) return null;
    const x = chart.timeScale().logicalToCoordinate(pt.logical as any);
    const y = s.priceToCoordinate(pt.price);
    if (x == null || y == null) return null;
    return { x, y: y + p0.top };
  };
  // Date/heure de l'extrémité de la mesure (bougie la plus proche du logical), détail selon l'intervalle.
  const logicalToTimeStr = (logical: number): string => {
    if (candles.length === 0) return "";
    const idx = Math.max(0, Math.min(candles.length - 1, Math.round(logical)));
    return fmtTimeByInterval(candles[idx].time, interval, "letter");
  };
  let measRender: {
    left: number; top: number; width: number; height: number;
    labelX: number; labelTop: number;
    ax: number; bx: number; tBottom: number; t0Str: string; t1Str: string;
    up: boolean; priceChange: number; pct: number; bars: number;
  } | null = null;
  if (meas) {
    const a = ptToXY(meas.p0);
    const b = ptToXY(meas.p1);
    if (a && b) {
      const priceChange = meas.p1.price - meas.p0.price;
      const pct = meas.p0.price ? (priceChange / meas.p0.price) * 100 : 0;
      const bars = Math.round(Math.abs(meas.p1.logical - meas.p0.logical));
      const up = priceChange >= 0;
      measRender = {
        left: Math.min(a.x, b.x), top: Math.min(a.y, b.y),
        width: Math.abs(b.x - a.x), height: Math.abs(b.y - a.y),
        labelX: (a.x + b.x) / 2, labelTop: Math.min(a.y, b.y), // toujours au-dessus du carré (dates en bas)
        ax: a.x, bx: b.x, tBottom: Math.max(a.y, b.y),
        t0Str: logicalToTimeStr(meas.p0.logical), t1Str: logicalToTimeStr(meas.p1.logical),
        up, priceChange, pct, bars,
      };
    }
  }

  // Ligne d'indicateur avec contrôles au survol (œil / paramètres / corbeille).
  const indRow = (id: string, color: string, content: React.ReactNode) => {
    const isHidden = !!hidden[id];
    return (
      <div key={id} className={`ind-row${isHidden ? " ind-hidden" : ""}`}>
        <span className="ind-label" style={{ color }}>{content}</span>
        <span className="ind-btns">
          <button className="ind-btn" title={isHidden ? "Afficher" : "Masquer"} onClick={() => toggleIndicator(id)}>
            {isHidden ? IcoEyeOff : IcoEye}
          </button>
          <button className="ind-btn" title="Paramètres" onClick={() => openSettings(id)}>
            {IcoGear}
          </button>
          <button className="ind-btn" title="Supprimer" onClick={() => removeIndicator(id)}>
            {IcoTrash}
          </button>
        </span>
      </div>
    );
  };

  return (
    <div
      ref={wrapRef}
      className="chart-wrap"
      onMouseMove={onMove}
      onMouseLeave={() => setHovered(null)}
    >
      <div ref={chartElRef} className="chart-canvas" />
      <DrawingLayer
        key={symbol}
        symbol={symbol}
        interval={interval}
        candles={candles}
        wrapRef={wrapRef}
        chartRef={chartRef}
        seriesRef={seriesRef}
        layout={layout}
        layoutRef={layoutRef}
      />
      {toolbarSlot &&
        createPortal(
          <IndicatorCatalog favorites={favorites} onAdd={addIndicator} onToggleFavorite={toggleFavorite} />,
          toolbarSlot
        )}
      <div className="pane-scale-controls">
        {measRender && (
          <>
            <div
              className={`measure-box ${measRender.up ? "up" : "down"}`}
              style={{
                left: measRender.left,
                top: measRender.top,
                width: measRender.width,
                height: measRender.height,
              }}
            />
            <div
              className={`measure-label ${measRender.up ? "up" : "down"}`}
              style={{ left: measRender.labelX, top: measRender.labelTop }}
            >
              <div className="ml-main">
                {measRender.priceChange >= 0 ? "+" : ""}
                {measRender.priceChange.toFixed(2)} ({measRender.pct >= 0 ? "+" : ""}
                {measRender.pct.toFixed(2)}%)
              </div>
              <div className="ml-sub">
                {measRender.bars} barre{measRender.bars > 1 ? "s" : ""}
              </div>
            </div>
            {/* Étiquettes horaires au début et à la fin de la mesure. */}
            <div className={`measure-time ${measRender.up ? "up" : "down"}`} style={{ left: measRender.ax, top: measRender.tBottom }}>
              {measRender.t0Str}
            </div>
            <div className={`measure-time ${measRender.up ? "up" : "down"}`} style={{ left: measRender.bx, top: measRender.tBottom }}>
              {measRender.t1Str}
            </div>
          </>
        )}
        {legend && layout[0] && (
          <div className="pane-legend" style={{ top: layout[0].top + 4 }}>
            <div className="lg-line">
              <span className="lg-sym">{symbol}</span>
              {name && <span className="lg-name">{name}</span>}
              <span className={legend.change >= 0 ? "lg-up" : "lg-down"}>
                O{f2(legend.o)} H{f2(legend.h)} B{f2(legend.l)} C{f2(legend.c)}{" "}
                {legend.change >= 0 ? "+" : ""}
                {f2(legend.change)} ({legend.pct >= 0 ? "+" : ""}
                {legend.pct.toFixed(2)}%)
              </span>
            </div>
            {smaOrder.map((id) =>
              indRow(id, settings[id]?.color ?? "#a371f7", <span key={id}>SMA {settings[id]?.length ?? 50} {f2(legend.sma[id])}</span>)
            )}
          </div>
        )}
        {legend && layout[1] && activeVolume && (
          <div className="pane-legend" style={{ top: layout[1].top + 4 }}>
            {indRow(
              "volume",
              "#8b949e",
              <>
                Vol {settings.volume?.maLength ?? 20} {fmtVol(legend.vol)}{" "}
                <span className="lg-volma">{legend.volMa == null ? "—" : fmtVol(legend.volMa)}</span>
              </>
            )}
          </div>
        )}
        {legend && layout[2] && activeRsi && (
          <div className="pane-legend" style={{ top: layout[2].top + 4 }}>
            {indRow(
              "rsi",
              settings.rsi?.color ?? "#7e57c2",
              <>
                RSI {settings.rsi?.length ?? 14} {f2(legend.rsi)} <span className="lg-rsima">{f2(legend.rsiMa)}</span>
              </>
            )}
          </div>
        )}
        {legend && layout[3] && activeAtr && (
          <div className="pane-legend" style={{ top: layout[3].top + 4 }}>
            {indRow("atr", settings.atr?.color ?? "#ef5350", <>ATR {settings.atr?.length ?? 14} {f2(legend.atr)}</>)}
          </div>
        )}
        {legend && rsPane >= 0 && layout[rsPane] && activeRs && (
          <div className="pane-legend" style={{ top: layout[rsPane].top + 4 }}>
            {indRow("rs", settings.rs?.color ?? "#26a69a",
              <>RS {settings.rs?.rsRef ?? "XIU.TO"} {f2(legend.rs)}</>)}
          </div>
        )}
        {currency && layout[0] && (
          <div className="currency-label" style={{ top: layout[0].top + 4, right: 6 }}>
            {currency}
          </div>
        )}
        {layout.map((box, i) => {
          const st = paneState[i] ?? { auto: false, log: false };
          const showA = hovered === i || st.auto;
          const showL = hovered === i || st.log;
          return (
            <div
              className="scale-btns"
              key={i}
              style={{ top: box.top + box.height - 26, right: 6 }}
            >
              <button
                className={`sb${st.auto ? " active" : ""}${showA ? " visible" : ""}`}
                title="Auto (adapte l'échelle aux données visibles)"
                onClick={() => toggleAuto(i)}
              >
                A
              </button>
              <button
                className={`sb${st.log ? " active" : ""}${showL ? " visible" : ""}`}
                title="Échelle logarithmique"
                onClick={() => toggleLog(i)}
              >
                L
              </button>
            </div>
          );
        })}
      </div>
      {settingsOpenId && settings[settingsOpenId] && (() => {
        const t = typeOf(settingsOpenId);
        return (
          <IndicatorSettings
            title={t === "volume" ? "Vol" : t === "rsi" ? "RSI" : t === "atr" ? "ATR" : t === "rs" ? "RS" : "SMA"}
            type={t}
            settings={settings[settingsOpenId]}
            onChange={changeSettings}
            onCancel={cancelSettings}
            onOk={okSettings}
          />
        );
      })()}
    </div>
  );
}
