import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  loadCollections, saveCollections, newSection, newSymbolItem, newCollection,
  type Collection,
} from "../lib/collections";
import SymbolSearch from "./SymbolSearch";

interface Props {
  onClose: () => void;
  onSelectSymbol: (s: string) => void;
  currentSymbol: string;
}

export default function WatchlistPanel({ onClose, onSelectSymbol, currentSymbol }: Props) {
  const [collections, setCollections] = useState<Collection[]>(() => loadCollections());
  const [currentId, setCurrentId] = useState<string>(() => collections[0].id);
  const [nameMenu, setNameMenu] = useState(false);
  const [dotsMenu, setDotsMenu] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [addingSection, setAddingSection] = useState(false);
  const [addingList, setAddingList] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [addOpen, setAddOpen] = useState(false);
  const [secMenu, setSecMenu] = useState<{ id: string; x: number; y: number } | null>(null);

  useEffect(() => saveCollections(collections), [collections]);

  // Ferme les menus au clic en dehors.
  useEffect(() => {
    if (!nameMenu && !dotsMenu && !secMenu) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".wl-menu, .wl-title, .wl-dots-wrap")) {
        setNameMenu(false);
        setDotsMenu(false);
        setSecMenu(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [nameMenu, dotsMenu, secMenu]);

  const cur = collections.find((c) => c.id === currentId) ?? collections[0];
  const favorites = collections.filter((c) => c.favorite);

  const updateCur = (fn: (c: Collection) => Collection) =>
    setCollections((prev) => prev.map((c) => (c.id === cur.id ? fn(c) : c)));
  const rename = (name: string) => { if (name.trim()) updateCur((c) => ({ ...c, name: name.trim() })); };
  const addSectionItem = (name: string) => { if (name.trim()) updateCur((c) => ({ ...c, items: [...c.items, newSection(name.trim())] })); };
  const addSymbol = (sym: string) => updateCur((c) => ({ ...c, items: [...c.items, newSymbolItem(sym)] }));
  const removeItem = (id: string) => updateCur((c) => ({ ...c, items: c.items.filter((it) => it.id !== id) }));
  const toggleFav = (id: string) => setCollections((prev) => prev.map((c) => (c.id === id ? { ...c, favorite: !c.favorite } : c)));
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
  for (const item of cur.items) {
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
          <button className="wl-row-main" onClick={() => onSelectSymbol(sym)} title={`Afficher ${sym}`}>
            <span className="wl-sym">{sym}</span>
          </button>
          <button className="wl-remove" title="Retirer de la collection" onClick={() => removeItem(item.id)}>−</button>
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
    <aside className="wl-panel">
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
                  <div key={c.id} className={`wl-menu-coll${c.id === cur.id ? " active" : ""}`}>
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
                <button className="wl-menu-item" onClick={() => { setDotsMenu(false); setEditingName(true); }}>Renommer</button>
                <button className="wl-menu-item" onClick={() => { setDotsMenu(false); setAddingSection(true); }}>Ajouter une section</button>
                <button className="wl-menu-item" onClick={() => setDotsMenu(false)}>Effacer la liste</button>
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
        {favorites.map((c) => (
          <button
            key={c.id}
            className={`wl-quick-dot${c.id === cur.id ? " active" : ""}`}
            title={c.name}
            onClick={() => setCurrentId(c.id)}
          >
            {c.name.charAt(0).toUpperCase()}
          </button>
        ))}
      </div>

      <div className="wl-cols">
        <span>Symbole</span>
      </div>

      <div className="wl-body">{body}</div>

      {secMenu && (
        <div
          className="wl-menu wl-ctx"
          style={{ position: "fixed", top: secMenu.y, right: window.innerWidth - secMenu.x }}
        >
          <button className="wl-menu-item" onClick={() => { setEditingSectionId(secMenu.id); setSecMenu(null); }}>Renommer</button>
          <button className="wl-menu-item" onClick={() => { removeSection(secMenu.id); setSecMenu(null); }}>Supprimer</button>
        </div>
      )}

      {addOpen && <SymbolSearch mode="add" onAdd={addSymbol} currentSymbol={currentSymbol} onClose={() => setAddOpen(false)} />}
    </aside>
  );
}
