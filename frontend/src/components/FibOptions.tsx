import { useState } from "react";
import type { Drawing, FibConfig } from "../lib/drawings";
import VisibilityEditor from "./VisibilityEditor";

type Tab = "style" | "coords" | "visibility";

interface Props {
  drawing: Drawing;
  onChange: (d: Drawing) => void;
  onCancel: () => void;
  onOk: () => void;
}

// Dialogue de réglages du retracement de Fibonacci (niveaux, couleurs, fond, étiquettes…).
export default function FibOptions({ drawing: d, onChange, onCancel, onOk }: Props) {
  const [tab, setTab] = useState<Tab>("style");
  const fib = d.fib!;
  const setFib = (patch: Partial<FibConfig>) => onChange({ ...d, fib: { ...fib, ...patch } });
  const setLevel = (i: number, patch: Partial<FibConfig["levels"][number]>) =>
    setFib({ levels: fib.levels.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) });
  const setPoint = (i: number, price: number) =>
    onChange({ ...d, points: d.points.map((p, idx) => (idx === i ? { ...p, price } : p)) });

  const half = Math.ceil(fib.levels.length / 2);

  const levelCell = (i: number) => {
    const l = fib.levels[i];
    return (
      <div className={`fib-lv${l.on ? "" : " off"}`} key={l.ratio}>
        <input type="checkbox" checked={l.on} onChange={(e) => setLevel(i, { on: e.target.checked })} />
        <span className="fib-ratio">{l.ratio}</span>
        <label className="fib-swatch" style={{ background: l.color }} title="Couleur">
          <input type="color" value={l.color} onChange={(e) => setLevel(i, { color: e.target.value })} />
        </label>
      </div>
    );
  };

  return (
    <div className="is-modal fib-modal">
      <div className="is-head">
        <input className="is-title-input" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
        <button className="is-close" onClick={onCancel} aria-label="Fermer">✕</button>
      </div>

      <div className="is-tabs">
        <button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>Style</button>
        <button className={tab === "coords" ? "active" : ""} onClick={() => setTab("coords")}>Coordonnées</button>
        <button className={tab === "visibility" ? "active" : ""} onClick={() => setTab("visibility")}>Visibilité</button>
      </div>

      <div className="is-body">
        {tab === "style" && (
          <>
            <label className="fib-check">
              <input type="checkbox" checked={fib.trendLineOn} onChange={(e) => setFib({ trendLineOn: e.target.checked })} />
              Ligne de tendance
            </label>

            <div className="is-field">
              <label>Prolonger</label>
              <select value={fib.extendRight ? "right" : "none"} onChange={(e) => setFib({ extendRight: e.target.value === "right" })}>
                <option value="none">Ne pas élargir</option>
                <option value="right">Prolonger à droite</option>
              </select>
            </div>

            <div className="is-section">Niveaux</div>
            <div className="fib-levels">
              <div className="fib-col">{fib.levels.slice(0, half).map((_l, li) => levelCell(li))}</div>
              <div className="fib-col">{fib.levels.slice(half).map((_l, li) => levelCell(half + li))}</div>
            </div>

            <label className="fib-check">
              <input type="checkbox" checked={fib.bgOn} onChange={(e) => setFib({ bgOn: e.target.checked })} />
              Arrière-Plan
            </label>
            {fib.bgOn && (
              <div className="is-field">
                <label>Opacité du fond</label>
                <div className="is-opacity">
                  <input type="range" min={0} max={50} value={fib.bgOpacity} onChange={(e) => setFib({ bgOpacity: Number(e.target.value) })} />
                  <span>{fib.bgOpacity}%</span>
                </div>
              </div>
            )}

            <label className="fib-check">
              <input type="checkbox" checked={fib.reverse} onChange={(e) => setFib({ reverse: e.target.checked })} />
              Inverse
            </label>
            <label className="fib-check">
              <input type="checkbox" checked={fib.showLabels} onChange={(e) => setFib({ showLabels: e.target.checked })} />
              Étiquettes (ratio + prix)
            </label>

            <div className="is-field">
              <label>Taille de la police</label>
              <select value={fib.fontSize} onChange={(e) => setFib({ fontSize: Number(e.target.value) })}>
                {[10, 11, 12, 14, 16, 18].map((sz) => <option key={sz} value={sz}>{sz}</option>)}
              </select>
            </div>
          </>
        )}

        {tab === "coords" && (
          <>
            <div className="is-field">
              <label>#1 — prix</label>
              <input type="number" value={d.points[0].price} onChange={(e) => setPoint(0, Number(e.target.value))} />
            </div>
            <div className="is-field">
              <label>#2 — prix</label>
              <input type="number" value={d.points[1].price} onChange={(e) => setPoint(1, Number(e.target.value))} />
            </div>
          </>
        )}

        {tab === "visibility" && (
          <VisibilityEditor visibility={d.visibility} onChange={(v) => onChange({ ...d, visibility: v })} />
        )}
      </div>

      <div className="is-foot">
        <div className="is-foot-right">
          <button className="is-btn" onClick={onCancel}>Annuler</button>
          <button className="is-btn primary" onClick={onOk}>D'accord</button>
        </div>
      </div>
    </div>
  );
}
