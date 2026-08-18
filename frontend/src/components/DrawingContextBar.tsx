import { useEffect, useRef, useState } from "react";
import ColorButton from "./ColorButton";
import { BRUSH_WIDTHS } from "../lib/drawings";
import type { DrawingStyle, DrawingType } from "../lib/drawings";
import type { LineStyleName } from "../lib/indicatorSettings";

interface Props {
  left: number;
  top: number;
  type: DrawingType;
  style: DrawingStyle;
  locked: boolean;
  count: number; // nb de dessins sélectionnés (corbeille = suppression groupée)
  onStyle: (patch: Partial<DrawingStyle>) => void;
  onToggleLock: () => void;
  onOptions: () => void;
  onDelete: () => void;
}

const IcoLockOpen = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);
const IcoLockClosed = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IcoOptions = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 3 20 7.5 20 16.5 12 21 4 16.5 4 7.5" />
  </svg>
);
const IcoTrash = (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

// Dropdown d'épaisseur du pinceau (surligneur).
function BrushWidth({ value, onPick }: { value: number; onPick: (w: number) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);
  return (
    <div className="dcb-bw" ref={ref}>
      <button className="dcb-btn" title="Épaisseur du pinceau" onClick={() => setOpen((o) => !o)}>
        <span className="dcb-bw-val">{value}</span>
      </button>
      {open && (
        <div className="dcb-bw-menu">
          {BRUSH_WIDTHS.map((w) => (
            <button key={w} className={`dcb-bw-item${value === w ? " sel" : ""}`} onClick={() => { onPick(w); setOpen(false); }}>{w}</button>
          ))}
        </div>
      )}
    </div>
  );
}

// Barre flottante de raccourcis pour le(s) dessin(s) sélectionné(s).
export default function DrawingContextBar({
  left, top, type, style, locked, count, onStyle, onToggleLock, onOptions, onDelete,
}: Props) {
  return (
    <div className="draw-ctxbar" style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}>
      {type === "brush" ? (
        <>
          {/* Surligneur : couleur + opacité, puis épaisseur du pinceau (pas de style de ligne). */}
          <ColorButton
            color={style.color}
            opacity={style.opacity}
            onChange={(p) => onStyle({ color: p.color, opacity: p.opacity })}
          />
          <BrushWidth value={style.width} onPick={(w) => onStyle({ width: w })} />
        </>
      ) : (
        /* Couleur + opacité + épaisseur + style de ligne, regroupés dans le popup couleur. */
        <ColorButton
          color={style.color}
          opacity={style.opacity}
          line
          lineWidth={style.width}
          lineStyle={style.lineStyle}
          onChange={(p) =>
            onStyle({
              color: p.color,
              opacity: p.opacity,
              width: p.lineWidth,
              lineStyle: p.lineStyle as LineStyleName | undefined,
            })
          }
        />
      )}
      <button className="dcb-btn" title="Options" onClick={onOptions}>{IcoOptions}</button>
      <button
        className={`dcb-btn${locked ? " active" : ""}`}
        title={locked ? "Déverrouiller" : "Verrouiller"}
        onClick={onToggleLock}
      >
        {locked ? IcoLockClosed : IcoLockOpen}
      </button>
      <button
        className="dcb-btn dcb-del"
        title={count > 1 ? `Supprimer ${count} dessins` : "Supprimer"}
        onClick={onDelete}
      >
        {IcoTrash}
      </button>
    </div>
  );
}
