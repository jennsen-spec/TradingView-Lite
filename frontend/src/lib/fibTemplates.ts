// Modèles (« thèmes ») du retracement de Fibonacci : défaut utilisateur + enregistrements nommés.
// Persistés en localStorage et synchronisés dans le cloud (comme les autres préférences tvlike:).
import type { FibConfig } from "./drawings";
import { factoryFibConfig } from "./drawings";
import { syncToCloud } from "./cloudPrefs";

export interface FibPreset {
  id: string;
  name: string;
  config: FibConfig;
}

const DEFAULT_KEY = "tvlike:fib-default";
const PRESETS_KEY = "tvlike:fib-presets";

// Clone profond d'une config (les modèles ne doivent pas partager de référence avec le dessin).
export const cloneFibConfig = (c: FibConfig): FibConfig => ({
  ...c,
  levels: c.levels.map((l) => ({ ...l })),
});

// --- Thème par défaut (celui défini par l'utilisateur via « Définir par défaut ») ---
export function loadFibDefault(): FibConfig | null {
  try {
    const raw = localStorage.getItem(DEFAULT_KEY);
    return raw ? (JSON.parse(raw) as FibConfig) : null;
  } catch {
    return null;
  }
}

export function saveFibDefault(config: FibConfig) {
  try {
    localStorage.setItem(DEFAULT_KEY, JSON.stringify(cloneFibConfig(config)));
    syncToCloud(DEFAULT_KEY);
  } catch {
    /* ignore */
  }
}

// Nouveau retracement : applique le thème par défaut s'il existe, sinon l'usine.
export function defaultOrFactoryFib(): FibConfig {
  return loadFibDefault() ?? factoryFibConfig();
}

// --- Modèles nommés (« Enregistrer sous… ») ---
export function loadFibPresets(): FibPreset[] {
  try {
    const raw = localStorage.getItem(PRESETS_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? (list as FibPreset[]) : [];
  } catch {
    return [];
  }
}

export function saveFibPresets(list: FibPreset[]) {
  try {
    localStorage.setItem(PRESETS_KEY, JSON.stringify(list));
    syncToCloud(PRESETS_KEY);
  } catch {
    /* ignore */
  }
}

let seq = 0;
export const genPresetId = () => `fp-${Date.now().toString(36)}-${(seq++).toString(36)}`;

export function addFibPreset(name: string, config: FibConfig): FibPreset {
  const preset: FibPreset = { id: genPresetId(), name: name.trim() || "Sans nom", config: cloneFibConfig(config) };
  saveFibPresets([...loadFibPresets(), preset]);
  return preset;
}

export function renameFibPreset(id: string, name: string) {
  saveFibPresets(loadFibPresets().map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)));
}

export function deleteFibPreset(id: string) {
  saveFibPresets(loadFibPresets().filter((p) => p.id !== id));
}
