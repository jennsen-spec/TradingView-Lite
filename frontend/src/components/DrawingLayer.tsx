import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle, Time } from "../lib/indicators";
import { rgba, visibleForInterval, LINE_STYLES } from "../lib/indicatorSettings";
import { fmtTimeByInterval } from "../lib/timeFormat";
import {
  type Drawing, type DPoint, type DrawingStyle,
  newTrend, newVline, newChannel, newBrush, newFib, applyDrawingDefault, genDrawingId, loadDrawings, saveDrawings, distToSegment,
} from "../lib/drawings";
import { defaultOrFactoryFib } from "../lib/fibTemplates";

// Prix sur la droite de base (p0→p1) au temps `time` (interpolation linéaire).
const basePriceAt = (p0: DPoint, p1: DPoint, time: number) =>
  p1.time === p0.time ? p0.price : p0.price + (p1.price - p0.price) * ((time - p0.time) / (p1.time - p0.time));
import DrawingToolbar, { type Tool } from "./DrawingToolbar";
import DrawingContextBar from "./DrawingContextBar";
import DrawingOptions from "./DrawingOptions";
import FibOptions from "./FibOptions";

const tsOf = (t: Time) => (typeof t === "number" ? t : Date.parse(t) / 1000);

const HANDLE_HIT = 9; // rayon (px) de capture d'une extrémité
const SEG_HIT = 6; // distance (px) de capture d'un segment
const dashOf = (k: string) => LINE_STYLES.find((l) => l.key === k)?.dash || "";

// Durée lisible (temps réel écoulé) : « 3 j 4 h », « 5 h 12 min », « 42 min », « 30 s ».
function fmtDuration(sec: number): string {
  sec = Math.round(sec);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const min = Math.floor((sec % 3600) / 60);
  if (d >= 1) return h ? `${d} j ${h} h` : `${d} j`;
  if (h >= 1) return min ? `${h} h ${min} min` : `${h} h`;
  if (min >= 1) return `${min} min`;
  return `${sec} s`;
}

interface PaneBox { top: number; height: number; }

interface Props {
  symbol: string;
  interval: string;
  candles: Candle[];
  wrapRef: React.RefObject<HTMLDivElement | null>;
  chartRef: React.MutableRefObject<IChartApi | null>;
  seriesRef: React.MutableRefObject<Record<string, ISeriesApi<any>>>;
  layout: PaneBox[];
  layoutRef: React.MutableRefObject<PaneBox[]>;
}

interface PxPt { x: number; y: number; }
interface Hit { id: string; part: "end" | "endp" | "seg" | "width" | "baseh"; endIdx?: number; }
interface DragState {
  mode: "move" | "end" | "endp" | "width" | "baseh";
  endIdx?: number;
  ids: string[];
  startTime: number;
  startPrice: number;
  pane: number; // panneau du dessin manipulé (verrouille la conversion pendant le drag)
  orig: Record<string, DPoint[]>;
  origOffset?: number; // canal : offset initial (pour le drag de largeur)
}

export default function DrawingLayer({
  symbol, interval, candles, wrapRef, chartRef, seriesRef, layout, layoutRef,
}: Props) {
  const [drawings, setDrawings] = useState<Drawing[]>(() => loadDrawings(symbol));
  const [activeTool, setActiveTool] = useState<Tool>("cursor");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draft, setDraft] = useState<{ p0: DPoint; p1: DPoint; pane: number } | null>(null);
  // Canal (#34) : tracé en 3 clics (base p0→p1, puis largeur au 3e clic).
  const [chanDraft, setChanDraft] = useState<{ p0: DPoint; p1: DPoint | null; cursor: DPoint; pane: number } | null>(null);
  // Surligneur (#35) : tracé à main levée (drag).
  const [brushDraft, setBrushDraft] = useState<DPoint[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const [optionsId, setOptionsId] = useState<string | null>(null);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  const [chartMenu, setChartMenu] = useState<{ x: number; y: number } | null>(null); // menu clic droit (#36)

  // Refs miroir (les écouteurs natifs, attachés une fois, lisent l'état courant).
  const drawingsRef = useRef(drawings); drawingsRef.current = drawings;
  const chartMenuRef = useRef(chartMenu); chartMenuRef.current = chartMenu;
  const toolRef = useRef(activeTool); toolRef.current = activeTool;
  const selRef = useRef(selectedIds); selRef.current = selectedIds;
  const draftRef = useRef(draft); draftRef.current = draft;
  const chanDraftRef = useRef(chanDraft); chanDraftRef.current = chanDraft;
  const brushDraftRef = useRef(brushDraft); brushDraftRef.current = brushDraft;
  const brushingRef = useRef<{ lastX: number; lastY: number } | null>(null);
  const brushPaneRef = useRef(0); // panneau du surligneur en cours de tracé
  const intervalRef = useRef(interval); intervalRef.current = interval;
  const dragRef = useRef<DragState | null>(null);
  const optionsSnapRef = useRef<Drawing | null>(null);
  const clipboardRef = useRef<Drawing[]>([]); // copier/coller
  // Historique (undo/redo) : piles de snapshots de `drawings`.
  const undoRef = useRef<Drawing[][]>([]);
  const redoRef = useRef<Drawing[][]>([]);
  const optionsCommittedRef = useRef(false); // 1 seule entrée d'historique par session de réglages
  const pushUndo = () => {
    undoRef.current.push(drawingsRef.current);
    if (undoRef.current.length > 100) undoRef.current.shift();
    redoRef.current = [];
  };
  const undo = () => {
    if (!undoRef.current.length) return;
    redoRef.current.push(drawingsRef.current);
    setDrawings(undoRef.current.pop()!);
    setSelectedIds([]);
  };
  const redo = () => {
    if (!redoRef.current.length) return;
    undoRef.current.push(drawingsRef.current);
    setDrawings(redoRef.current.pop()!);
    setSelectedIds([]);
  };

  // Temps des bougies (secondes) pour l'interpolation temps <-> logical (ancrage cross-intervalle).
  const candleTimes = useMemo(() => candles.map((c) => tsOf(c.time)), [candles]);
  const candleTimesRef = useRef(candleTimes); candleTimesRef.current = candleTimes;

  // Persistance par symbole (symbole constant pour l'instance grâce à key={symbol} côté Chart).
  useEffect(() => { saveDrawings(symbol, drawings); }, [symbol, drawings]);

  useEffect(() => { setSlot(document.getElementById("draw-toolbar-slot")); }, []);

  // Curseur croix quand un outil de dessin est actif.
  useEffect(() => {
    const w = wrapRef.current;
    if (w) w.style.cursor = activeTool === "cursor" ? "" : "crosshair";
    return () => { if (w) w.style.cursor = ""; };
  }, [activeTool, wrapRef]);

  // --- Conversions temps<->logical (interpolation) puis logical<->pixel (continu, hors-écran) ---
  const timeToLogical = (time: number): number => {
    const t = candleTimesRef.current; const n = t.length;
    if (n === 0) return 0;
    if (time <= t[0]) { const sp = n > 1 ? t[1] - t[0] : 86400; return (time - t[0]) / (sp || 1); }
    if (time >= t[n - 1]) { const sp = n > 1 ? t[n - 1] - t[n - 2] : 86400; return n - 1 + (time - t[n - 1]) / (sp || 1); }
    let lo = 0, hi = n - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (t[mid] <= time) lo = mid; else hi = mid; }
    const span = t[hi] - t[lo] || 1;
    return lo + (time - t[lo]) / span;
  };
  const logicalToTime = (logical: number): number => {
    const t = candleTimesRef.current; const n = t.length;
    if (n === 0) return 0;
    if (logical <= 0) { const sp = n > 1 ? t[1] - t[0] : 86400; return t[0] + logical * sp; }
    if (logical >= n - 1) { const sp = n > 1 ? t[n - 1] - t[n - 2] : 86400; return t[n - 1] + (logical - (n - 1)) * sp; }
    const i = Math.floor(logical); const frac = logical - i;
    return t[i] + (t[i + 1] - t[i]) * frac;
  };

  // logical (fractionnaire) -> x. NB: LWC logicalToCoordinate ne gère QUE les logicals ENTIERS
  // (il renvoie 0 pour un fractionnaire) → on interpole entre les deux entiers voisins.
  const logicalToX = (logical: number): number | null => {
    const ts = chartRef.current?.timeScale();
    if (!ts) return null;
    const lo = Math.floor(logical);
    const xLo = ts.logicalToCoordinate(lo as any);
    const xHi = ts.logicalToCoordinate((lo + 1) as any);
    if (xLo == null || xHi == null) return null;
    return (xLo as number) + (logical - lo) * ((xHi as number) - (xLo as number));
  };

  // Série servant d'échelle de prix pour un panneau (0=prix, 1=volume, 2=RSI).
  const PANE_SERIES = ["candle", "volume", "rsi", "atr"];
  const seriesForPane = (pane: number) => seriesRef.current[PANE_SERIES[pane] ?? "candle"] ?? seriesRef.current.candle;
  // Panneau contenant l'ordonnée `yWrap` (relative au wrap) ; clampe au 1er/dernier hors zone.
  const paneAtY = (yWrap: number): number => {
    const boxes = layoutRef.current;
    if (!boxes.length) return 0;
    for (let i = 0; i < boxes.length; i++) {
      const b = boxes[i];
      if (yWrap >= b.top && yWrap <= b.top + b.height) return i;
    }
    return yWrap < boxes[0].top ? 0 : boxes.length - 1;
  };

  // Point de données -> pixel, dans le panneau `pane` (défaut = prix).
  const dataToPx = (pt: DPoint, pane = 0): PxPt | null => {
    const s = seriesForPane(pane); const box = layoutRef.current[pane];
    if (!s || !box) return null;
    const x = logicalToX(timeToLogical(pt.time));
    const y = s.priceToCoordinate(pt.price);
    if (x == null || y == null) return null;
    return { x, y: (y as number) + box.top };
  };
  // Pixel -> point de données + panneau. `forcePane` verrouille le panneau (tracé/drag en cours).
  const pxToData = (clientX: number, clientY: number, forcePane?: number): (DPoint & { pane: number }) | null => {
    const wrap = wrapRef.current; const c = chartRef.current;
    if (!wrap || !c) return null;
    const rect = wrap.getBoundingClientRect();
    const yWrap = clientY - rect.top;
    const pane = forcePane != null ? forcePane : paneAtY(yWrap);
    const box = layoutRef.current[pane]; const s = seriesForPane(pane);
    if (!box || !s) return null;
    const yInPane = Math.max(0, Math.min(yWrap - box.top, box.height));
    const price = s.coordinateToPrice(yInPane);
    const logical = c.timeScale().coordinateToLogical(clientX - rect.left);
    if (price == null || logical == null) return null;
    return { time: logicalToTime(logical as number), price: price as number, pane };
  };

  // Hit-test (extrémités puis segment), du plus récent au plus ancien.
  const hitTest = (clientX: number, clientY: number): Hit | null => {
    const wrap = wrapRef.current; if (!wrap) return null;
    const rect = wrap.getBoundingClientRect();
    const mx = clientX - rect.left, my = clientY - rect.top;
    const list = drawingsRef.current;
    for (let i = list.length - 1; i >= 0; i--) {
      const d = list[i];
      if (!visibleForInterval(intervalRef.current, d.visibility)) continue;
      if (d.type === "vline") {
        const x = logicalToX(timeToLogical(d.points[0].time));
        if (x != null && Math.abs(mx - x) <= SEG_HIT) return { id: d.id, part: "seg" };
        continue;
      }
      if (d.type === "brush") {
        const pts = d.points.map((p) => dataToPx(p, d.pane));
        const thr = (d.style.width ?? 20) / 2 + 3;
        for (let k = 0; k + 1 < pts.length; k++) {
          const p = pts[k], q = pts[k + 1];
          if (p && q && distToSegment(mx, my, p.x, p.y, q.x, q.y) <= thr) return { id: d.id, part: "seg" };
        }
        continue;
      }
      if (d.type === "fib") {
        const fib = d.fib;
        const a = dataToPx(d.points[0], d.pane); const b = dataToPx(d.points[1], d.pane);
        if (!a || !b || !fib) continue;
        if (Math.hypot(mx - a.x, my - a.y) <= HANDLE_HIT) return { id: d.id, part: "end", endIdx: 0 };
        if (Math.hypot(mx - b.x, my - b.y) <= HANDLE_HIT) return { id: d.id, part: "end", endIdx: 1 };
        // Boîte des niveaux → déplacement.
        const base0 = fib.reverse ? d.points[0].price : d.points[1].price;
        const base1 = fib.reverse ? d.points[1].price : d.points[0].price;
        const ys = fib.levels.filter((l) => l.on)
          .map((l) => dataToPx({ time: d.points[0].time, price: base0 + (base1 - base0) * l.ratio }, d.pane)?.y)
          .filter((y): y is number => y != null);
        if (ys.length) {
          const left = Math.min(a.x, b.x), right = Math.max(a.x, b.x);
          if (mx >= left - SEG_HIT && mx <= right + SEG_HIT && my >= Math.min(...ys) - SEG_HIT && my <= Math.max(...ys) + SEG_HIT) return { id: d.id, part: "seg" };
        }
        continue;
      }
      if (d.type === "channel") {
        const off = d.channelOffset ?? 0;
        const a = dataToPx(d.points[0], d.pane); const b = dataToPx(d.points[1], d.pane);
        const a2 = dataToPx({ time: d.points[0].time, price: d.points[0].price + off }, d.pane);
        const b2 = dataToPx({ time: d.points[1].time, price: d.points[1].price + off }, d.pane);
        if (!a || !b || !a2 || !b2) continue;
        // Poignées milieu = hauteur (une par côté). Prioritaires sur les segments.
        const mx2 = (a2.x + b2.x) / 2, my2 = (a2.y + b2.y) / 2; // parallèle
        const mxB = (a.x + b.x) / 2, myB = (a.y + b.y) / 2; // base
        if (Math.hypot(mx - mx2, my - my2) <= HANDLE_HIT) return { id: d.id, part: "width" };
        if (Math.hypot(mx - mxB, my - myB) <= HANDLE_HIT) return { id: d.id, part: "baseh" };
        // 4 coins : base (p0/p1) et parallèle (p0'/p1') → reshape de l'extrémité, offset conservé.
        if (Math.hypot(mx - a.x, my - a.y) <= HANDLE_HIT) return { id: d.id, part: "end", endIdx: 0 };
        if (Math.hypot(mx - b.x, my - b.y) <= HANDLE_HIT) return { id: d.id, part: "end", endIdx: 1 };
        if (Math.hypot(mx - a2.x, my - a2.y) <= HANDLE_HIT) return { id: d.id, part: "endp", endIdx: 0 };
        if (Math.hypot(mx - b2.x, my - b2.y) <= HANDLE_HIT) return { id: d.id, part: "endp", endIdx: 1 };
        // Corps des segments (base ou parallèle) = déplacement du canal, sans l'écarter.
        if (distToSegment(mx, my, a.x, a.y, b.x, b.y) <= SEG_HIT || distToSegment(mx, my, a2.x, a2.y, b2.x, b2.y) <= SEG_HIT) return { id: d.id, part: "seg" };
        continue;
      }
      const a = dataToPx(d.points[0], d.pane); const b = dataToPx(d.points[1], d.pane);
      if (!a || !b) continue;
      if (Math.hypot(mx - a.x, my - a.y) <= HANDLE_HIT) return { id: d.id, part: "end", endIdx: 0 };
      if (Math.hypot(mx - b.x, my - b.y) <= HANDLE_HIT) return { id: d.id, part: "end", endIdx: 1 };
      if (distToSegment(mx, my, a.x, a.y, b.x, b.y) <= SEG_HIT) return { id: d.id, part: "seg" };
    }
    return null;
  };

  const snapshot = (ids: string[]): Record<string, DPoint[]> => {
    const out: Record<string, DPoint[]> = {};
    for (const id of ids) {
      const d = drawingsRef.current.find((x) => x.id === id);
      if (d) out[id] = d.points.map((p) => ({ ...p }));
    }
    return out;
  };

  // --- Écouteurs natifs (attachés une fois) ---
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const inUi = (t: EventTarget | null) =>
      !!(t as HTMLElement)?.closest?.(".draw-ctxbar, .color-pop, .is-modal, .draw-toolbar, .draw-chart-menu, .draw-modal-backdrop");

    // Ouvre les paramètres d'un dessin donné.
    const openOptionsFor = (id: string) => {
      const d = drawingsRef.current.find((x) => x.id === id);
      if (!d) return;
      setSelectedIds([id]);
      optionsSnapRef.current = d;
      optionsCommittedRef.current = false;
      setOptionsId(id);
    };
    // Double-clic sur un dessin → ouvre ses paramètres.
    const onDbl = (e: MouseEvent) => {
      if (inUi(e.target)) return;
      const hit = hitTest(e.clientX, e.clientY);
      if (!hit) return;
      e.preventDefault(); e.stopPropagation();
      openOptionsFor(hit.id);
    };

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // droit → contextmenu
      // Shift : contrainte horizontale PENDANT un tracé ; hors tracé (mode curseur) → mesure #27.
      const drawingNow = toolRef.current !== "cursor" || !!draftRef.current || !!chanDraftRef.current;
      if (e.shiftKey && !drawingNow) return;
      if (inUi(e.target)) return; // clic sur l'UI dessins : ne pas intercepter
      if (chartMenuRef.current) setChartMenu(null); // un clic ailleurs ferme le menu contextuel

      const tool = toolRef.current;
      // Mode dessin 2 points (Trait / Flèche / Fibonacci) : 1er clic démarre, 2e clic finalise.
      if (tool === "trend" || tool === "arrow" || tool === "fib") {
        const dr = draftRef.current;
        // 2e clic : on verrouille le panneau du 1er point pour rester dans le même sous-graphe.
        const raw = pxToData(e.clientX, e.clientY, dr ? dr.pane : undefined);
        if (!raw) return;
        e.preventDefault(); e.stopPropagation();
        // Shift pendant le tracé → 2e point au prix du 1er (ligne horizontale).
        const pt = e.shiftKey && dr ? { ...raw, price: dr.p0.price } : raw;
        if (!dr) { setDraft({ p0: pt, p1: pt, pane: pt.pane }); }
        else {
          let d: Drawing;
          if (tool === "fib") {
            d = newFib(dr.p0, pt, dr.pane);
            d = { ...d, fib: defaultOrFactoryFib() }; // applique le thème par défaut s'il existe
          } else {
            d = applyDrawingDefault(newTrend(dr.p0, pt, tool === "arrow" ? "arrow" : "normal", dr.pane));
            if (tool === "arrow") d = { ...d, style: { ...d.style, rightCap: "arrow" } }; // l'outil Flèche impose l'embout
          }
          pushUndo();
          setDrawings((prev) => [...prev, d]);
          setDraft(null);
          setActiveTool("cursor");
          setSelectedIds([d.id]);
        }
        return;
      }
      // Trait vertical : 1 clic pose la ligne.
      if (tool === "vline") {
        const pt = pxToData(e.clientX, e.clientY);
        if (!pt) return;
        e.preventDefault(); e.stopPropagation();
        const d = applyDrawingDefault(newVline(pt.time, pt.pane));
        pushUndo();
        setDrawings((prev) => [...prev, d]);
        setActiveTool("cursor");
        setSelectedIds([d.id]);
        return;
      }
      // Surligneur : main levée — appuyer + glisser.
      if (tool === "brush") {
        const pt = pxToData(e.clientX, e.clientY);
        if (!pt) return;
        e.preventDefault(); e.stopPropagation();
        brushingRef.current = { lastX: e.clientX, lastY: e.clientY };
        brushPaneRef.current = pt.pane; // tout le tracé reste dans ce panneau
        setBrushDraft([pt]);
        return;
      }
      // (le surligneur est finalisé au mouseup)
      // Canal : 3 clics (début base, fin base, largeur).
      if (tool === "channel") {
        const cd = chanDraftRef.current;
        const raw = pxToData(e.clientX, e.clientY, cd ? cd.pane : undefined);
        if (!raw) return;
        e.preventDefault(); e.stopPropagation();
        // Shift pendant le tracé de la base → base horizontale (2e point au prix du 1er).
        const pt = e.shiftKey && cd && cd.p1 === null ? { ...raw, price: cd.p0.price } : raw;
        if (!cd) { setChanDraft({ p0: pt, p1: null, cursor: pt, pane: pt.pane }); }
        else if (cd.p1 === null) { setChanDraft({ p0: cd.p0, p1: pt, cursor: pt, pane: cd.pane }); }
        else {
          const offset = pt.price - basePriceAt(cd.p0, cd.p1, pt.time);
          const d = applyDrawingDefault(newChannel(cd.p0, cd.p1, offset, cd.pane));
          pushUndo();
          setDrawings((prev) => [...prev, d]);
          setChanDraft(null);
          setActiveTool("cursor");
          setSelectedIds([d.id]);
        }
        return;
      }

      // Mode curseur : sélection / drag.
      const hit = hitTest(e.clientX, e.clientY);
      if (!hit) { if (selRef.current.length) setSelectedIds([]); return; } // vide → pan autorisé

      e.preventDefault(); e.stopPropagation();
      const multi = e.metaKey || e.ctrlKey;
      let sel = selRef.current;
      if (multi) {
        sel = sel.includes(hit.id) ? sel.filter((x) => x !== hit.id) : [...sel, hit.id];
        setSelectedIds(sel);
        return;
      }
      if (!sel.includes(hit.id)) { sel = [hit.id]; setSelectedIds(sel); }

      const target = drawingsRef.current.find((d) => d.id === hit.id);
      const pane = target?.pane ?? 0;
      const pt = pxToData(e.clientX, e.clientY, pane); // conversion dans le panneau du dessin
      if (!pt || !target || target.locked) return;
      pushUndo(); // le déplacement/reshape qui suit = 1 entrée d'historique
      if (hit.part === "width" || hit.part === "baseh") {
        dragRef.current = { mode: hit.part, ids: [hit.id], startTime: pt.time, startPrice: pt.price, pane, orig: snapshot([hit.id]), origOffset: target.channelOffset };
      } else if (hit.part === "endp") {
        dragRef.current = { mode: "endp", endIdx: hit.endIdx, ids: [hit.id], startTime: pt.time, startPrice: pt.price, pane, orig: snapshot([hit.id]), origOffset: target.channelOffset };
      } else if (hit.part === "end" && sel.length <= 1) {
        dragRef.current = { mode: "end", endIdx: hit.endIdx, ids: [hit.id], startTime: pt.time, startPrice: pt.price, pane, orig: snapshot([hit.id]) };
      } else {
        const ids = sel.filter((id) => { const d = drawingsRef.current.find((x) => x.id === id); return d && !d.locked; });
        dragRef.current = { mode: "move", ids, startTime: pt.time, startPrice: pt.price, pane, orig: snapshot(ids) };
      }
      setDragging(true);
    };

    const onMove = (e: MouseEvent) => {
      const br = brushingRef.current;
      if (br) {
        if (Math.hypot(e.clientX - br.lastX, e.clientY - br.lastY) > 4) {
          const pt = pxToData(e.clientX, e.clientY, brushPaneRef.current);
          if (pt) { brushingRef.current = { lastX: e.clientX, lastY: e.clientY }; setBrushDraft((prev) => (prev ? [...prev, pt] : [pt])); }
        }
        return;
      }
      const dr = draftRef.current;
      if (dr) { const raw = pxToData(e.clientX, e.clientY, dr.pane); if (raw) setDraft({ ...dr, p1: e.shiftKey ? { ...raw, price: dr.p0.price } : raw }); return; }
      const cd = chanDraftRef.current;
      if (cd) { const raw = pxToData(e.clientX, e.clientY, cd.pane); if (raw) { const pt = e.shiftKey && cd.p1 === null ? { ...raw, price: cd.p0.price } : raw; setChanDraft({ ...cd, cursor: pt }); } return; }
      const dg = dragRef.current;
      if (!dg) return;
      const pt = pxToData(e.clientX, e.clientY, dg.pane); if (!pt) return;
      const dT = pt.time - dg.startTime; const dP = pt.price - dg.startPrice;
      setDrawings((prev) => prev.map((d) => {
        if (!dg.ids.includes(d.id)) return d;
        const orig = dg.orig[d.id]; if (!orig) return d;
        if (dg.mode === "width") {
          // Poignée milieu du parallèle : déplace le parallèle (base fixe) → règle l'offset.
          return { ...d, channelOffset: pt.price - basePriceAt(orig[0], orig[1], pt.time) };
        }
        if (dg.mode === "baseh") {
          // Poignée milieu de la base : déplace la base vers le curseur, parallèle fixe.
          const delta = pt.price - basePriceAt(orig[0], orig[1], pt.time);
          return {
            ...d,
            points: orig.map((p) => ({ time: p.time, price: p.price + delta })),
            channelOffset: (dg.origOffset ?? 0) - delta,
          };
        }
        if (dg.mode === "endp") {
          // Coin parallèle : déplace l'extrémité de base pour que le coin suive le curseur, offset conservé.
          const off = dg.origOffset ?? 0;
          return { ...d, points: orig.map((p, idx) => (idx === dg.endIdx ? { time: pt.time, price: pt.price - off } : { ...p })) };
        }
        if (dg.mode === "end") {
          return { ...d, points: orig.map((p, idx) => (idx === dg.endIdx ? { time: pt.time, price: pt.price } : { ...p })) };
        }
        return { ...d, points: orig.map((p) => ({ time: p.time + dT, price: p.price + dP })) };
      }));
    };

    const onUp = () => {
      if (brushingRef.current) {
        brushingRef.current = null;
        const pts = brushDraftRef.current ?? [];
        setBrushDraft(null);
        setActiveTool("cursor");
        if (pts.length >= 2) {
          const d = applyDrawingDefault(newBrush(pts, brushPaneRef.current));
          pushUndo();
          setDrawings((prev) => [...prev, d]);
          setSelectedIds([d.id]);
        }
        return;
      }
      if (dragRef.current) { dragRef.current = null; setDragging(false); }
    };

    const onContext = (e: MouseEvent) => {
      if (inUi(e.target)) return;
      const hit = hitTest(e.clientX, e.clientY);
      if (hit) {
        // Clic droit sur un dessin → le sélectionne (barre contextuelle).
        e.preventDefault();
        const multi = e.metaKey || e.ctrlKey;
        const sel = selRef.current;
        if (!sel.includes(hit.id)) setSelectedIds(multi ? [...sel, hit.id] : [hit.id]);
        return;
      }
      // Clic droit dans le vide → menu « Supprimer N dessins » (#36), si ≥1 dessin supprimable.
      const deletable = drawingsRef.current.filter((d) => !d.locked).length;
      if (deletable === 0) return;
      e.preventDefault();
      const wrap = wrapRef.current;
      if (!wrap) return;
      const rect = wrap.getBoundingClientRect();
      setChartMenu({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    };

    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA")) return;
      const mod = e.metaKey || e.ctrlKey;
      // Annuler / Rétablir (dessins).
      if (mod && (e.key === "z" || e.key === "Z") && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (mod && ((e.key === "y" || e.key === "Y") || ((e.key === "z" || e.key === "Z") && e.shiftKey))) { e.preventDefault(); redo(); return; }
      // Copier la sélection.
      if (mod && (e.key === "c" || e.key === "C")) {
        const sel = selRef.current;
        if (sel.length) {
          clipboardRef.current = drawingsRef.current.filter((d) => sel.includes(d.id)).map((d) => JSON.parse(JSON.stringify(d)));
          e.preventDefault();
        }
        return;
      }
      // Coller : recrée les dessins copiés, décalés (~26 px bas-droite), et les sélectionne.
      if (mod && (e.key === "v" || e.key === "V")) {
        if (!clipboardRef.current.length) return;
        e.preventDefault();
        const chart = chartRef.current;
        let dLogical = 3;
        if (chart) {
          const l1 = chart.timeScale().coordinateToLogical(100 as any);
          const l2 = chart.timeScale().coordinateToLogical(126 as any);
          if (l1 != null && l2 != null) dLogical = (l2 as number) - (l1 as number);
        }
        // Décalage de prix calculé dans le panneau du dessin (RSI ≠ prix ≠ volume).
        const dPriceForPane = (pane: number) => {
          const s = seriesForPane(pane);
          const pA = s?.coordinateToPrice(100), pB = s?.coordinateToPrice(126);
          return pA != null && pB != null ? (pB as number) - (pA as number) : 0;
        };
        const pasted = clipboardRef.current.map((d) => {
          const clone = JSON.parse(JSON.stringify(d)) as Drawing;
          const dPrice = dPriceForPane(clone.pane ?? 0);
          return {
            ...clone,
            id: genDrawingId(),
            locked: false,
            points: clone.points.map((p) => ({ time: logicalToTime(timeToLogical(p.time) + dLogical), price: p.price + dPrice })),
          };
        });
        pushUndo();
        setDrawings((prev) => [...prev, ...pasted]);
        setSelectedIds(pasted.map((p) => p.id));
        clipboardRef.current = pasted.map((p) => JSON.parse(JSON.stringify(p))); // collages successifs en cascade
        return;
      }
      if (e.key === "Escape") {
        if (chartMenuRef.current) setChartMenu(null);
        else if (draftRef.current || chanDraftRef.current || brushingRef.current) {
          brushingRef.current = null; setDraft(null); setChanDraft(null); setBrushDraft(null); setActiveTool("cursor");
        }
        else if (selRef.current.length) setSelectedIds([]);
      } else if ((e.key === "Delete" || e.key === "Backspace") && selRef.current.length) {
        const sel = selRef.current;
        pushUndo();
        setDrawings((prev) => prev.filter((d) => !(sel.includes(d.id) && !d.locked)));
        setSelectedIds([]);
      }
    };

    wrap.addEventListener("mousedown", onDown, { capture: true });
    wrap.addEventListener("dblclick", onDbl, { capture: true });
    wrap.addEventListener("contextmenu", onContext);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("keydown", onKey);
    return () => {
      wrap.removeEventListener("mousedown", onDown, { capture: true } as any);
      wrap.removeEventListener("dblclick", onDbl, { capture: true } as any);
      wrap.removeEventListener("contextmenu", onContext);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Mutations groupées (barre contextuelle) ---
  const styleSelected = (patch: Partial<DrawingStyle>) => {
    const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as Partial<DrawingStyle>;
    pushUndo();
    setDrawings((prev) => prev.map((d) => (selRef.current.includes(d.id) ? { ...d, style: { ...d.style, ...clean } } : d)));
  };
  const toggleLockSelected = () => {
    const sel = selRef.current;
    const lockAll = drawings.some((d) => sel.includes(d.id) && !d.locked); // au moins un déverrouillé → verrouille tout
    pushUndo();
    setDrawings((prev) => prev.map((d) => (sel.includes(d.id) ? { ...d, locked: lockAll } : d)));
  };
  const deleteSelected = () => {
    const sel = selRef.current;
    pushUndo();
    setDrawings((prev) => prev.filter((d) => !(sel.includes(d.id) && !d.locked)));
    setSelectedIds([]);
  };

  const selectTool = (t: Tool) => {
    setActiveTool(t);
    setDraft(null);
    setChanDraft(null);
    setBrushDraft(null);
    brushingRef.current = null;
    if (t !== "cursor") setSelectedIds([]);
  };

  // --- Options (dialogue) ---
  const openOptions = () => {
    const id = [...selectedIds].reverse().find((i) => drawings.some((d) => d.id === i));
    if (!id) return;
    optionsSnapRef.current = drawings.find((d) => d.id === id) ?? null;
    optionsCommittedRef.current = false;
    setOptionsId(id);
  };
  const optionsDrawing = optionsId ? drawings.find((d) => d.id === optionsId) ?? null : null;
  const changeOptions = (nd: Drawing) => {
    if (!optionsCommittedRef.current) { pushUndo(); optionsCommittedRef.current = true; } // 1 entrée par session
    setDrawings((prev) => prev.map((d) => (d.id === nd.id ? nd : d)));
  };
  const cancelOptions = () => {
    const snap = optionsSnapRef.current;
    if (snap) setDrawings((prev) => prev.map((d) => (d.id === snap.id ? snap : d)));
    setOptionsId(null);
  };
  const okOptions = () => setOptionsId(null);

  // --- Rendu SVG (recalculé à chaque render : suit pan/zoom via le tick du parent) ---
  const wrapW = wrapRef.current?.clientWidth ?? 0;
  const wrapH = wrapRef.current?.clientHeight ?? 0;
  const p0 = layout[0];
  // Bas de la pile de panneaux (pour la ligne verticale qui traverse tous les panes).
  const chartBottom = layout.length ? layout[layout.length - 1].top + layout[layout.length - 1].height : wrapH;
  const selectedSet = new Set(selectedIds);

  // Trait vertical (#32) : panneau principal par défaut ; « Prolonger » = traverse tous les panes.
  const paneTop = p0?.top ?? 0;
  const paneBottom = paneTop + (p0?.height ?? chartBottom);
  const renderVline = (d: Drawing) => {
    if (!visibleForInterval(interval, d.visibility)) return null;
    const x = logicalToX(timeToLogical(d.points[0].time));
    if (x == null) return null;
    const s = d.style;
    const col = rgba(s.color, s.opacity);
    // Non coché → panneau des prix uniquement ; coché → toute la hauteur (tous les panes + marges).
    const top = s.extend ? 0 : paneTop;
    const bottom = s.extend ? wrapH : paneBottom;
    const sel = selectedSet.has(d.id);
    return (
      <g key={d.id}>
        <line x1={x} y1={top} x2={x} y2={bottom} stroke={col} strokeWidth={s.width} strokeDasharray={dashOf(s.lineStyle)} />
        {s.timeLabel && (() => {
          const label = fmtTimeByInterval(d.points[0].time, interval, "numeric");
          const w = label.length * 5.7 + 12; // largeur adaptée au texte
          return (
            <g transform={`translate(${x},${bottom - 2})`}>
              <rect x={-w / 2} y={-16} width={w} height={15} rx={3} fill={col} />
              <text x={0} y={-8} textAnchor="middle" dominantBaseline="central" fontSize={10} fill={contrastText(s.color)} style={{ pointerEvents: "none" }}>
                {label}
              </text>
            </g>
          );
        })()}
        {/* Le texte se positionne toujours par rapport au panneau principal (prix), pas au RSI. */}
        {textOnVline(d, x, paneTop, paneBottom)}
        {sel && <circle cx={x} cy={(paneTop + paneBottom) / 2} r={5} className="draw-handle" />}
      </g>
    );
  };

  // Canal parallèle (#34) : 2 bords (base + parallèle) + niveaux optionnels + remplissage.
  const renderChannel = (d: Drawing) => {
    if (!visibleForInterval(interval, d.visibility)) return null;
    const off = d.channelOffset ?? 0;
    const p0 = d.points[0], p1 = d.points[1];
    const a = dataToPx(p0, d.pane), b = dataToPx(p1, d.pane);
    const a2 = dataToPx({ time: p0.time, price: p0.price + off }, d.pane);
    const b2 = dataToPx({ time: p1.time, price: p1.price + off }, d.pane);
    if (!a || !b || !a2 || !b2) return null;
    const s = d.style;
    const col = rgba(s.color, s.opacity);
    const dash = dashOf(s.lineStyle);
    const [A, B] = extendSeg(a, b, !!s.extendLeft, !!s.extendRight, wrapW);
    const [A2, B2] = extendSeg(a2, b2, !!s.extendLeft, !!s.extendRight, wrapW);
    const sel = selectedSet.has(d.id);
    const levelSeg = (L: number) => {
      const la = dataToPx({ time: p0.time, price: p0.price + off * L }, d.pane);
      const lb = dataToPx({ time: p1.time, price: p1.price + off * L }, d.pane);
      if (!la || !lb) return null;
      const [LA, LB] = extendSeg(la, lb, !!s.extendLeft, !!s.extendRight, wrapW);
      return <line key={L} x1={LA.x} y1={LA.y} x2={LB.x} y2={LB.y} stroke={col} strokeWidth={1} strokeDasharray="4 3" opacity={0.65} />;
    };
    return (
      <g key={d.id}>
        {s.bgOn && (
          <polygon points={`${A.x},${A.y} ${B.x},${B.y} ${B2.x},${B2.y} ${A2.x},${A2.y}`} fill={rgba(s.bgColor ?? "#3f8cff", s.bgOpacity ?? 12)} />
        )}
        {(s.levels ?? []).map(levelSeg)}
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={col} strokeWidth={s.width} strokeDasharray={dash} />
        <line x1={A2.x} y1={A2.y} x2={B2.x} y2={B2.y} stroke={col} strokeWidth={s.width} strokeDasharray={dash} />
        {textAlongLine(d, a, b)}
        {sel && (
          <>
            <circle cx={a.x} cy={a.y} r={5} className="draw-handle" />
            <circle cx={b.x} cy={b.y} r={5} className="draw-handle" />
            <circle cx={a2.x} cy={a2.y} r={5} className="draw-handle" />
            <circle cx={b2.x} cy={b2.y} r={5} className="draw-handle" />
            {/* 2 poignées de hauteur (carrés) : milieu de la base et du parallèle. */}
            <rect x={(a.x + b.x) / 2 - 4} y={(a.y + b.y) / 2 - 4} width={8} height={8} rx={1.5} className="draw-handle" />
            <rect x={(a2.x + b2.x) / 2 - 4} y={(a2.y + b2.y) / 2 - 4} width={8} height={8} rx={1.5} className="draw-handle" />
          </>
        )}
      </g>
    );
  };

  // Retracement de Fibonacci : niveaux horizontaux entre 2 prix, étiquettes + bandes ombrées.
  const renderFib = (d: Drawing) => {
    if (!visibleForInterval(interval, d.visibility)) return null;
    const fib = d.fib;
    if (!fib) return null;
    const p0 = d.points[0], p1 = d.points[1];
    const a = dataToPx(p0, d.pane), b = dataToPx(p1, d.pane);
    if (!a || !b) return null;
    const s = d.style;
    const left = Math.min(a.x, b.x);
    const right = fib.extendRight ? wrapW : Math.max(a.x, b.x);
    // niveau 0 = 2e point (p1), niveau 1 = 1er point (p0) ; « Inverse » échange.
    const base0 = fib.reverse ? p0.price : p1.price;
    const base1 = fib.reverse ? p1.price : p0.price;
    const yOf = (r: number) => dataToPx({ time: p0.time, price: base0 + (base1 - base0) * r }, d.pane)?.y ?? null;
    const on = fib.levels.filter((l) => l.on);
    const sel = selectedSet.has(d.id);
    return (
      <g key={d.id}>
        {fib.bgOn && on.slice(0, -1).map((l, i) => {
          const y1 = yOf(l.ratio), y2 = yOf(on[i + 1].ratio);
          if (y1 == null || y2 == null) return null;
          return <rect key={`bg${i}`} x={left} y={Math.min(y1, y2)} width={right - left} height={Math.abs(y2 - y1)} fill={rgba(l.color, fib.bgOpacity)} />;
        })}
        {fib.trendLineOn && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={rgba(s.color, s.opacity)} strokeWidth={1} strokeDasharray="4 3" />}
        {on.map((l, i) => {
          const y = yOf(l.ratio);
          if (y == null) return null;
          return <line key={`ln${i}`} x1={left} y1={y} x2={right} y2={y} stroke={rgba(l.color, s.opacity)} strokeWidth={s.width} strokeDasharray={dashOf(s.lineStyle)} />;
        })}
        {fib.showLabels && on.map((l, i) => {
          const y = yOf(l.ratio);
          if (y == null) return null;
          const price = base0 + (base1 - base0) * l.ratio;
          return (
            <text key={`lb${i}`} x={left - 4} y={y - 2} textAnchor="end" fontSize={fib.fontSize} fill={rgba(l.color, s.opacity)} style={{ pointerEvents: "none" }}>
              {l.ratio} ({price.toFixed(2)})
            </text>
          );
        })}
        {sel && (
          <>
            <circle cx={a.x} cy={a.y} r={5} className="draw-handle" />
            <circle cx={b.x} cy={b.y} r={5} className="draw-handle" />
          </>
        )}
      </g>
    );
  };

  // Aperçu du canal pendant le tracé (3 clics).
  const renderChanDraft = () => {
    if (!chanDraft) return null;
    const pane = chanDraft.pane;
    const a = dataToPx(chanDraft.p0, pane);
    if (!a) return null;
    if (chanDraft.p1 === null) {
      const c = dataToPx(chanDraft.cursor, pane);
      return c ? <line x1={a.x} y1={a.y} x2={c.x} y2={c.y} className="draw-preview" /> : null;
    }
    const b = dataToPx(chanDraft.p1, pane);
    const off = chanDraft.cursor.price - basePriceAt(chanDraft.p0, chanDraft.p1, chanDraft.cursor.time);
    const a2 = dataToPx({ time: chanDraft.p0.time, price: chanDraft.p0.price + off }, pane);
    const b2 = dataToPx({ time: chanDraft.p1.time, price: chanDraft.p1.price + off }, pane);
    if (!b || !a2 || !b2) return null;
    return (
      <>
        <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="draw-preview" />
        <line x1={a2.x} y1={a2.y} x2={b2.x} y2={b2.y} className="draw-preview" />
      </>
    );
  };

  // Mesure d'une flèche (variation % + durée), placée le long du trait.
  const measureLabel = (d: Drawing, a: PxPt, b: PxPt) => {
    const m = d.measure;
    if (d.style.rightCap !== "arrow" || !m) return null;
    const hasDur = m.duration && (m.durTime || m.durBars);
    if (!m.percent && !hasDur) return null;
    const p0 = d.points[0], p1 = d.points[1];

    const lines: string[] = [];
    if (m.percent && p0.price !== 0) {
      const pct = ((p1.price - p0.price) / Math.abs(p0.price)) * 100;
      lines.push(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`);
    }
    if (hasDur) {
      const parts: string[] = [];
      if (m.durTime) parts.push(fmtDuration(Math.abs(p1.time - p0.time)));
      if (m.durBars) {
        const bars = Math.round(Math.abs(timeToLogical(p1.time) - timeToLogical(p0.time)));
        parts.push(`${bars} ${bars <= 1 ? "barre" : "barres"}`);
      }
      if (parts.length) lines.push(parts.join("  ·  "));
    }
    if (!lines.length) return null;

    // Position (le long de la flèche) : haut = extrémité la plus haute, bas = la plus basse.
    const top = a.y <= b.y ? a : b;
    const bot = a.y <= b.y ? b : a;
    const anchor =
      m.position === "top" ? top
        : m.position === "bottom" ? bot
          : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const textAnchor = m.align === "left" ? "start" : m.align === "right" ? "end" : "middle";
    const dy = m.position === "top" ? -8 : m.position === "bottom" ? 8 : 0;
    const baseline = m.position === "top" ? "auto" : m.position === "bottom" ? "hanging" : "central";
    const lineH = 15;
    return (
      <text
        x={anchor.x} y={anchor.y + dy}
        textAnchor={textAnchor} dominantBaseline={baseline}
        fill={rgba(d.style.color, d.style.opacity)} fontSize={12} fontWeight="600"
        stroke="var(--surface)" strokeWidth={3} paintOrder="stroke"
        style={{ pointerEvents: "none", userSelect: "none" }}
      >
        {lines.map((ln, i) => (
          <tspan key={i} x={anchor.x} dy={i === 0 ? 0 : lineH}>{ln}</tspan>
        ))}
      </text>
    );
  };

  const renderTrend = (d: Drawing) => {
    if (!visibleForInterval(interval, d.visibility)) return null;
    const a = dataToPx(d.points[0], d.pane); const b = dataToPx(d.points[1], d.pane);
    if (!a || !b) return null;
    const s = d.style;
    const col = rgba(s.color, s.opacity);
    // Prolongation : étend le tracé jusqu'au bord gauche et/ou droit (indépendants).
    let A = a, B = b;
    const dx = b.x - a.x;
    if (Math.abs(dx) > 1e-6 && (s.extendLeft || s.extendRight)) {
      const slope = (b.y - a.y) / dx;
      const yAt = (x: number) => a.y + slope * (x - a.x);
      const aIsLeft = a.x <= b.x;
      if (s.extendLeft) { if (aIsLeft) A = { x: 0, y: yAt(0) }; else B = { x: 0, y: yAt(0) }; }
      if (s.extendRight) { if (aIsLeft) B = { x: wrapW, y: yAt(wrapW) }; else A = { x: wrapW, y: yAt(wrapW) }; }
    }
    const sel = selectedSet.has(d.id);
    return (
      <g key={d.id}>
        <line x1={A.x} y1={A.y} x2={B.x} y2={B.y} stroke={col} strokeWidth={s.width} strokeDasharray={dashOf(s.lineStyle)} strokeLinecap="round" />
        {s.leftCap === "arrow" && <polygon points={arrowPts(a, b)} fill={col} />}
        {s.rightCap === "arrow" && <polygon points={arrowPts(b, a)} fill={col} />}
        {textAlongLine(d, a, b)}
        {measureLabel(d, a, b)}
        {sel && (
          <>
            <circle cx={a.x} cy={a.y} r={5} className="draw-handle" />
            <circle cx={b.x} cy={b.y} r={5} className="draw-handle" />
          </>
        )}
      </g>
    );
  };

  // Surligneur (#35) : polyligne épaisse semi-transparente.
  const renderBrush = (d: Drawing) => {
    if (!visibleForInterval(interval, d.visibility)) return null;
    const pts = d.points.map((p) => dataToPx(p, d.pane)).filter((p): p is PxPt => !!p);
    if (pts.length < 2) return null;
    const s = d.style;
    const col = rgba(s.color, s.opacity);
    const dstr = "M" + pts.map((p) => `${p.x},${p.y}`).join(" L");
    const sel = selectedSet.has(d.id);
    const first = pts[0], last = pts[pts.length - 1];
    return (
      <g key={d.id}>
        <path d={dstr} fill="none" stroke={col} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
        {sel && (
          <>
            <circle cx={first.x} cy={first.y} r={5} className="draw-handle" />
            <circle cx={last.x} cy={last.y} r={5} className="draw-handle" />
          </>
        )}
      </g>
    );
  };

  const renderBrushDraft = () => {
    if (!brushDraft) return null;
    const pts = brushDraft.map((p) => dataToPx(p, brushPaneRef.current)).filter((p): p is PxPt => !!p);
    if (pts.length < 2) return null;
    const dstr = "M" + pts.map((p) => `${p.x},${p.y}`).join(" L");
    return <path d={dstr} fill="none" stroke={rgba("#3f8cff", 38)} strokeWidth={20} strokeLinecap="round" strokeLinejoin="round" />;
  };

  // Barre contextuelle : ancrée au-dessus du dessin principal (dernier sélectionné).
  let ctx: { left: number; top: number; d: Drawing } | null = null;
  if (selectedIds.length && !optionsId && !draft && !chanDraft && !brushDraft && !dragging) {
    const primaryId = [...selectedIds].reverse().find((i) => drawings.some((d) => d.id === i));
    const d = primaryId ? drawings.find((x) => x.id === primaryId) : null;
    if (d && d.type === "vline") {
      const x = logicalToX(timeToLogical(d.points[0].time));
      if (x != null) {
        ctx = { left: Math.max(4, Math.min(x - 70, wrapW - 150)), top: (p0?.top ?? 0) + 10, d };
      }
    } else if (d && d.type === "channel") {
      // Canal : barre au-dessus du sommet (le plus haut des 4 coins) → ne masque pas les poignées milieu.
      const off = d.channelOffset ?? 0;
      const a = dataToPx(d.points[0], d.pane); const b = dataToPx(d.points[1], d.pane);
      const a2 = dataToPx({ time: d.points[0].time, price: d.points[0].price + off }, d.pane);
      const b2 = dataToPx({ time: d.points[1].time, price: d.points[1].price + off }, d.pane);
      if (a && b && a2 && b2) {
        const xs = [a.x, b.x, a2.x, b2.x], ys = [a.y, b.y, a2.y, b2.y];
        const midX = (Math.min(...xs) + Math.max(...xs)) / 2;
        ctx = {
          left: Math.max(4, Math.min(midX - 70, wrapW - 150)),
          top: Math.max((p0?.top ?? 0) + 4, Math.min(...ys) - 42),
          d,
        };
      }
    } else if (d) {
      const a = dataToPx(d.points[0], d.pane); const b = dataToPx(d.points[1], d.pane);
      if (a && b) {
        const midX = (a.x + b.x) / 2;
        const topY = Math.min(a.y, b.y) - 42;
        ctx = {
          left: Math.max(4, Math.min(midX - 70, wrapW - 150)),
          top: topY < (p0?.top ?? 0) + 2 ? Math.max(a.y, b.y) + 12 : topY,
          d,
        };
      }
    }
  }

  return (
    <>
      {slot && createPortal(<DrawingToolbar active={activeTool} onSelect={selectTool} />, slot)}

      {p0 && (
        <svg className="draw-svg" style={{ pointerEvents: "none" }}>
          <defs>
            {layout.map((box, i) => (
              <clipPath id={`draw-clip-pane${i}`} key={i}>
                <rect x={0} y={box.top} width={wrapW} height={box.height} />
              </clipPath>
            ))}
          </defs>
          {/* Traits / flèches / canaux / surligneur : clippés à LEUR panneau (prix, volume ou RSI). */}
          {layout.map((_box, i) => (
            <g key={i} clipPath={`url(#draw-clip-pane${i})`}>
              {drawings.filter((d) => d.type === "channel" && (d.pane ?? 0) === i).map(renderChannel)}
              {drawings.filter((d) => d.type === "fib" && (d.pane ?? 0) === i).map(renderFib)}
              {drawings.filter((d) => d.type === "brush" && (d.pane ?? 0) === i).map(renderBrush)}
              {drawings.filter((d) => d.type === "trend" && (d.pane ?? 0) === i).map(renderTrend)}
              {draft && draft.pane === i && (() => {
                const a = dataToPx(draft.p0, draft.pane); const b = dataToPx(draft.p1, draft.pane);
                if (!a || !b) return null;
                return <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="draw-preview" />;
              })()}
              {chanDraft && chanDraft.pane === i && renderChanDraft()}
              {brushDraft && brushPaneRef.current === i && renderBrushDraft()}
            </g>
          ))}
          {/* Traits verticaux : pleine hauteur, non clippés. */}
          {drawings.filter((d) => d.type === "vline").map(renderVline)}
        </svg>
      )}

      {ctx && (
        <DrawingContextBar
          left={ctx.left}
          top={ctx.top}
          type={ctx.d.type}
          style={ctx.d.style}
          locked={ctx.d.locked}
          count={selectedIds.length}
          onStyle={styleSelected}
          onToggleLock={toggleLockSelected}
          onOptions={openOptions}
          onDelete={deleteSelected}
        />
      )}

      {optionsDrawing && (
        <>
          {/* Fond bloquant : le panel passe au-dessus de tout et empêche d'agir sur le graphe (redimensionnement des panneaux, etc.). */}
          <div className="draw-modal-backdrop" onMouseDown={(e) => e.stopPropagation()} onClick={okOptions} />
          {optionsDrawing.type === "fib"
            ? <FibOptions drawing={optionsDrawing} onChange={changeOptions} onCancel={cancelOptions} onOk={okOptions} />
            : <DrawingOptions drawing={optionsDrawing} onChange={changeOptions} onCancel={cancelOptions} onOk={okOptions} />}
        </>
      )}

      {chartMenu && (() => {
        const n = drawings.filter((d) => !d.locked).length;
        return (
          <div className="draw-chart-menu" style={{ left: chartMenu.x, top: chartMenu.y }} onMouseDown={(e) => e.stopPropagation()}>
            <button
              className="dcm-item"
              onClick={() => {
                pushUndo();
                setDrawings((prev) => prev.filter((d) => d.locked)); // les verrouillés sont épargnés
                setSelectedIds([]);
                setChartMenu(null);
              }}
            >
              Supprimer {n} dessin{n > 1 ? "s" : ""}
            </button>
          </div>
        );
      })()}
    </>
  );
}

// Étend un segment px jusqu'au bord gauche (x=0) et/ou droit (x=w) selon les cases Prolonger.
function extendSeg(a: PxPt, b: PxPt, left: boolean, right: boolean, w: number): [PxPt, PxPt] {
  let A = a, B = b;
  const dx = b.x - a.x;
  if (Math.abs(dx) > 1e-6 && (left || right)) {
    const slope = (b.y - a.y) / dx;
    const yAt = (x: number) => a.y + slope * (x - a.x);
    const aIsLeft = a.x <= b.x;
    if (left) { if (aIsLeft) A = { x: 0, y: yAt(0) }; else B = { x: 0, y: yAt(0) }; }
    if (right) { if (aIsLeft) B = { x: w, y: yAt(w) }; else A = { x: w, y: yAt(w) }; }
  }
  return [A, B];
}

// Triangle d'embout flèche : pointe en `tip`, orienté depuis `from`.
function arrowPts(tip: PxPt, from: PxPt, size = 11, spread = 6): string {
  const dx = tip.x - from.x, dy = tip.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len, uy = dy / len;
  const bx = tip.x - ux * size, by = tip.y - uy * size;
  const px = -uy, py = ux;
  return `${tip.x},${tip.y} ${bx + px * spread},${by + py * spread} ${bx - px * spread},${by - py * spread}`;
}

// Couleur de texte lisible sur un fond donné (luminance).
function contrastText(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6 ? "#0e1117" : "#ffffff";
}

// Texte d'un trait vertical : orientation horizontale (à droite) ou verticale (le long de la ligne).
function textOnVline(d: Drawing, x: number, top: number, bottom: number) {
  const t = d.text;
  if (!t.value.trim()) return null;
  const common = {
    fill: t.color, fontSize: t.size,
    fontWeight: t.bold ? "bold" : "normal", fontStyle: t.italic ? "italic" : "normal",
    style: { pointerEvents: "none" as const, userSelect: "none" as const },
  };
  if (t.orientation === "v") {
    return (
      <text transform={`translate(${x - 6},${(top + bottom) / 2}) rotate(-90)`} textAnchor="middle" dominantBaseline="text-after-edge" {...common}>
        {t.value.replace(/\n/g, " ")}
      </text>
    );
  }
  const yPos = t.vAlign === "top" ? top + 6 : t.vAlign === "bottom" ? bottom - 22 : (top + bottom) / 2;
  const baseline = t.vAlign === "top" ? "hanging" : t.vAlign === "bottom" ? "alphabetic" : "central";
  const lines = t.value.split("\n");
  return (
    <text x={x + 6} y={yPos} textAnchor="start" dominantBaseline={baseline} {...common}>
      {lines.map((ln, i) => <tspan key={i} x={x + 6} dy={i === 0 ? 0 : t.size * 1.25}>{ln || " "}</tspan>)}
    </text>
  );
}

// Texte le long d'un trait : pivoté selon l'angle (jamais à l'envers), aligné V/H.
function textAlongLine(d: Drawing, a: PxPt, b: PxPt) {
  const t = d.text;
  if (!t.value.trim()) return null;
  const anchorPt =
    t.hAlign === "left" ? a : t.hAlign === "right" ? b : { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  let angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  else if (angle < -90) angle += 180;
  const textAnchor = t.hAlign === "left" ? "start" : t.hAlign === "right" ? "end" : "middle";
  const baseline = t.vAlign === "top" ? "alphabetic" : t.vAlign === "bottom" ? "hanging" : "central";
  const gap = t.vAlign === "middle" ? 0 : 5;
  const lineH = t.size * 1.25;
  const lines = t.value.split("\n");
  return (
    <text
      transform={`translate(${anchorPt.x},${anchorPt.y}) rotate(${angle})`}
      textAnchor={textAnchor}
      dominantBaseline={baseline}
      fill={t.color}
      fontSize={t.size}
      fontWeight={t.bold ? "bold" : "normal"}
      fontStyle={t.italic ? "italic" : "normal"}
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={0} dy={i === 0 ? (t.vAlign === "top" ? -gap : gap) : lineH}>{ln || " "}</tspan>
      ))}
    </text>
  );
}
