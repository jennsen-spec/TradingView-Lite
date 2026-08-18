// Modèle des dessins (socle #4) + persistance par symbole + helpers de géométrie.
// Ancrage : temps (UTCTimestamp, secondes) + prix → suit pan/zoom, valable sur tous les intervalles.
import type { Visibility, LineStyleName } from "./indicatorSettings";
import { syncToCloud } from "./cloudPrefs";

export type DrawingType = "trend" | "vline" | "channel" | "brush";
export type CapStyle = "normal" | "arrow"; // embout d'un trait

// Niveaux d'offset optionnels d'un canal (fractions de la largeur ; 0 et 1 = les 2 bords).
export const CHANNEL_LEVELS = [-0.25, 0.25, 0.5, 0.75, 1.25] as const;
// Épaisseurs du surligneur (px).
export const BRUSH_WIDTHS = [8, 12, 20, 32, 48, 64, 80, 96] as const;

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
  // Canal parallèle (#34) :
  levels?: number[]; // niveaux d'offset optionnels actifs (sous-ensemble de CHANNEL_LEVELS)
  bgOn?: boolean; // remplissage entre les 2 bords
  bgColor?: string;
  bgOpacity?: number;
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

export function newTrend(p0: DPoint, p1: DPoint, rightCap: CapStyle = "normal", pane = 0): Drawing {
  return {
    id: genId(),
    type: "trend",
    points: [p0, p1],
    pane,
    style: { ...defaultTrendStyle(), rightCap },
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

// --- Paramètres par défaut par outil (« Définir par défaut ») ---
interface DrawingDefault { style: DrawingStyle; text: TextConfig; visibility: Visibility; }
const DEFAULTS_KEY = "tvlike:drawing-defaults";

// Clé de défaut : la Flèche (trait à embout droit flèche) est distincte du Trait simple.
export function drawingDefaultKey(type: DrawingType, style: DrawingStyle): string {
  return type === "trend" && style.rightCap === "arrow" ? "arrow" : type;
}

export function loadDrawingDefaults(): Record<string, DrawingDefault> {
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return {};
}

export function saveDrawingDefault(d: Drawing) {
  try {
    const all = loadDrawingDefaults();
    all[drawingDefaultKey(d.type, d.style)] = { style: d.style, text: d.text, visibility: d.visibility };
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

// Applique le défaut enregistré (si présent) à un dessin fraîchement créé, en gardant sa géométrie.
export function applyDrawingDefault(d: Drawing): Drawing {
  const def = loadDrawingDefaults()[drawingDefaultKey(d.type, d.style)];
  if (!def) return d;
  return {
    ...d,
    style: { ...d.style, ...def.style },
    text: { ...d.text, ...def.text },
    visibility: def.visibility ?? d.visibility,
  };
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
