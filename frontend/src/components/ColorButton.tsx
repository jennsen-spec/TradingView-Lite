import { useEffect, useRef, useState } from "react";
import { PALETTE, LINE_STYLES, rgba } from "../lib/indicatorSettings";
import type { LineStyleName } from "../lib/indicatorSettings";

interface Patch {
  color?: string;
  opacity?: number;
  lineWidth?: number;
  lineStyle?: LineStyleName;
}

interface Props {
  color: string;
  opacity: number;
  line?: boolean; // afficher épaisseur + style de ligne (élément ligne vs remplissage)
  lineWidth?: number;
  lineStyle?: LineStyleName;
  onChange: (patch: Patch) => void;
}

// Bouton couleur : swatch + (pour les lignes) aperçu de trait ; ouvre une pop-up couleur.
export default function ColorButton({ color, opacity, line, lineWidth = 1, lineStyle = "solid", onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (popRef.current?.contains(e.target as Node) || btnRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = () => {
    const r = btnRef.current!.getBoundingClientRect();
    setPos({ left: r.left, top: r.bottom + 4 });
    setOpen((o) => !o);
  };
  const dash = LINE_STYLES.find((l) => l.key === lineStyle)?.dash || "";

  return (
    <>
      <button ref={btnRef} className="color-btn" onClick={toggle} title="Couleur">
        <span className="cb-swatch" style={{ background: rgba(color, opacity) }} />
        {line && (
          <span className="cb-line">
            <svg width="26" height="12">
              <line x1="1" y1="6" x2="25" y2="6" stroke={color} strokeWidth={lineWidth} strokeDasharray={dash} />
            </svg>
          </span>
        )}
      </button>
      {open && (
        <div ref={popRef} className="color-pop" style={{ left: pos.left, top: pos.top }}>
          <div className="cp-grid">
            {PALETTE.map((c) => (
              <button
                key={c}
                className={`is-swatch${color.toLowerCase() === c ? " sel" : ""}`}
                style={{ background: c }}
                onClick={() => onChange({ color: c })}
                title={c}
              />
            ))}
            <label className="is-swatch is-custom" title="Couleur personnalisée">
              +
              <input type="color" value={color} onChange={(e) => onChange({ color: e.target.value })} />
            </label>
          </div>
          <div className="cp-row">
            <span>Opacité</span>
            <input type="range" min={0} max={100} value={opacity} onChange={(e) => onChange({ opacity: Number(e.target.value) })} />
            <span className="cp-val">{opacity}%</span>
          </div>
          {line && (
            <>
              <div className="cp-label">Épaisseur</div>
              <div className="is-choices">
                {[1, 2, 3, 4].map((w) => (
                  <button key={w} className={`is-choice${lineWidth === w ? " sel" : ""}`} onClick={() => onChange({ lineWidth: w })}>
                    <svg width="28" height="12"><line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth={w} /></svg>
                  </button>
                ))}
              </div>
              <div className="cp-label">Style de ligne</div>
              <div className="is-choices">
                {LINE_STYLES.map((ls) => (
                  <button key={ls.key} className={`is-choice${lineStyle === ls.key ? " sel" : ""}`} title={ls.label} onClick={() => onChange({ lineStyle: ls.key })}>
                    <svg width="28" height="12"><line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth={2} strokeDasharray={ls.dash} /></svg>
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
