// Types et helpers des paramètres d'indicateurs (partagés Chart <-> pop-up).
import { syncToCloud } from "./cloudPrefs";

export type Timeframe = "1d" | "chart"; // Plage temporelle : journalier ou intervalle du graphique
export type LineStyleName = "solid" | "dashed" | "dotted";

export interface VisUnit {
  on: boolean;
  min: number;
  max: number;
}
// Visibilité par unité de temps du graphique (onglet commun à tous les indicateurs).
export interface Visibility {
  minutes: VisUnit;
  jours: VisUnit;
  semaines: VisUnit;
  mois: VisUnit;
}

export interface IndicatorSettings {
  // Indicateurs "ligne" (SMA) :
  length?: number;
  timeframe?: Timeframe;
  color?: string; // hex
  opacity?: number; // 0-100
  lineWidth?: number; // 1-4
  lineStyle?: LineStyleName;
  // Volume :
  maLength?: number; // longueur de la moyenne mobile du volume
  volOn?: boolean; // barres de volume visibles
  upColor?: string; upOpacity?: number; // "En croissance"
  downColor?: string; downOpacity?: number; // "En chute"
  maOn?: boolean; maColor?: string; maOpacity?: number; maWidth?: number; maStyle?: LineStyleName; // Volume MA / RSI-based MA
  // RSI (réutilise length=Longueur RSI, timeframe, color/opacity/lineWidth/lineStyle = ligne RSI, ma* = RSI-based MA) :
  rsiOn?: boolean;
  upperOn?: boolean; upperColor?: string; upperOpacity?: number; upperValue?: number;
  middleOn?: boolean; middleColor?: string; middleOpacity?: number; middleValue?: number;
  lowerOn?: boolean; lowerColor?: string; lowerOpacity?: number; lowerValue?: number;
  bgOn?: boolean; bgColor?: string; bgOpacity?: number; // RSI Background Fill (bande ombrée)
  // Commun :
  visibility: Visibility;
}

// Palette de teintes + styles de ligne (partagés pop-up SMA <-> pop-up couleur).
export const PALETTE = [
  "#ef5350", "#ff9800", "#ffb300", "#66bb6a", "#26a69a", "#26c6da", "#3f8cff", "#5c6bc0", "#ab47bc", "#ec407a",
  "#b71c1c", "#e65100", "#f9a825", "#2e7d32", "#00695c", "#00838f", "#1565c0", "#283593", "#6a1b9a", "#ad1457",
  "#ffffff", "#c9d1d9", "#8b949e", "#546e7a", "#30363d", "#000000",
];
export const LINE_STYLES: { key: LineStyleName; label: string; dash: string }[] = [
  { key: "solid", label: "Solide", dash: "" },
  { key: "dashed", label: "Tirets", dash: "6 4" },
  { key: "dotted", label: "Pointillés", dash: "1 4" },
];

const DEFAULT_VIS: Visibility = {
  minutes: { on: true, min: 1, max: 59 },
  jours: { on: true, min: 1, max: 366 },
  semaines: { on: true, min: 1, max: 52 },
  mois: { on: true, min: 1, max: 12 },
};
const cloneVis = (): Visibility => JSON.parse(JSON.stringify(DEFAULT_VIS));

// Réglages par défaut de chaque indicateur (couleurs = couleurs actuelles).
export const DEFAULT_SETTINGS = (): Record<string, IndicatorSettings> => ({
  sma200: { length: 200, timeframe: "1d", color: "#ff9800", opacity: 100, lineWidth: 1, lineStyle: "solid", visibility: cloneVis() },
  sma50: { length: 50, timeframe: "1d", color: "#3f8cff", opacity: 100, lineWidth: 1, lineStyle: "solid", visibility: cloneVis() },
  sma9: { length: 9, timeframe: "1d", color: "#a371f7", opacity: 100, lineWidth: 1, lineStyle: "solid", visibility: cloneVis() },
  volume: {
    maLength: 20, volOn: true,
    upColor: "#26a69a", upOpacity: 50, downColor: "#ef5350", downOpacity: 50,
    maOn: true, maColor: "#3f8cff", maOpacity: 100, maWidth: 1, maStyle: "solid",
    visibility: cloneVis(),
  },
  rsi: {
    length: 14, maLength: 14, timeframe: "chart",
    color: "#7e57c2", opacity: 100, lineWidth: 2, lineStyle: "solid", rsiOn: true,
    maOn: true, maColor: "#f2c94c", maOpacity: 65, maWidth: 1, maStyle: "solid",
    upperOn: true, upperColor: "#787b86", upperOpacity: 100, upperValue: 70,
    middleOn: true, middleColor: "#8b949e", middleOpacity: 100, middleValue: 50,
    lowerOn: true, lowerColor: "#787b86", lowerOpacity: 100, lowerValue: 30,
    bgOn: true, bgColor: "#7e57c2", bgOpacity: 12,
    visibility: cloneVis(),
  },
});

// Fabrique de réglages SMA (pour les instances ajoutées dynamiquement, #9).
export const smaDefault = (length: number, color: string): IndicatorSettings => ({
  length, timeframe: "1d", color, opacity: 100, lineWidth: 1, lineStyle: "solid", visibility: cloneVis(),
});
// Couleurs proposées pour une nouvelle SMA (rotation, en évitant celles déjà prises).
export const SMA_COLORS = ["#a371f7", "#26c6da", "#ec407a", "#66bb6a", "#ffb300", "#5c6bc0", "#ef5350", "#00838f"];

// Types d'indicateurs au catalogue (#9). mono = une seule instance possible.
export type IndType = "sma" | "volume" | "rsi";
export const IND_TYPES: { type: IndType; label: string; mono: boolean }[] = [
  { type: "sma", label: "Moyenne mobile simple (SMA)", mono: false },
  { type: "volume", label: "Volume", mono: true },
  { type: "rsi", label: "RSI — Indice de force relative", mono: true },
];

export const LS_SETTINGS = "tvlike:indicator-settings";

// Charge depuis localStorage en fusionnant sur les défauts (champs manquants comblés).
export function loadSettings(): Record<string, IndicatorSettings> {
  const base = DEFAULT_SETTINGS();
  try {
    const raw = localStorage.getItem(LS_SETTINGS);
    if (raw) {
      const p = JSON.parse(raw) as Record<string, Partial<IndicatorSettings>>;
      for (const id of Object.keys(base)) {
        const saved = p[id];
        if (saved) {
          const v = saved.visibility;
          base[id] = {
            ...base[id],
            ...saved,
            visibility: {
              minutes: { ...base[id].visibility.minutes, ...v?.minutes },
              jours: { ...base[id].visibility.jours, ...v?.jours },
              semaines: { ...base[id].visibility.semaines, ...v?.semaines },
              mois: { ...base[id].visibility.mois, ...v?.mois },
            },
          };
        }
      }
    }
  } catch {
    /* ignore */
  }
  return base;
}

// --- Configuration d'indicateurs (#9) : liste des SMA + présence Volume/RSI + favoris + réglages ---
export interface IndicatorsConfig {
  smaOrder: string[]; // ids des SMA, dans l'ordre d'affichage (haut→bas de la légende)
  activeVolume: boolean;
  activeRsi: boolean;
  favorites: IndType[]; // types favoris (accès rapide au chevron)
  settings: Record<string, IndicatorSettings>; // réglages par id (sma*, volume, rsi)
}
export const LS_INDICATORS = "tvlike:indicators";

export function loadIndicators(): IndicatorsConfig {
  const base: IndicatorsConfig = {
    smaOrder: ["sma200", "sma50", "sma9"],
    activeVolume: true,
    activeRsi: true,
    favorites: ["sma", "volume", "rsi"],
    settings: loadSettings(), // défauts + migration de l'ancienne clé #7
  };
  try {
    const raw = localStorage.getItem(LS_INDICATORS);
    if (raw) {
      const p = JSON.parse(raw) as Partial<IndicatorsConfig>;
      const settings = { ...base.settings, ...(p.settings || {}) };
      // Garantit un réglage pour chaque SMA de l'ordre (défaut si absent).
      const smaOrder = Array.isArray(p.smaOrder) && p.smaOrder.length ? p.smaOrder : base.smaOrder;
      for (const id of smaOrder) if (!settings[id]) settings[id] = smaDefault(50, "#3f8cff");
      return {
        smaOrder,
        activeVolume: p.activeVolume ?? true,
        activeRsi: p.activeRsi ?? true,
        favorites: Array.isArray(p.favorites) ? p.favorites : base.favorites,
        settings,
      };
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function saveIndicators(cfg: IndicatorsConfig) {
  try {
    localStorage.setItem(LS_INDICATORS, JSON.stringify(cfg));
    syncToCloud(LS_INDICATORS);
  } catch {
    /* ignore */
  }
}

// hex + opacité (0-100) -> rgba().
export const rgba = (hex: string, opacity = 100) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

// Intervalle du graphique -> unité de visibilité + valeur.
const INTERVAL_UNIT: Record<string, { unit: keyof Visibility | "heures"; value: number }> = {
  "5m": { unit: "minutes", value: 5 },
  "15m": { unit: "minutes", value: 15 },
  "30m": { unit: "minutes", value: 30 },
  "1h": { unit: "heures", value: 1 },
  "4h": { unit: "heures", value: 4 },
  "1d": { unit: "jours", value: 1 },
  "1w": { unit: "semaines", value: 1 },
  "1mo": { unit: "mois", value: 1 },
  "3mo": { unit: "mois", value: 3 },
  "6mo": { unit: "mois", value: 6 },
  "12mo": { unit: "mois", value: 12 },
};

// Un indicateur est-il visible pour l'intervalle courant ? (unités "heures" non contrôlées = toujours visibles)
export function visibleForInterval(interval: string, vis: Visibility): boolean {
  const m = INTERVAL_UNIT[interval];
  if (!m || m.unit === "heures") return true;
  const cfg = vis[m.unit];
  return cfg.on && m.value >= cfg.min && m.value <= cfg.max;
}
