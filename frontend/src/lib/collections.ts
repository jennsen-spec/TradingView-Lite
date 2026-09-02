// Watchlist / Collections (#2) — modèle plat (sections + symboles ordonnés) + persistance localStorage.
import { syncToCloud } from "./cloudPrefs";

export interface WLItem {
  id: string;
  type: "section" | "symbol";
  name?: string; // section
  sym?: string; // symbole
  flag?: string; // marqueur de couleur (hex) — optionnel
}

export interface Collection {
  id: string;
  name: string;
  favorite: boolean; // étoilée → apparaît en accès rapide (rond)
  items: WLItem[];
}

let seq = 0;
export const genWlId = () => `wl-${Date.now().toString(36)}-${(seq++).toString(36)}`;

const KEY = "tvlike:collections";

function seed(): Collection[] {
  return [
    {
      id: genWlId(),
      name: "Collection",
      favorite: true,
      items: [
        { id: genWlId(), type: "section", name: "ETF" },
        { id: genWlId(), type: "symbol", sym: "QQQ" },
        { id: genWlId(), type: "symbol", sym: "SPY" },
      ],
    },
  ];
}

export function loadCollections(): Collection[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw);
      if (Array.isArray(list) && list.length) return list;
    }
  } catch {
    /* ignore */
  }
  return seed();
}

export function saveCollections(list: Collection[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    syncToCloud(KEY);
  } catch {
    /* ignore */
  }
}

// Collection affichée dans la watchlist. Purement local à l'appareil (pas de
// synchro cloud) : sert à la molette du graphique (#87) pour lister les mêmes
// symboles que ceux que Jean a sous les yeux.
const CUR_KEY = "tvlike:wl-current";
export const loadCurrentCollectionId = (): string | null => {
  try { return localStorage.getItem(CUR_KEY); } catch { return null; }
};
export const saveCurrentCollectionId = (id: string) => {
  try { localStorage.setItem(CUR_KEY, id); } catch { /* ignore */ }
};

export const newSection = (name: string): WLItem => ({ id: genWlId(), type: "section", name });
export const newSymbolItem = (sym: string): WLItem => ({ id: genWlId(), type: "symbol", sym: sym.toUpperCase() });
export const newCollection = (name: string): Collection => ({ id: genWlId(), name, favorite: false, items: [] });
