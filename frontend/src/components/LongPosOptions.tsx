import { useState } from "react";
import type { Drawing, LongPosConfig, TextConfig } from "../lib/drawings";
import { drawingDefaultKey, longPosStats } from "../lib/drawings";
import { templateFromDrawing, applyTemplate, factoryTemplate } from "../lib/templates";
import VisibilityEditor from "./VisibilityEditor";
import TemplateMenu from "./TemplateMenu";
import ColorButton from "./ColorButton";

type Tab = "input" | "style" | "visibility";

// UTCTimestamp (s) <-> valeur d'un <input type="datetime-local"> (avec secondes).
// Tout est lu et ecrit en UTC, comme l'axe du graphique (voir lib/timeFormat.ts) : une
// barre journaliere est horodatee a minuit UTC et s'affiche donc au bon jour, a 00:00:00.
const toDtInput = (sec: number) => {
  const dt = new Date(sec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${p(dt.getUTCMonth() + 1)}-${p(dt.getUTCDate())}`
    + `T${p(dt.getUTCHours())}:${p(dt.getUTCMinutes())}:${p(dt.getUTCSeconds())}`;
};
const fromDtInput = (v: string): number | null => {
  const ms = Date.parse(`${v}Z`); // le "Z" force l'interpretation en UTC
  return Number.isNaN(ms) ? null : Math.round(ms / 1000);
};

interface Props {
  drawing: Drawing;
  onChange: (d: Drawing) => void;
  onCancel: () => void;
  onOk: () => void;
}

// Dialogue de la Position longue : Paramètres en Entrée (dimensionnement) + Style + Visibilité.
export default function LongPosOptions({ drawing: d, onChange, onCancel, onOk }: Props) {
  const [tab, setTab] = useState<Tab>("input");
  const [brouillon, setBrouillon] = useState<{ i: number; v: string; err: boolean } | null>(null);
  const L = d.long!;
  const ts = L.tickSize || 0.01;
  const st = longPosStats(L);

  const setL = (patch: Partial<LongPosConfig>) => onChange({ ...d, long: { ...L, ...patch } });
  const setStyle = (patch: Partial<Drawing["style"]>) => onChange({ ...d, style: { ...d.style, ...patch } });
  const setText = (patch: Partial<TextConfig>) => onChange({ ...d, text: { ...d.text, ...patch } });
  // Prix d'entrée : synchronise aussi le prix des points (ancrage sur l'axe).
  const setEntry = (entry: number) => onChange({ ...d, long: { ...L, entry }, points: d.points.map((p) => ({ ...p, price: entry })) });
  const num = (v: string, fallback: number) => { const n = Number(v); return Number.isNaN(n) ? fallback : n; };
  // Bornes horizontales du bloc : points[0] = debut, points[1] = fin.
  // Une saisie refusee reste affichee dans le champ (brouillon) au lieu d'etre avalee ;
  // seule une borne valide est reportee sur le dessin.
  const valBorne = (i: number) =>
    brouillon?.i === i ? brouillon.v : (d.points[i] ? toDtInput(d.points[i].time) : "");
  const setTime = (i: number, v: string) => {
    const t = fromDtInput(v);
    const autre = d.points[1 - i]?.time;
    if (t == null || autre == null) { setBrouillon({ i, v, err: false }); return; } // saisie en cours
    if (i === 0 ? t >= autre : t <= autre) { setBrouillon({ i, v, err: true }); return; }
    setBrouillon(null);
    onChange({ ...d, points: d.points.map((p, j) => (j === i ? { ...p, time: t } : p)) });
  };

  return (
    <div className="is-modal lp-modal">
      <div className="is-head">
        <input className="is-title-input" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} aria-label="Nom" />
        <button className="is-close" onClick={onCancel} aria-label="Fermer">✕</button>
      </div>

      <div className="is-tabs">
        <button className={tab === "input" ? "active" : ""} onClick={() => setTab("input")}>Paramètres en Entrée</button>
        <button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>Style</button>
        <button className={tab === "visibility" ? "active" : ""} onClick={() => setTab("visibility")}>Visibilité</button>
      </div>

      <div className="is-body">
        {tab === "input" && (
          <>
            <div className="lp-row"><label>Taille du compte</label>
              <input type="number" step="any" value={L.account} onChange={(e) => setL({ account: num(e.target.value, L.account) })} />
            </div>
            <div className="lp-row"><label>Taille du lot</label>
              <input type="number" step="any" value={L.lot} onChange={(e) => setL({ lot: num(e.target.value, L.lot) })} />
            </div>
            <div className="lp-row"><label>Risque</label>
              <div className="lp-pair">
                <input type="number" step="any" value={L.risk} onChange={(e) => setL({ risk: num(e.target.value, L.risk) })} />
                <select value={L.riskMode} onChange={(e) => setL({ riskMode: e.target.value as LongPosConfig["riskMode"] })}>
                  <option value="pct">%</option>
                  <option value="amount">Montant</option>
                </select>
              </div>
            </div>
            <div className="lp-row"><label>Prix d'entrée</label>
              <input type="number" step="any" value={L.entry} onChange={(e) => setEntry(num(e.target.value, L.entry))} />
            </div>
            <div className="lp-row"><label>Effet de levier</label>
              <input type="number" step="any" value={L.leverage} onChange={(e) => setL({ leverage: num(e.target.value, L.leverage) })} />
            </div>
            <div className="lp-row"><label>Taille du tick</label>
              <input type="number" step="any" value={L.tickSize} onChange={(e) => setL({ tickSize: num(e.target.value, L.tickSize) || 0.01 })} />
            </div>

            <div className="is-section">Niveau de profit (objectif)</div>
            <div className="lp-row"><label>Ticks</label>
              <input type="number" step="1" value={st.targetTicks} onChange={(e) => setL({ target: +(L.entry + num(e.target.value, st.targetTicks) * ts).toFixed(6) })} />
            </div>
            <div className="lp-row"><label>Prix</label>
              <input type="number" step="any" value={L.target} onChange={(e) => setL({ target: num(e.target.value, L.target) })} />
            </div>

            <div className="is-section">Niveau du stop</div>
            <div className="lp-row"><label>Ticks</label>
              <input type="number" step="1" value={st.stopTicks} onChange={(e) => setL({ stop: +(L.entry - num(e.target.value, st.stopTicks) * ts).toFixed(6) })} />
            </div>
            <div className="lp-row"><label>Prix</label>
              <input type="number" step="any" value={L.stop} onChange={(e) => setL({ stop: num(e.target.value, L.stop) })} />
            </div>

            <div className="is-section">Période</div>
            <div className="lp-row"><label>Début</label>
              <input
                type="datetime-local" step="1" value={valBorne(0)}
                max={d.points[1] ? toDtInput(d.points[1].time - 1) : undefined}
                onChange={(e) => setTime(0, e.target.value)}
              />
            </div>
            <div className="lp-row"><label>Fin</label>
              <input
                type="datetime-local" step="1" value={valBorne(1)}
                min={d.points[0] ? toDtInput(d.points[0].time + 1) : undefined}
                onChange={(e) => setTime(1, e.target.value)}
              />
            </div>
            {brouillon?.err && <div className="lp-err">La fin doit être postérieure au début.</div>}

            <div className="lp-stats">
              <span>R:R <b>{st.rr.toFixed(2)}</b></span>
              <span>Quantité <b>{st.qty.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</b></span>
              <span>Risque <b>{st.riskAmount.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}</b></span>
            </div>
          </>
        )}

        {tab === "style" && (
          <>
            <div className="do-text-row"><label className="lp-lbl">Couleur des lignes</label>
              <ColorButton color={d.style.color} opacity={d.style.opacity} onChange={(p) => setStyle({ color: p.color ?? d.style.color, opacity: p.opacity ?? d.style.opacity })} />
            </div>
            <div className="is-section">Épaisseur des lignes</div>
            <div className="is-choices">
              {[1, 2, 3, 4].map((w) => (
                <button key={w} className={`is-choice${d.style.width === w ? " sel" : ""}`} onClick={() => setStyle({ width: w })}>
                  <svg width="34" height="12"><line x1="2" y1="6" x2="32" y2="6" stroke="currentColor" strokeWidth={w} /></svg>
                </button>
              ))}
            </div>
            <div className="do-text-row"><label className="lp-lbl">Couleur du stop</label>
              <ColorButton color={L.stopColor} opacity={100} onChange={(p) => p.color && setL({ stopColor: p.color })} />
            </div>
            <div className="do-text-row"><label className="lp-lbl">Couleur de l'objectif</label>
              <ColorButton color={L.targetColor} opacity={100} onChange={(p) => p.color && setL({ targetColor: p.color })} />
            </div>
            <div className="do-text-row"><label className="lp-lbl">Texte</label>
              <ColorButton color={d.text.color} opacity={100} onChange={(p) => p.color && setText({ color: p.color })} />
              <input className="do-size" type="number" min={8} max={40} value={d.text.size} title="Taille (px)" onChange={(e) => setText({ size: Math.max(8, num(e.target.value, d.text.size)) })} />
            </div>
            <label className="fib-check"><input type="checkbox" checked={L.priceLabels} onChange={(e) => setL({ priceLabels: e.target.checked })} /> Étiquettes de prix</label>
            <label className="fib-check"><input type="checkbox" checked={L.compact} onChange={(e) => setL({ compact: e.target.checked })} /> Mode statistiques compact</label>
            <label className="fib-check"><input type="checkbox" checked={L.alwaysStats} onChange={(e) => setL({ alwaysStats: e.target.checked })} /> Toujours afficher les statistiques</label>
          </>
        )}

        {tab === "visibility" && (
          <VisibilityEditor visibility={d.visibility} onChange={(v) => onChange({ ...d, visibility: v })} />
        )}
      </div>

      <div className="is-foot is-foot-split">
        <TemplateMenu
          drawingKey={drawingDefaultKey(d.type, d.style)}
          current={templateFromDrawing(d)}
          factory={factoryTemplate(d)}
          onApply={(t) => onChange(applyTemplate(d, t))}
        />
        <div className="is-foot-right">
          <button className="is-btn" onClick={onCancel}>Annuler</button>
          <button className="is-btn primary" onClick={onOk}>D'accord</button>
        </div>
      </div>
    </div>
  );
}
