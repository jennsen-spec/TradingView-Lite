// Modèles (« thèmes ») génériques pour tous les dessins : défaut + enregistrements nommés,
// PROPRES À CHAQUE TYPE (clé = drawingDefaultKey → trend / arrow / vline / channel / brush / fib).
// Persistés en localStorage et synchronisés dans le cloud (clés tvlike:).
import type { Drawing, DrawingStyle, TextConfig, MeasureConfig, FibConfig, LongPosConfig } from "./drawings";
import { drawingDefaultKey, newTrend, newVline, newChannel, newBrush, newFib, newLongPos, newRect } from "./drawings";
import type { Visibility } from "./indicatorSettings";
import { syncToCloud } from "./cloudPrefs";

// Ce qu'un modèle capture (tout sauf géométrie / identité).
export interface DrawingTemplate {
  style: DrawingStyle;
  text: TextConfig;
  visibility: Visibility;
  measure?: MeasureConfig; // trait / flèche
  fib?: FibConfig;         // retracement de Fibonacci
  long?: LongPosConfig;    // position longue (réglages, hors géométrie entrée/stop/objectif)
}
export interface NamedTemplate { id: string; name: string; template: DrawingTemplate; }

const clone = <T,>(o: T): T => JSON.parse(JSON.stringify(o));

export function templateFromDrawing(d: Drawing): DrawingTemplate {
  return clone({
    style: d.style,
    text: d.text,
    visibility: d.visibility,
    ...(d.measure ? { measure: d.measure } : {}),
    ...(d.fib ? { fib: d.fib } : {}),
    ...(d.long ? { long: d.long } : {}),
  });
}

// Applique un modèle en gardant la géométrie (points, pane, id, titre, verrou).
// Pour la position longue, on préserve aussi entrée/stop/objectif (= géométrie sur l'axe des prix).
export function applyTemplate(d: Drawing, t: DrawingTemplate): Drawing {
  const tt = clone(t);
  const out: Drawing = {
    ...d,
    style: tt.style,
    text: tt.text,
    visibility: tt.visibility,
    ...(tt.measure ? { measure: tt.measure } : {}),
    ...(tt.fib ? { fib: tt.fib } : {}),
  };
  if (tt.long) {
    out.long = { ...tt.long, entry: d.long?.entry ?? tt.long.entry, stop: d.long?.stop ?? tt.long.stop, target: d.long?.target ?? tt.long.target };
  }
  return out;
}

// Modèle « d'origine » (usine) pour le type du dessin — reconstruit via les fabriques new*.
export function factoryTemplate(d: Drawing): DrawingTemplate {
  const p = { time: 0, price: 0 };
  let fresh: Drawing;
  switch (d.type) {
    case "vline": fresh = newVline(0); break;
    case "channel": fresh = newChannel(p, p, 0); break;
    case "brush": fresh = newBrush([p, p]); break;
    case "fib": fresh = newFib(p, p); break;
    case "rect": fresh = newRect(p, p); break;
    case "longpos": fresh = newLongPos(0, 1, d.long?.entry ?? 100); break;
    default: fresh = newTrend(p, p, d.style.rightCap === "arrow" ? "arrow" : "normal");
  }
  return templateFromDrawing(fresh);
}

const DEF_KEY = (k: string) => `tvlike:tpl-default:${k}`;
const PRE_KEY = (k: string) => `tvlike:tpl-presets:${k}`;

export function loadTemplateDefault(key: string): DrawingTemplate | null {
  try { const r = localStorage.getItem(DEF_KEY(key)); return r ? JSON.parse(r) : null; } catch { return null; }
}
export function saveTemplateDefault(key: string, t: DrawingTemplate) {
  try { localStorage.setItem(DEF_KEY(key), JSON.stringify(clone(t))); syncToCloud(DEF_KEY(key)); } catch { /* ignore */ }
}
export function loadTemplates(key: string): NamedTemplate[] {
  try { const r = localStorage.getItem(PRE_KEY(key)); const l = r ? JSON.parse(r) : []; return Array.isArray(l) ? l : []; } catch { return []; }
}
export function saveTemplates(key: string, list: NamedTemplate[]) {
  try { localStorage.setItem(PRE_KEY(key), JSON.stringify(list)); syncToCloud(PRE_KEY(key)); } catch { /* ignore */ }
}

let seq = 0;
const genId = () => `tpl-${Date.now().toString(36)}-${(seq++).toString(36)}`;
export function addTemplate(key: string, name: string, t: DrawingTemplate): NamedTemplate {
  const nt: NamedTemplate = { id: genId(), name: name.trim() || "Sans nom", template: clone(t) };
  saveTemplates(key, [...loadTemplates(key), nt]);
  return nt;
}
export function renameTemplate(key: string, id: string, name: string) {
  saveTemplates(key, loadTemplates(key).map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)));
}
export function deleteTemplate(key: string, id: string) {
  saveTemplates(key, loadTemplates(key).filter((p) => p.id !== id));
}

// Nouveau dessin : applique le modèle par défaut de son type s'il existe (sinon inchangé).
export function applyTemplateDefault(d: Drawing): Drawing {
  const t = loadTemplateDefault(drawingDefaultKey(d.type, d.style));
  return t ? applyTemplate(d, t) : d;
}
