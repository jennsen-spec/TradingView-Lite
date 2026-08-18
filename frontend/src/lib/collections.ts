// Watchlist / Collections (#2) — modèle plat (sections + symboles ordonnés) + persistance localStorage.

export interface WLItem {
  id: string;
  type: "section" | "symbol";
  name?: string; // section
  sym?: string; // symbole
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
  } catch {
    /* ignore */
  }
}

export const newSection = (name: string): WLItem => ({ id: genWlId(), type: "section", name });
export const newSymbolItem = (sym: string): WLItem => ({ id: genWlId(), type: "symbol", sym: sym.toUpperCase() });
export const newCollection = (name: string): Collection => ({ id: genWlId(), name, favorite: false, items: [] });
