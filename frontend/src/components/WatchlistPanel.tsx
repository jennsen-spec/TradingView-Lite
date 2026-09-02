import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  loadCollections, saveCollections, newSection, newSymbolItem, newCollection,
  loadCurrentCollectionId, saveCurrentCollectionId,
  type Collection,
} from "../lib/collections";
import { fetchQuotes, type Quote } from "../lib/api";
import { syncToCloud } from "../lib/cloudPrefs";
import { useIsMobile } from "../lib/useIsMobile";
import SymbolSearch from "./SymbolSearch";
import SymbolLogo from "./SymbolLogo";
import WatchlistDetail from "./WatchlistDetail";

type SortDir = "none" | "asc" | "desc";
// Variation formatée façon FR : « +1,23% » / « −0,64% ».
const fmtChg = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(v).toFixed(2).replace(".", ",")}%`;
const fmtPrice = (v: number) => v.toFixed(2).replace(".", ",");
const fmtVol = (v: number) => {
  const a = Math.abs(v);
  const [d, s] = a >= 1e9 ? [1e9, "Md"] : a >= 1e6 ? [1e6, "M"] : a >= 1e3 ? [1e3, "K"] : [1, ""];
  return s ? `${(v / d).toFixed(1).replace(".", ",")} ${s}` : String(Math.round(v));
};

// Icones des actions de ligne (revelees au survol).
const IconEtiquette = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20.6 13.4 12 22l-9-9V3h10l7.6 7.6a2 2 0 0 1 0 2.8Z" />
    <circle cx="7.5" cy="7.5" r="1.3" fill="currentColor" stroke="none" />
  </svg>
);
const IconPoubelle = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor"
       strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
    <path d="M10 11v5M14 11v5" />
  </svg>
);

// Marqueurs de couleur (flags) et colonnes optionnelles.
const FLAG_COLORS = ["#ef5350", "#ff9800", "#26a69a", "#3f8cff", "#9c27b0", "#26c6da"];
// Derniere couleur choisie : re-appliquee directement au clic sur l'etiquette.
const LAST_FLAG_KEY = "tvlike:wl-last-flag";
const loadLastFlag = (): string => {
  try { return localStorage.getItem(LAST_FLAG_KEY) || FLAG_COLORS[0]; } catch { return FLAG_COLORS[0]; }
};
interface ColConfig { last: boolean; volume: boolean; }
const COLS_KEY = "tvlike:wl-columns";
const loadCols = (): ColConfig => {
  try { return { last: false, volume: false, ...JSON.parse(localStorage.getItem(COLS_KEY) || "{}") }; }
  catch { return { last: false, volume: false }; }
};
const saveCols = (c: ColConfig) => { try { localStorage.setItem(COLS_KEY, JSON.stringify(c)); syncToCloud(COLS_KEY); } catch { /* ignore */ } };

// Largeur du volet (redimensionnable, mémorisée). Seuils d'apparition des colonnes.
const WIDTH_KEY = "tvlike:wl-width";
const W_MIN = 240, W_MAX = 520, W_DEF = 300;
const W_LAST = 340, W_VOLUME = 400; // le ticker prime : colonnes révélées quand le volet s'élargit
const loadWidth = (): number => { const n = Number(localStorage.getItem(WIDTH_KEY)); return n >= W_MIN && n <= W_MAX ? n : W_DEF; };
const saveWidth = (w: number) => { try { localStorage.setItem(WIDTH_KEY, String(w)); syncToCloud(WIDTH_KEY); } catch { /* ignore */ } };

interface Props {
  onClose: () => void;
  onSelectSymbol: (s: string) => void;
  currentSymbol: string;
}

export default function WatchlistPanel({ onClose, onSelectSymbol, currentSymbol }: Props) {
  // Mobile (#85) : chips de collections à nom complet (au lieu de l'initiale).
  const isMobile = useIsMobile();
  const [collections, setCollections] = useState<Collection[]>(() => loadCollections());
  // La collection courante est mémorisée : la molette du graphique (#87) lit la même.
  const [currentId, setCurrentId] = useState<string>(() => {
    const memo = loadCurrentCollectionId();
    return memo && collections.some((c) => c.id === memo) ? memo : collections[0].id;
  });
  useEffect(() => saveCurrentCollectionId(currentId), [currentId]);
  const [nameMenu, setNameMenu] = useState(false);
  const [dotsMenu, setDotsMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [secMenu, setSecMenu] = useState<{ id: string; x: number; y: number } | null>(null);
  const [flagMenu, setFlagMenu] = useState<{ id: string; x: number; y: number; pastille?: boolean } | null>(null);
  const [lastFlag, setLastFlagState] = useState<string>(loadLastFlag);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [sortDir, setSortDir] = useState<SortDir>("none");
  const [cols, setCols] = useState<ColConfig>(loadCols);
  const [width, setWidth] = useState<number>(loadWidth);
  const widthRef = useRef(width); widthRef.current = width;
  const resizeRef = useRef<{ startX: number; startW: number } | null>(null);

  // Redimensionnement du volet (poignée sur le bord gauche).
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const r = resizeRef.current; if (!r) return;
      setWidth(Math.min(W_MAX, Math.max(W_MIN, r.startW - (e.clientX - r.startX))));
    };
    const up = () => { if (resizeRef.current) { resizeRef.current = null; saveWidth(widthRef.current); } };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);
  // Colonnes effectives : le ticker prime → on masque si le volet est trop étroit.
  const effCols: ColConfig = { last: cols.last && width >= W_LAST, volume: cols.volume && width >= W_VOLUME };

  useEffect(() => saveCollections(collections), [collections]);

  // Ferme les menus au clic en dehors.
  useEffect(() => {
    if (!nameMenu && !dotsMenu && !secMenu && !flagMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".wl-menu, .wl-flag-pastille, .wl-title, .wl-dots-wrap")) {
        setNameMenu(false);
        setDotsMenu(false);
        setSecMenu(null);
        setFlagMenu(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [nameMenu, dotsMenu, secMenu, flagMenu]);

  const setColumns = (c: ColConfig) => { setCols(c); saveCols(c); };
  const setFlag = (itemId: string, color: string | null) =>
    updateCur((coll) => ({ ...coll, items: coll.items.map((i) => (i.id === itemId ? { ...i, flag: color ?? undefined } : i)) }));
  // Ecrit seulement sur action de l'utilisateur (jamais au montage) : voir #48.
  const setLastFlag = (c: string) => {
    setLastFlagState(c);
    try { localStorage.setItem(LAST_FLAG_KEY, c); syncToCloud(LAST_FLAG_KEY); } catch { /* ignore */ }
  };

  const cur = collections.find((c) => c.id === currentId) ?? collections[0];
  const favorites = collections.filter((c) => c.favorite);

  // Quotes de la collection courante (variation du jour) : chargées à l'ouverture + polling 60 s.
  const symbolsKey = cur.items.filter((i) => i.type === "symbol").map((i) => i.sym).join(",");
  useEffect(() => {
    const syms = symbolsKey.split(",").filter(Boolean);
    if (!syms.length) return;
    let stop = false;
    const load = () => fetchQuotes(syms)
      .then((qs) => { if (!stop) setQuotes((prev) => { const m = { ...prev }; for (const q of qs) m[q.symbol] = q; return m; }); })
      .catch(() => { /* ignore */ });
    load();
    const id = setInterval(load, 60000);
    return () => { stop = true; clearInterval(id); };
  }, [symbolsKey]);

  const cycleSort = () => setSortDir((d) => (d === "none" ? "desc" : d === "desc" ? "asc" : "none"));
  const chgOf = (sym: string) => quotes[sym.toUpperCase()]?.changePct ?? null;

  // Ordre d'affichage : tri par variation À L'INTÉRIEUR de chaque section (sections figées).
  const displayItems = (() => {
    if (sortDir === "none") return cur.items;
    const out: typeof cur.items = [];
    let i = 0;
    while (i < cur.items.length) {
      if (cur.items[i].type === "section") { out.push(cur.items[i]); i++; continue; }
      let j = i;
      const run = [];
      while (j < cur.items.length && cur.items[j].type === "symbol") { run.push(cur.items[j]); j++; }
      run.sort((a, b) => {
        const ca = chgOf(a.sym!), cb = chgOf(b.sym!);
        if (ca == null && cb == null) return 0;
        if (ca == null) return 1;
        if (cb == null) return -1;
        return sortDir === "desc" ? cb - ca : ca - cb;
      });
      out.push(...run);
      i = j;
    }
    return out;
  })();

  const updateCur = (fn: (c: Collection) => Collection) =>
    setCollections((prev) => prev.map((c) => (c.id === cur.id ? fn(c) : c)));
  const rename = (name: string) => { if (name.trim()) updateCur((c) => ({ ...c, name: name.trim() })); };
  const addSectionItem = (name: string) => { if (name.trim()) updateCur((c) => ({ ...c, items: [...c.items, newSection(name.trim())] })); };
  const addSymbol = (sym: string) => updateCur((c) => ({ ...c, items: [...c.items, newSymbolItem(sym)] }));
  const removeItem = (id: string) => updateCur((c) => ({ ...c, items: c.items.filter((it) => it.id !== id) }));
  const toggleFav = (id: string) => setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)));

  // Réordonner les collections (#76) — glisser-déposer dans le menu déroulant.
  // L'ordre du tableau est la seule source de vérité : le menu ET les pastilles
  // favorites (dérivées par filter) le suivent, rien d'autre à synchroniser.
  const collDragRef = useRef<string | null>(null);
  const [collDragging, setCollDragging] = useState<string | null>(null);
  const [collDrop, setCollDrop] = useState<{ id: string; after: boolean } | null>(null);
  const reorderColl = (srcId: string, targetId: string, after: boolean) => {
    if (srcId === targetId) return;
    setCollections((prev) => {
      const src = prev.find((c) => c.id === srcId);
      if (!src) return prev;
      const rest = prev.filter((c) => c.id !== srcId);
      const ti = rest.findIndex((c) => c.id === targetId);
      if (ti < 0) return prev;
      const at = after ? ti + 1 : ti;
      return [...rest.slice(0, at), src, ...rest.slice(at)];
    });
  };
  const finDragColl = () => { collDragRef.current = null; setCollDragging(null); setCollDrop(null); };
  // Vide la liste courante : les titres partent, la collection reste dans le selecteur.
  const clearList = () => updateCur((c) => ({ ...c, items: [] }));
  // Supprime la collection courante. La derniere ne peut pas partir : le volet
  // n'aurait plus rien a afficher.
  const deleteList = () => {
    if (collections.length <= 1) return;
    const reste = collections.filter((c) => c.id !== cur.id);
    setCollections(reste);
    setCurrentId(reste[0].id);
  };
  const createList = (name: string) => {
    if (!name.trim()) return;
    const nc = newCollection(name.trim());
    setCollections((prev) => [...prev, nc]);
    setCurrentId(nc.id);
  };
  const toggleCollapse = (id: string) => setCollapsed((c) => ({ ...c, [id]: !c[id] }));
  const renameSection = (id: string, name: string) => {
    if (name.trim()) updateCur((c) => ({ ...c, items: c.items.map((i) => (i.id === id ? { ...i, name: name.trim() } : i)) }));
  };
  // Supprime la section ET ses symboles (jusqu'à la section suivante).
  const removeSection = (id: string) => updateCur((c) => {
    const di = c.items.findIndex((i) => i.id === id);
    if (di < 0) return c;
    let end = di + 1;
    while (end < c.items.length && c.items[end].type === "symbol") end++;
    return { ...c, items: [...c.items.slice(0, di), ...c.items.slice(end)] };
  });
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  // Mobile (#85) : le tap sur une ligne ne charge pas le graphique directement —
  // il révèle deux boutons : « Graphique » et « Backtest » (à venir).
  const [selRowId, setSelRowId] = useState<string | null>(null);

  // --- Drag & drop pour réordonner symboles et sections ---
  const dragIdRef = useRef<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ id: string; after: boolean } | null>(null);

  const reorder = (draggedId: string, targetId: string, after: boolean) => {
    if (draggedId === targetId) return;
    updateCur((c) => {
      const items = c.items;
      const di = items.findIndex((i) => i.id === draggedId);
      if (di < 0) return c;
      // Unité déplacée : un symbole seul, ou une section AVEC ses symboles (jusqu'à la section suivante).
      let unit;
      if (items[di].type === "section") {
        let end = di + 1;
        while (end < items.length && items[end].type === "symbol") end++;
        unit = items.slice(di, end);
      } else {
        unit = [items[di]];
      }
      const unitIds = new Set(unit.map((u) => u.id));
      const rest = items.filter((i) => !unitIds.has(i.id));
      const ti = rest.findIndex((i) => i.id === targetId);
      if (ti < 0) return c; // cible dans l'unité déplacée → no-op
      const insertAt = after ? ti + 1 : ti;
      return { ...c, items: [...rest.slice(0, insertAt), ...unit, ...rest.slice(insertAt)] };
    });
  };

  const onDragStart = (id: string) => { dragIdRef.current = id; setDraggingId(id); };
  const onDragOverItem = (e: React.DragEvent, id: string) => {
    if (!dragIdRef.current || dragIdRef.current === id) return;
    e.preventDefault();
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const after = e.clientY > r.top + r.height / 2;
    setDropTarget((d) => (d && d.id === id && d.after === after ? d : { id, after }));
  };
  const onDropItem = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragIdRef.current) reorder(dragIdRef.current, id, dropTarget?.after ?? false);
    dragIdRef.current = null;
    setDraggingId(null);
    setDropTarget(null);
  };
  const onDragEnd = () => { dragIdRef.current = null; setDraggingId(null); setDropTarget(null); };
  const dropClass = (id: string) =>
    dropTarget?.id === id ? (dropTarget.after ? " wl-drop-after" : " wl-drop-before") : "";

  // Corps : rendu des sections + symboles (symbole groupé sous la section au-dessus).
  const body: ReactNode[] = [];
  let secCollapsed = false;
  for (const item of displayItems) {
    if (item.type === "section") {
      secCollapsed = !!collapsed[item.id];
      if (editingSectionId === item.id) {
        body.push(
          <div key={item.id} className="wl-inline-add">
            <input
              autoFocus defaultValue={item.name} className="wl-name-input"
              onBlur={(e) => { renameSection(item.id, e.target.value); setEditingSectionId(null); }}
              onKeyDown={(e) => {
                if (e.key === "Enter") { renameSection(item.id, (e.target as HTMLInputElement).value); setEditingSectionId(null); }
                if (e.key === "Escape") setEditingSectionId(null);
              }}
            />
          </div>
        );
      } else {
        body.push(
          <button
            key={item.id}
            className={`wl-cat-head${draggingId === item.id ? " wl-dragging" : ""}${dropClass(item.id)}`}
            draggable
            onDragStart={() => onDragStart(item.id)}
            onDragOver={(e) => onDragOverItem(e, item.id)}
            onDrop={(e) => onDropItem(e, item.id)}
            onDragEnd={onDragEnd}
            onClick={() => toggleCollapse(item.id)}
            onContextMenu={(e) => { e.preventDefault(); setSecMenu({ id: item.id, x: e.clientX, y: e.clientY }); setNameMenu(false); setDotsMenu(false); }}
            title="Glisser pour déplacer · clic droit pour renommer/supprimer"
          >
            <span className={`wl-cat-chevron${collapsed[item.id] ? " collapsed" : ""}`}>⌄</span>
            {item.name}
          </button>
        );
      }
    } else if (!secCollapsed) {
      const sym = item.sym!;
      body.push(
        <div
          key={item.id}
          className={`wl-row${sym === currentSymbol ? " active" : ""}${draggingId === item.id ? " wl-dragging" : ""}${dropClass(item.id)}`}
          draggable
          onDragStart={() => onDragStart(item.id)}
          onDragOver={(e) => onDragOverItem(e, item.id)}
          onDrop={(e) => onDropItem(e, item.id)}
          onDragEnd={onDragEnd}
        >
          <button
            className="wl-row-main"
            onClick={() => (isMobile ? setSelRowId((s) => (s === item.id ? null : item.id)) : onSelectSymbol(sym))}
            onContextMenu={(e) => { e.preventDefault(); setFlagMenu({ id: item.id, x: e.clientX, y: e.clientY }); setNameMenu(false); setDotsMenu(false); setSecMenu(null); }}
            title={`Afficher ${sym} · clic droit = marqueur`}
          >
            <SymbolLogo symbol={sym} />
            <span className="wl-sym">{sym}</span>
            {(() => {
              const q = quotes[sym.toUpperCase()];
              const c = q?.changePct ?? null;
              return (
                <>
                  {effCols.last && <span className="wl-cell">{q?.price != null ? fmtPrice(q.price) : ""}</span>}
                  {effCols.volume && <span className="wl-cell">{q?.volume != null ? fmtVol(q.volume) : ""}</span>}
                  <span className={`wl-chg${c == null ? "" : c >= 0 ? " up" : " dn"}`}>{c == null ? "" : fmtChg(c)}</span>
                </>
              );
            })()}
          </button>
          {item.flag && <span className="wl-ruban" style={{ background: item.flag }} />}
          <div className="wl-row-actions">
            <button
              className="wl-act" style={item.flag ? { color: item.flag } : undefined}
              title={item.flag ? "Retirer l'étiquette" : "Étiqueter"}
              aria-label={`${item.flag ? "Retirer l'étiquette de" : "Étiqueter"} ${sym}`}
              onClick={(e) => {
                if (item.flag) { setFlag(item.id, null); setFlagMenu(null); return; } // deja etiquete → on retire
                setFlag(item.id, lastFlag); // applique la derniere couleur…
                const r = (e.currentTarget.closest(".wl-row") as HTMLElement).getBoundingClientRect();
                setFlagMenu({ id: item.id, x: r.left + 8, y: r.top + 2, pastille: true }); // …et propose la palette
              }}
            >
              <IconEtiquette />
            </button>
            <button
              className="wl-act wl-act-del" title="Retirer de la collection"
              aria-label={`Retirer ${sym} de la collection`} onClick={() => removeItem(item.id)}
            >
              <IconPoubelle />
            </button>
          </div>
          {isMobile && selRowId === item.id && (
            <div className="wl-row-cta">
              <button className="wl-cta" onClick={() => { setSelRowId(null); onSelectSymbol(sym); }}>Graphique</button>
              <button className="wl-cta" disabled title="Module backtest à venir">Backtest</button>
            </div>
          )}
        </div>
      );
    }
  }
  if (addingSection) {
    body.push(
      <div key="__addsec" className="wl-inline-add">
        <input
          autoFocus placeholder="Nom de la section" className="wl-name-input"
          onBlur={(e) => { addSectionItem(e.target.value); setAddingSection(false); }}
          onKeyDown={(e) => {
            if (e.key === "Enter") { addSectionItem((e.target as HTMLInputElement).value); setAddingSection(false); }
            if (e.key === "Escape") setAddingSection(false);
          }}
        />
      </div>
    );
  }

  return (
    <aside className="wl-panel" style={{ width, flexBasis: width }}>
      <div
        className="wl-resize"
        onMouseDown={(e) => { resizeRef.current = { startX: e.clientX, startW: width }; e.preventDefault(); }}
        title="Redimensionner"
      />
      <div className="wl-head">
        {editingName ? (
          <input
            className="wl-name-input" autoFocus defaultValue={cur.name}
            onBlur={(e) => { rename(e.target.value); setEditingName(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { rename((e.target as HTMLInputElement).value); setEditingName(false); }
              if (e.key === "Escape") setEditingName(false);
            }}
          />
        ) : (
          <div className="wl-title-wrap">
            <button className="wl-title" onClick={() => { setNameMenu((o) => !o); setDotsMenu(false); }} title="Changer de collection">
              <span>{cur.name}</span>
              <span className="wl-chevron">⌄</span>
            </button>
            {nameMenu && (
              <div className="wl-menu">
                <button className="wl-menu-item" onClick={() => { setNameMenu(false); setAddingList(true); }}>＋ Créer une nouvelle liste</button>
                <div className="wl-menu-sep" />
                <div className="wl-menu-label">Collections</div>
                {collections.map((c) => (
                  <div
                    key={c.id}
                    className={`wl-menu-coll${c.id === cur.id ? " active" : ""}${collDragging === c.id ? " wl-dragging" : ""}${collDrop?.id === c.id ? (collDrop.after ? " wl-drop-after" : " wl-drop-before") : ""}`}
                    draggable
                    onDragStart={() => { collDragRef.current = c.id; setCollDragging(c.id); }}
                    onDragOver={(e) => {
                      if (!collDragRef.current || collDragRef.current === c.id) return;
                      e.preventDefault();
                      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                      const after = e.clientY > r.top + r.height / 2;
                      setCollDrop((d) => (d && d.id === c.id && d.after === after ? d : { id: c.id, after }));
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (collDragRef.current) reorderColl(collDragRef.current, c.id, collDrop?.after ?? false);
                      finDragColl();
                    }}
                    onDragEnd={finDragColl}
                    title="Glisser pour réordonner"
                  >
                    <button className="wl-menu-coll-name" onClick={() => { setCurrentId(c.id); setNameMenu(false); }}>{c.name}</button>
                    <button className={`wl-star${c.favorite ? " on" : ""}`} title="Favori (accès rapide)" onClick={() => toggleFav(c.id)}>★</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="wl-head-actions">
          <button className="wl-icon-btn" title="Ajouter un symbole" aria-label="Ajouter un symbole" onClick={() => setAddOpen(true)}>+</button>
          <div className="wl-dots-wrap">
            <button className="wl-icon-btn" title="Options" aria-label="Options" onClick={() => { setDotsMenu((o) => !o); setNameMenu(false); }}>⋯</button>
            {dotsMenu && (
              <div className="wl-menu wl-menu-right">
                {/* Mobile : le sélecteur ⌄ (et son « Créer ») est masqué → l'option vit ici. */}
                {isMobile && (
                  <>
                    <button className="wl-menu-item" onClick={() => { setDotsMenu(false); setAddingList(true); }}>＋ Créer une nouvelle liste</button>
                    <div className="wl-menu-sep" />
                  </>
                )}
                <button className="wl-menu-item" onClick={() => { setDotsMenu(false); setEditingName(true); }}>Renommer</button>
                <button className="wl-menu-item" onClick={() => { setDotsMenu(false); setAddingSection(true); }}>Ajouter une section</button>
                <button
                  className="wl-menu-item"
                  onClick={() => {
                    setDotsMenu(false);
                    if (cur.items.length === 0) return;
                    if (confirm(`Vider « ${cur.name} » ? Ses ${cur.items.length} lignes seront retirées.`)) clearList();
                  }}
                >
                  Effacer la liste
                </button>
                <button
                  className="wl-menu-item wl-menu-danger"
                  disabled={collections.length <= 1}
                  title={collections.length <= 1 ? "La dernière collection ne peut pas être supprimée" : undefined}
                  onClick={() => {
                    setDotsMenu(false);
                    if (confirm(`Supprimer la collection « ${cur.name} » ? Cette action est définitive et se propage à tes autres appareils.`)) deleteList();
                  }}
                >
                  Supprimer la liste
                </button>
                {/* Mobile : les colonnes optionnelles dépendent de la largeur du volet desktop
                    (état `width`), pas de l'écran → cases inopérantes, retirées pour l'instant. */}
                {!isMobile && (
                  <>
                    <div className="wl-menu-sep" />
                    <div className="wl-menu-label">Colonnes</div>
                    <label className="wl-menu-check"><input type="checkbox" checked={cols.last} onChange={(e) => setColumns({ ...cols, last: e.target.checked })} /> Dernier prix</label>
                    <label className="wl-menu-check"><input type="checkbox" checked={cols.volume} onChange={(e) => setColumns({ ...cols, volume: e.target.checked })} /> Volume</label>
                  </>
                )}
              </div>
            )}
          </div>
          <button className="wl-icon-btn wl-close" title="Fermer" aria-label="Fermer" onClick={onClose}>✕</button>
        </div>
      </div>

      {addingList && (
        <div className="wl-inline-add">
          <input
            autoFocus placeholder="Nom de la nouvelle liste" className="wl-name-input"
            onBlur={(e) => { createList(e.target.value); setAddingList(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { createList((e.target as HTMLInputElement).value); setAddingList(false); }
              if (e.key === "Escape") setAddingList(false);
            }}
          />
        </div>
      )}

      <div className="wl-quick">
        {/* Mobile : TOUTES les collections défilent en chips (le sélecteur ⌄ est masqué) ;
            desktop : pastilles des favoris seulement, comme avant. */}
        {(isMobile ? collections : favorites).map((c) => (
          <button
            key={c.id}
            className={`wl-quick-dot${c.id === cur.id ? " active" : ""}`}
            title={c.name}
            onClick={() => setCurrentId(c.id)}
          >
            {isMobile ? c.name : c.name.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>

      <div className="wl-cols">
        <span>Symbole</span>
        <div className="wl-cols-right">
          {effCols.last && <span className="wl-colh">Dernier</span>}
          {effCols.volume && <span className="wl-colh">Volume</span>}
          <button className="wl-col-chg" onClick={cycleSort} title="Trier par variation">
            Chg%{sortDir !== "none" && <span>{sortDir === "desc" ? "▼" : "▲"}</span>}
          </button>
        </div>
      </div>

      <div className="wl-body">{body}</div>

      <WatchlistDetail symbol={currentSymbol} />

      {secMenu && (
        <div
          className="wl-menu wl-ctx"
          style={{ position: "fixed", top: secMenu.y, right: window.innerWidth - secMenu.x }}
        >
          <button className="wl-menu-item" onClick={() => { setEditingSectionId(secMenu.id); setSecMenu(null); }}>Renommer</button>
          <button className="wl-menu-item" onClick={() => { removeSection(secMenu.id); setSecMenu(null); }}>Supprimer</button>
        </div>
      )}

      {flagMenu?.pastille && (
        <div className="wl-flag-pastille" style={{ position: "fixed", top: flagMenu.y, left: flagMenu.x }}>
          {FLAG_COLORS.map((c) => {
            const actif = cur.items.find((i) => i.id === flagMenu.id)?.flag === c;
            return (
              <button
                key={c} className={`wl-flag-sw${actif ? " sel" : ""}`} style={{ background: c }}
                title="Couleur de l'étiquette" aria-label={`Couleur ${c}`}
                onClick={() => { setFlag(flagMenu.id, c); setLastFlag(c); setFlagMenu(null); }}
              />
            );
          })}
        </div>
      )}
      {flagMenu && !flagMenu.pastille && (
        <div className="wl-menu wl-ctx wl-flag-menu" style={{ position: "fixed", top: flagMenu.y, right: window.innerWidth - flagMenu.x }}>
          <div className="wl-flag-swatches">
            {FLAG_COLORS.map((c) => (
              <button key={c} className="wl-flag-sw" style={{ background: c }} title="Marquer" onClick={() => { setFlag(flagMenu.id, c); setLastFlag(c); setFlagMenu(null); }} />
            ))}
          </div>
          <button className="wl-menu-item" onClick={() => { setFlag(flagMenu.id, null); setFlagMenu(null); }}>Retirer le marqueur</button>
        </div>
      )}

      {addOpen && <SymbolSearch mode="add" onAdd={addSymbol} currentSymbol={currentSymbol} onClose={() => setAddOpen(false)} />}
    </aside>
  );
}
