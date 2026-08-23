// Modèle des dessins (socle #4) + persistance par symbole + helpers de géométrie.
// Ancrage : temps (UTCTimestamp, secondes) + prix → suit pan/zoom, valable sur tous les intervalles.
import type { Visibility, LineStyleName } from "./indicatorSettings";
import { syncToCloud } from "./cloudPrefs";

export type DrawingType = "trend" | "vline" | "channel" | "brush" | "fib" | "longpos" | "rect" | "divergence";
export type CapStyle = "normal" | "arrow"; // embout d'un trait

// Niveaux d'offset optionnels d'un canal (fractions de la largeur ; 0 et 1 = les 2 bords).
export const CHANNEL_LEVELS = [-0.25, 0.25, 0.5, 0.75, 1.25] as const;
// Épaisseurs du surligneur (px).
export const BRUSH_WIDTHS = [8, 12, 20, 32, 48, 64, 80, 96] as const;

// --- Retracement de Fibonacci ---
export interface FibLevel { ratio: number; on: boolean; color: string; }
export interface FibConfig {
  levels: FibLevel[];      // niveaux (ratio + activé + couleur)
  trendLineOn: boolean;    // ligne de tendance (base p0→p1)
  extendRight: boolean;    // prolonger les niveaux jusqu'au bord droit
  bgOn: boolean;           // bandes ombrées entre niveaux
  bgOpacity: number;       // 0-100
  reverse: boolean;        // inverse (0 ↔ 1)
  showLabels: boolean;     // étiquettes « ratio (prix) »
  fontSize: number;        // px
}
// Ensemble complet des niveaux (couleurs façon TradingView) ; `on` = activés par défaut.
export const FIB_LEVELS: FibLevel[] = [
  { ratio: 0, on: true, color: "#787b86" },
  { ratio: 0.236, on: true, color: "#ef5350" },
  { ratio: 0.382, on: true, color: "#ff9800" },
  { ratio: 0.5, on: true, color: "#4caf50" },
  { ratio: 0.618, on: true, color: "#26a69a" },
  { ratio: 0.786, on: true, color: "#26c6da" },
  { ratio: 1, on: true, color: "#787b86" },
  { ratio: 1.272, on: false, color: "#f5c07a" },
  { ratio: 1.414, on: false, color: "#f48fb1" },
  { ratio: 1.618, on: true, color: "#3f8cff" },
  { ratio: 2, on: false, color: "#80cbc4" },
  { ratio: 2.272, on: false, color: "#f5c07a" },
  { ratio: 2.414, on: false, color: "#a5d6a7" },
  { ratio: 2.618, on: true, color: "#ef5350" },
  { ratio: 3, on: false, color: "#b3e5fc" },
  { ratio: 3.272, on: false, color: "#bdbdbd" },
  { ratio: 3.414, on: false, color: "#9fa8da" },
  { ratio: 3.618, on: true, color: "#9c27b0" },
  { ratio: 4, on: false, color: "#ef9a9a" },
  { ratio: 4.236, on: true, color: "#ec407a" },
  { ratio: 4.272, on: false, color: "#ce93d8" },
  { ratio: 4.414, on: false, color: "#f48fb1" },
  { ratio: 4.618, on: false, color: "#f5c07a" },
  { ratio: 4.764, on: false, color: "#80cbc4" },
];

// --- Mesure d'une flèche (variation % + durée), façon TradingView ---
export interface MeasureConfig {
  percent: boolean;   // afficher la variation en %
  duration: boolean;  // afficher la durée (interrupteur maître)
  durTime: boolean;   // durée : échelle de temps (temps réel écoulé)
  durBars: boolean;   // durée : valeur du graphe (nombre de barres)
  position: "left" | "middle" | "right"; // le long du tracé (par extrémité, stable si le trait s'inverse)
  align: "left" | "center" | "right";    // alignement horizontal du bloc
  orientation: "h" | "along";            // sens du texte : horizontal ou le long du tracé
}
export const defaultMeasure = (percent = true): MeasureConfig => ({
  percent,
  duration: false,
  durTime: true,
  durBars: true,
  position: "right",
  align: "center",
  orientation: "h",
});

// --- Position longue (outil de dimensionnement entrée / objectif / stop) ---
export interface LongPosConfig {
  entry: number;
  stop: number;    // en dessous de l'entrée (long)
  target: number;  // au-dessus de l'entrée (long)
  account: number;      // taille du compte
  lot: number;          // taille du lot (arrondi de la quantité)
  riskMode: "pct" | "amount"; // risque en % du compte ou en montant
  risk: number;
  leverage: number;     // effet de levier (marge requise)
  tickSize: number;     // pas de cotation (pour les « ticks »)
  stopColor: string;
  targetColor: string;
  priceLabels: boolean; // étiquettes de prix
  compact: boolean;     // stats compactes (une ligne)
  alwaysStats: boolean; // afficher les stats même non sélectionné
}
export const defaultLongPos = (entry: number): LongPosConfig => ({
  entry,
  stop: +(entry * 0.95).toFixed(2),
  target: +(entry * 1.1).toFixed(2),
  account: 10000,
  lot: 1,
  riskMode: "pct",
  risk: 1,
  leverage: 1,
  tickSize: 0.01,
  stopColor: "#ef5350",
  targetColor: "#26a69a",
  priceLabels: true,
  compact: true,
  alwaysStats: false,
});

export interface LongPosStats {
  rr: number; targetPct: number; stopPct: number;
  targetTicks: number; stopTicks: number;
  riskAmount: number; qty: number; profitAmount: number; margin: number;
}
export function longPosStats(c: LongPosConfig): LongPosStats {
  const riskPerUnit = Math.max(c.entry - c.stop, 0);
  const rewardPerUnit = Math.max(c.target - c.entry, 0);
  const ts = c.tickSize || 0.01;
  const riskAmount = c.riskMode === "pct" ? c.account * (c.risk / 100) : c.risk;
  const qtyRaw = riskPerUnit > 0 ? riskAmount / riskPerUnit : 0;
  const qty = c.lot > 0 ? Math.floor(qtyRaw / c.lot) * c.lot : qtyRaw;
  return {
    rr: riskPerUnit > 0 ? rewardPerUnit / riskPerUnit : 0,
    targetPct: c.entry ? (rewardPerUnit / c.entry) * 100 : 0,
    stopPct: c.entry ? (riskPerUnit / c.entry) * 100 : 0,
    targetTicks: Math.round(rewardPerUnit / ts),
    stopTicks: Math.round(riskPerUnit / ts),
    riskAmount,
    qty,
    profitAmount: qty * rewardPerUnit,
    margin: c.leverage > 0 ? (qty * c.entry) / c.leverage : qty * c.entry,
  };
}

export interface DPoint {
  time: number; // UTCTimestamp (secondes)
  price: number;
}

export interface DrawingStyle {
  color: string; // hex
  opacity: number; // 0-100
  width: number; // 1-4
  lineStyle: LineStyleName;
  // Trait (ligne de tendance) :
  leftCap: CapStyle;
  rightCap: CapStyle;
  extendLeft: boolean; // prolonge le trait jusqu'au bord gauche
  extendRight: boolean; // … jusqu'au bord droit (les deux possibles, façon TradingView)
  // Trait vertical (#32) :
  extend?: boolean; // prolonge la verticale au-delà de la zone des bougies
  timeLabel?: boolean; // étiquette date/heure au bas de la verticale
  // Canal parallèle (#34) + Rectangle :
  levels?: number[]; // niveaux d'offset optionnels actifs (sous-ensemble de CHANNEL_LEVELS)
  bgOn?: boolean; // remplissage (canal : entre les 2 bords ; rectangle : intérieur)
  bgColor?: string;
  bgOpacity?: number;
  // Rectangle : ligne médiane horizontale (au milieu de la hauteur).
  midOn?: boolean;
  midColor?: string;
  midStyle?: LineStyleName;
}

// Texte optionnel d'un dessin (partagé trend / vline / channel ; le stabilo n'en a pas).
export interface TextConfig {
  value: string;
  color: string;
  size: number; // px
  bold: boolean;
  italic: boolean;
  vAlign: "top" | "middle" | "bottom";
  hAlign: "left" | "center" | "right";
  orientation?: "h" | "v"; // trait vertical (#32) : texte horizontal ou vertical
}

export const defaultText = (): TextConfig => ({
  value: "",
  color: "#c9d1d9",
  size: 14,
  bold: false,
  italic: false,
  vAlign: "middle",
  hAlign: "center",
});

export interface Drawing {
  id: string;
  type: DrawingType;
  points: DPoint[]; // trend/channel = 2 points (base) ; vline = 1 point
  channelOffset?: number; // canal : décalage de prix définissant la parallèle
  fib?: FibConfig; // retracement de Fibonacci
  long?: LongPosConfig; // position longue (entrée / objectif / stop)
  divergence?: DivergenceConfig; // divergence (#57) : ancrage + couleurs de pente
  measure?: MeasureConfig; // flèche : mesure (variation % + durée)
  pane?: number; // panneau d'ancrage (0=prix, 1=volume, 2=RSI) ; absent = 0 (compat)
  style: DrawingStyle;
  text: TextConfig;
  visibility: Visibility;
  locked: boolean;
  title: string;
}

export const defaultVisibility = (): Visibility => ({
  minutes: { on: true, min: 1, max: 59 },
  jours: { on: true, min: 1, max: 366 },
  semaines: { on: true, min: 1, max: 52 },
  mois: { on: true, min: 1, max: 12 },
});

export const defaultTrendStyle = (): DrawingStyle => ({
  color: "#3f8cff",
  opacity: 100,
  width: 2,
  lineStyle: "solid",
  leftCap: "normal",
  rightCap: "normal",
  extendLeft: false,
  extendRight: false,
});

let idSeq = 0;
export const genDrawingId = () => `d-${Date.now().toString(36)}-${(idSeq++).toString(36)}`;
const genId = genDrawingId;

// --- Divergence (#57) : une fleche dans un panneau d'indicateur + son miroir sur le prix ---
// Seule particularite du modele : la fleche du prix ne stocke aucun prix. Elle n'a que les
// deux dates de `points` et se raccroche a la bougie a l'affichage — donc en hebdomadaire
// elle suit le haut (ou le bas) de la SEMAINE, pas celui du jour d'origine.
export interface DivergenceConfig {
  anchor: "auto" | "high" | "low"; // auto : pente descendante → sommets, montante → creux
  upColor: string;                 // pente haussiere
  downColor: string;               // pente baissiere
}
export const defaultDivergence = (): DivergenceConfig => ({
  anchor: "auto",
  upColor: "#3f8cff",
  downColor: "#ef5350",
});

// Ancrage effectif d'une divergence : sommets ou creux des bougies.
// En auto, c'est la pente TRACEE dans l'indicateur qui decide — tracer sur les sommets
// du RSI (pente descendante) doit raccrocher aux sommets du prix.
export function divergenceAnchor(d: Drawing): "high" | "low" {
  const c = d.divergence ?? defaultDivergence();
  if (c.anchor !== "auto") return c.anchor;
  const [a, b] = d.points;
  if (!a || !b) return "high";
  return b.price >= a.price ? "low" : "high";
}

export function newDivergence(p0: DPoint, p1: DPoint, pane: number): Drawing {
  return {
    id: genId(),
    type: "divergence",
    points: [p0, p1],
    pane,
    divergence: defaultDivergence(),
    style: { ...defaultTrendStyle(), width: 2, rightCap: "arrow" },
    text: defaultText(),
    visibility: defaultVisibility(),
    locked: false,
    title: "Divergence",
  };
}

export function newTrend(p0: DPoint, p1: DPoint, rightCap: CapStyle = "normal", pane = 0): Drawing {
  return {
    id: genId(),
    type: "trend",
    points: [p0, p1],
    pane,
    style: { ...defaultTrendStyle(), rightCap },
    measure: defaultMeasure(rightCap === "arrow"), // flèche : % activé par défaut ; trait : désactivé
    text: defaultText(),
    visibility: defaultVisibility(),
    locked: false,
    title: rightCap === "arrow" ? "Flèche" : "Trait",
  };
}

export function newChannel(p0: DPoint, p1: DPoint, offset: number, pane = 0): Drawing {
  return {
    id: genId(),
    type: "channel",
    points: [p0, p1],
    channelOffset: offset,
    pane,
    style: { ...defaultTrendStyle(), levels: [], bgOn: true, bgColor: "#3f8cff", bgOpacity: 12 },
    text: defaultText(),
    visibility: defaultVisibility(),
    locked: false,
    title: "Canal parallèle",
  };
}

// Config Fibonacci « d'usine » (thème d'origine) — base de newFib et du menu Modèles.
export const factoryFibConfig = (): FibConfig => ({
  levels: FIB_LEVELS.map((l) => ({ ...l })),
  trendLineOn: false,
  extendRight: false,
  bgOn: true,
  bgOpacity: 12,
  reverse: false,
  showLabels: true,
  fontSize: 12,
});

export function newRect(p0: DPoint, p1: DPoint, pane = 0): Drawing {
  return {
    id: genId(),
    type: "rect",
    points: [p0, p1],
    pane,
    style: {
      ...defaultTrendStyle(),
      color: "#3f8cff", width: 1, lineStyle: "solid",
      bgOn: true, bgColor: "#3f8cff", bgOpacity: 12,
      midOn: true, midColor: "#9c27b0", midStyle: "dashed",
    },
    text: defaultText(),
    visibility: defaultVisibility(),
    locked: false,
    title: "Rectangle",
  };
}

export function newFib(p0: DPoint, p1: DPoint, pane = 0): Drawing {
  return {
    id: genId(),
    type: "fib",
    points: [p0, p1],
    pane,
    style: { ...defaultTrendStyle(), color: "#787b86", width: 1 },
    fib: factoryFibConfig(),
    text: defaultText(),
    visibility: defaultVisibility(),
    locked: false,
    title: "Retracement de Fibonacci",
  };
}

export function newLongPos(startTime: number, endTime: number, entry: number, pane = 0): Drawing {
  return {
    id: genId(),
    type: "longpos",
    points: [{ time: startTime, price: entry }, { time: endTime, price: entry }],
    pane,
    long: defaultLongPos(entry),
    style: { ...defaultTrendStyle(), color: "#787b86", width: 2 },
    text: { ...defaultText(), color: "#787b86", size: 12 },
    visibility: defaultVisibility(),
    locked: false,
    title: "Position longue",
  };
}

export function newBrush(points: DPoint[], pane = 0): Drawing {
  return {
    id: genId(),
    type: "brush",
    points,
    pane,
    style: { ...defaultTrendStyle(), width: 20, opacity: 38 },
    text: defaultText(),
    visibility: defaultVisibility(),
    locked: false,
    title: "Surligneur",
  };
}

export function newVline(time: number, pane = 0): Drawing {
  return {
    id: genId(),
    type: "vline",
    points: [{ time, price: 0 }],
    pane,
    style: { ...defaultTrendStyle(), extend: false, timeLabel: true },
    text: { ...defaultText(), orientation: "v", vAlign: "top" },
    visibility: defaultVisibility(),
    locked: false,
    title: "Ligne verticale",
  };
}

// --- Persistance par symbole ---
const keyFor = (symbol: string) => `tvlike:drawings:${symbol.toUpperCase()}`;

export function loadDrawings(symbol: string): Drawing[] {
  try {
    const raw = localStorage.getItem(keyFor(symbol));
    if (raw) {
      const list = JSON.parse(raw) as Drawing[];
      if (Array.isArray(list)) return list;
    }
  } catch {
    /* ignore */
  }
  return [];
}

export function saveDrawings(symbol: string, list: Drawing[]) {
  try {
    localStorage.setItem(keyFor(symbol), JSON.stringify(list));
    syncToCloud(keyFor(symbol));
  } catch {
    /* ignore */
  }
}

// Clé de modèle par outil : la Flèche (trait à embout droit flèche) est distincte du Trait simple.
// Les modèles/défauts sont propres à chaque clé (cf. lib/templates.ts).
export function drawingDefaultKey(type: DrawingType, style: DrawingStyle): string {
  return type === "trend" && style.rightCap === "arrow" ? "arrow" : type;
}

// Distance (px) d'un point à un segment — pour le hit-test.
export function distToSegment(
  px: number, py: number,
  x1: number, y1: number, x2: number, y2: number
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - x1) * dx + (py - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}
