import { useState } from "react";
import { PALETTE, LINE_STYLES } from "../lib/indicatorSettings";
import type { IndicatorSettings, Timeframe, Visibility } from "../lib/indicatorSettings";
import ColorButton from "./ColorButton";

const VIS_ROWS: { key: keyof Visibility; label: string }[] = [
  { key: "minutes", label: "Minutes" },
  { key: "jours", label: "Jours" },
  { key: "semaines", label: "Semaines" },
  { key: "mois", label: "Mois" },
];

type Tab = "params" | "style" | "visibility";

interface Props {
  title: string;
  type: "sma" | "volume" | "rsi" | "atr";
  settings: IndicatorSettings;
  onChange: (s: IndicatorSettings) => void;
  onCancel: () => void;
  onOk: () => void;
}

export default function IndicatorSettings({ title, type, settings: s, onChange, onCancel, onOk }: Props) {
  const [tab, setTab] = useState<Tab>("params");

  const set = (patch: Partial<IndicatorSettings>) => onChange({ ...s, ...patch });
  const setVis = (unit: keyof Visibility, patch: Partial<Visibility[keyof Visibility]>) =>
    onChange({ ...s, visibility: { ...s.visibility, [unit]: { ...s.visibility[unit], ...patch } } });

  return (
    <div className="is-modal">
      <div className="is-head">
        <span className="is-title">{title}</span>
        <button className="is-close" onClick={onCancel} aria-label="Fermer">✕</button>
      </div>

      <div className="is-tabs">
        <button className={tab === "params" ? "active" : ""} onClick={() => setTab("params")}>Paramètres en Entrée</button>
        <button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>Style</button>
        <button className={tab === "visibility" ? "active" : ""} onClick={() => setTab("visibility")}>Visibilité</button>
      </div>

      <div className="is-body">
        {tab === "params" && type === "sma" && (
          <>
            <div className="is-field">
              <label>Longueur</label>
              <input
                type="number"
                min={1}
                value={s.length ?? 0}
                onChange={(e) => set({ length: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div className="is-field">
              <label>Plage temporelle</label>
              <select value={s.timeframe ?? "1d"} onChange={(e) => set({ timeframe: e.target.value as Timeframe })}>
                <option value="1d">Jour</option>
                <option value="chart">Intervalle du graphique</option>
              </select>
            </div>
          </>
        )}

        {tab === "params" && type === "atr" && (
          <div className="is-field">
            <label>Longueur</label>
            <input
              type="number" min={1}
              value={s.length ?? 14}
              onChange={(e) => set({ length: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        )}

        {tab === "params" && type === "volume" && (
          <div className="is-field">
            <label>Longueur MA</label>
            <input
              type="number"
              min={1}
              value={s.maLength ?? 20}
              onChange={(e) => set({ maLength: Math.max(1, Number(e.target.value) || 1) })}
            />
          </div>
        )}

        {tab === "params" && type === "rsi" && (
          <>
            <div className="is-field">
              <label>Longueur RSI</label>
              <input
                type="number" min={1}
                value={s.length ?? 14}
                onChange={(e) => set({ length: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div className="is-field">
              <label>Longueur MA</label>
              <input
                type="number" min={1}
                value={s.maLength ?? 14}
                onChange={(e) => set({ maLength: Math.max(1, Number(e.target.value) || 1) })}
              />
            </div>
            <div className="is-field">
              <label>Plage temporelle</label>
              <select value={s.timeframe ?? "chart"} onChange={(e) => set({ timeframe: e.target.value as Timeframe })}>
                <option value="chart">Intervalle du graphique</option>
                <option value="1d">Jour</option>
              </select>
            </div>
          </>
        )}

        {tab === "style" && (type === "sma" || type === "atr") && (
          <>
            <div className="is-section">Couleur</div>
            <div className="is-swatches">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className={`is-swatch${(s.color ?? "").toLowerCase() === c ? " sel" : ""}`}
                  style={{ background: c }}
                  onClick={() => set({ color: c })}
                  title={c}
                />
              ))}
              <label className="is-swatch is-custom" title="Couleur personnalisée">
                +
                <input type="color" value={s.color ?? "#3f8cff"} onChange={(e) => set({ color: e.target.value })} />
              </label>
            </div>

            <div className="is-field">
              <label>Opacité</label>
              <div className="is-opacity">
                <input
                  type="range" min={0} max={100}
                  value={s.opacity ?? 100}
                  onChange={(e) => set({ opacity: Number(e.target.value) })}
                />
                <span>{s.opacity ?? 100}%</span>
              </div>
            </div>

            <div className="is-section">Épaisseur</div>
            <div className="is-choices">
              {[1, 2, 3, 4].map((w) => (
                <button
                  key={w}
                  className={`is-choice${(s.lineWidth ?? 1) === w ? " sel" : ""}`}
                  onClick={() => set({ lineWidth: w })}
                >
                  <svg width="34" height="12"><line x1="2" y1="6" x2="32" y2="6" stroke="currentColor" strokeWidth={w} /></svg>
                </button>
              ))}
            </div>

            <div className="is-section">Style de ligne</div>
            <div className="is-choices">
              {LINE_STYLES.map((ls) => (
                <button
                  key={ls.key}
                  className={`is-choice${(s.lineStyle ?? "solid") === ls.key ? " sel" : ""}`}
                  title={ls.label}
                  onClick={() => set({ lineStyle: ls.key })}
                >
                  <svg width="34" height="12"><line x1="2" y1="6" x2="32" y2="6" stroke="currentColor" strokeWidth={2} strokeDasharray={ls.dash} /></svg>
                </button>
              ))}
            </div>
          </>
        )}

        {tab === "style" && type === "volume" && (
          <div className="is-elements">
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.volOn ?? true} onChange={(e) => set({ volOn: e.target.checked })} />
                Volume
              </label>
            </div>
            <div className="is-el is-el-sub">
              <span className="is-el-name">En croissance</span>
              <ColorButton color={s.upColor ?? "#26a69a"} opacity={s.upOpacity ?? 50} onChange={(p) => set({ upColor: p.color ?? s.upColor, upOpacity: p.opacity ?? s.upOpacity })} />
            </div>
            <div className="is-el is-el-sub">
              <span className="is-el-name">En chute</span>
              <ColorButton color={s.downColor ?? "#ef5350"} opacity={s.downOpacity ?? 50} onChange={(p) => set({ downColor: p.color ?? s.downColor, downOpacity: p.opacity ?? s.downOpacity })} />
            </div>
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.maOn ?? true} onChange={(e) => set({ maOn: e.target.checked })} />
                Volume MA
              </label>
              <ColorButton
                color={s.maColor ?? "#3f8cff"} opacity={s.maOpacity ?? 100} line
                lineWidth={s.maWidth ?? 1} lineStyle={s.maStyle ?? "solid"}
                onChange={(p) => set({
                  maColor: p.color ?? s.maColor, maOpacity: p.opacity ?? s.maOpacity,
                  maWidth: p.lineWidth ?? s.maWidth, maStyle: p.lineStyle ?? s.maStyle,
                })}
              />
            </div>
          </div>
        )}

        {tab === "style" && type === "rsi" && (
          <div className="is-elements">
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.rsiOn ?? true} onChange={(e) => set({ rsiOn: e.target.checked })} />
                RSI
              </label>
              <ColorButton
                color={s.color ?? "#7e57c2"} opacity={s.opacity ?? 100} line
                lineWidth={s.lineWidth ?? 2} lineStyle={s.lineStyle ?? "solid"}
                onChange={(p) => set({ color: p.color ?? s.color, opacity: p.opacity ?? s.opacity, lineWidth: p.lineWidth ?? s.lineWidth, lineStyle: p.lineStyle ?? s.lineStyle })}
              />
            </div>
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.maOn ?? true} onChange={(e) => set({ maOn: e.target.checked })} />
                RSI-based MA
              </label>
              <ColorButton
                color={s.maColor ?? "#f2c94c"} opacity={s.maOpacity ?? 65} line
                lineWidth={s.maWidth ?? 1} lineStyle={s.maStyle ?? "solid"}
                onChange={(p) => set({ maColor: p.color ?? s.maColor, maOpacity: p.opacity ?? s.maOpacity, maWidth: p.lineWidth ?? s.maWidth, maStyle: p.lineStyle ?? s.maStyle })}
              />
            </div>
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.upperOn ?? true} onChange={(e) => set({ upperOn: e.target.checked })} />
                RSI Upper Band
              </label>
              <div className="is-el-right">
                <ColorButton color={s.upperColor ?? "#787b86"} opacity={s.upperOpacity ?? 100} onChange={(p) => set({ upperColor: p.color ?? s.upperColor, upperOpacity: p.opacity ?? s.upperOpacity })} />
                <input className="is-band-val" type="number" value={s.upperValue ?? 70} onChange={(e) => set({ upperValue: Number(e.target.value) })} />
              </div>
            </div>
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.middleOn ?? true} onChange={(e) => set({ middleOn: e.target.checked })} />
                RSI Middle Band
              </label>
              <div className="is-el-right">
                <ColorButton color={s.middleColor ?? "#8b949e"} opacity={s.middleOpacity ?? 100} onChange={(p) => set({ middleColor: p.color ?? s.middleColor, middleOpacity: p.opacity ?? s.middleOpacity })} />
                <input className="is-band-val" type="number" value={s.middleValue ?? 50} onChange={(e) => set({ middleValue: Number(e.target.value) })} />
              </div>
            </div>
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.lowerOn ?? true} onChange={(e) => set({ lowerOn: e.target.checked })} />
                RSI Lower Band
              </label>
              <div className="is-el-right">
                <ColorButton color={s.lowerColor ?? "#787b86"} opacity={s.lowerOpacity ?? 100} onChange={(p) => set({ lowerColor: p.color ?? s.lowerColor, lowerOpacity: p.opacity ?? s.lowerOpacity })} />
                <input className="is-band-val" type="number" value={s.lowerValue ?? 30} onChange={(e) => set({ lowerValue: Number(e.target.value) })} />
              </div>
            </div>
            <div className="is-el">
              <label className="is-check">
                <input type="checkbox" checked={s.bgOn ?? true} onChange={(e) => set({ bgOn: e.target.checked })} />
                RSI Background Fill
              </label>
              <ColorButton color={s.bgColor ?? "#7e57c2"} opacity={s.bgOpacity ?? 12} onChange={(p) => set({ bgColor: p.color ?? s.bgColor, bgOpacity: p.opacity ?? s.bgOpacity })} />
            </div>
          </div>
        )}

        {tab === "visibility" && (
          <div className="is-vis">
            {VIS_ROWS.map(({ key, label }) => {
              const u = s.visibility[key];
              return (
                <div className="is-vis-row" key={key}>
                  <label className="is-check">
                    <input type="checkbox" checked={u.on} onChange={(e) => setVis(key, { on: e.target.checked })} />
                    {label}
                  </label>
                  <input
                    type="number" className="is-vis-num" value={u.min}
                    disabled={!u.on}
                    onChange={(e) => setVis(key, { min: Number(e.target.value) || 0 })}
                  />
                  <span className="is-vis-sep">→</span>
                  <input
                    type="number" className="is-vis-num" value={u.max}
                    disabled={!u.on}
                    onChange={(e) => setVis(key, { max: Number(e.target.value) || 0 })}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="is-foot">
        <button className="is-btn" onClick={onCancel}>Annuler</button>
        <button className="is-btn primary" onClick={onOk}>D'accord</button>
      </div>
    </div>
  );
}
