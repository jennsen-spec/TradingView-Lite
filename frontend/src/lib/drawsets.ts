// Ensembles de dessins par symbole (#63) : photographier l'état des dessins sous un
// nom, le ranger, le restaurer plus tard. Une clé cloud par symbole, fusionnable par
// id comme les dessins (cf. cloudPrefs.isMergeable) — et jamais touchée par les
// scripts du labo, même contrat que les collections.
import type { Drawing } from "./drawings";
import { syncToCloud } from "./cloudPrefs";

export interface DrawSet {
  id: string;
  nom: string;
  date: string; // ISO — date de la (dernière) sauvegarde
  dessins: Drawing[];
}

const keyFor = (symbol: string) => `tvlike:drawsets:${symbol.toUpperCase()}`;

export function loadDrawSets(symbol: string): DrawSet[] {
  try {
    const raw = localStorage.getItem(keyFor(symbol));
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveDrawSets(symbol: string, sets: DrawSet[]) {
  try {
    localStorage.setItem(keyFor(symbol), JSON.stringify(sets));
    syncToCloud(keyFor(symbol));
  } catch {
    /* quota */
  }
}

// Empreinte d'une liste de dessins, indépendante de l'ordre — sert à savoir si
// l'état courant est déjà sauvegardé tel quel dans un ensemble (avertissement
// avant un « restaurer = remplacer »).
export function empreinte(dessins: Drawing[]): string {
  return JSON.stringify([...dessins].sort((a, b) => (a.id < b.id ? -1 : 1)));
}
