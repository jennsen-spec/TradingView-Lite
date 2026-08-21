import { useEffect, useRef, useState } from "react";
import { PALETTE, LINE_STYLES } from "../lib/indicatorSettings";
import type { Drawing, DrawingStyle, CapStyle, DPoint, TextConfig, MeasureConfig } from "../lib/drawings";
import { CHANNEL_LEVELS, BRUSH_WIDTHS, defaultMeasure, drawingDefaultKey } from "../lib/drawings";
import { templateFromDrawing, applyTemplate, factoryTemplate } from "../lib/templates";
import VisibilityEditor from "./VisibilityEditor";
import TemplateMenu from "./TemplateMenu";
import ColorButton from "./ColorButton";

type Tab = "style" | "text" | "measure" | "coords" | "visibility";
type Dropdown = "lcap" | "rcap" | "ext" | null;

interface Props {
  drawing: Drawing;
  onChange: (d: Drawing) => void;
  onCancel: () => void;
  onOk: () => void;
}

// UTCTimestamp (s) <-> valeur d'un <input type="datetime-local"> (heure locale).
const toLocalInput = (sec: number) => {
  const d = new Date(sec * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const fromLocalInput = (v: string): number | null => {
  const ms = Date.parse(v);
  return Number.isNaN(ms) ? null : Math.round(ms / 1000);
};

const extendLabel = (s: DrawingStyle) =>
  s.extendLeft && s.extendRight ? "Gauche & droite"
    : s.extendLeft ? "Gauche"
      : s.extendRight ? "Droite"
        : "Ne pas élargir";

// Icône d'un embout : trait + extrémité décorée (rond = Normal, triangle = Flèche).
function CapIcon({ side, style }: { side: "left" | "right"; style: CapStyle }) {
  const arrow = style === "arrow";
  const end = side === "left" ? 7 : 31;
  return (
    <svg width="38" height="14" className="do-cap-ico">
      <line x1="7" y1="7" x2="31" y2="7" stroke="currentColor" strokeWidth="2" />
      {arrow ? (
        <polygon
          points={side === "left" ? "7,7 15,2 15,12" : "31,7 23,2 23,12"}
          fill="currentColor"
        />
      ) : (
        <circle cx={end} cy="7" r="3.5" fill="var(--surface)" stroke="currentColor" strokeWidth="1.5" />
      )}
    </svg>
  );
}

// Position (fixed) d'un menu sous son bouton — échappe au clipping du corps du dialogue (overflow).
const anchorBelow = (el: HTMLElement | null) => {
  const r = el?.getBoundingClientRect();
  return { left: r?.left ?? 0, top: (r?.bottom ?? 0) + 4 };
};

// Sélecteur compact d'un embout (bouton icône + menu Normal/Flèche), façon TradingView.
function CapDropdown({
  side, value, open, onToggle, onPick,
}: {
  side: "left" | "right";
  value: CapStyle;
  open: boolean;
  onToggle: () => void;
  onPick: (c: CapStyle) => void;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ left: 0, top: 0 });
  const toggle = () => { setPos(anchorBelow(btnRef.current)); onToggle(); };
  return (
    <div className="do-cap">
      <button ref={btnRef} className="do-cap-btn" onClick={toggle} title={side === "left" ? "Embout gauche" : "Embout droit"}>
        <CapIcon side={side} style={value} />
        <span className="do-chevron">⌄</span>
      </button>
      {open && (
        <div className="do-dd-panel" style={{ position: "fixed", left: pos.left, top: pos.top }}>
          {(["normal", "arrow"] as CapStyle[]).map((c) => (
            <button key={c} className={`do-dd-item${value === c ? " sel" : ""}`} onClick={() => onPick(c)}>
              <CapIcon side={side} style={c} />
              <span>{c === "normal" ? "Normal" : "Flèche"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function DrawingOptions({ drawing: d, onChange, onCancel, onOk }: Props) {
  const [tab, setTab] = useState<Tab>("style");
  const [dd, setDd] = useState<Dropdown>(null);
  const extBtnRef = useRef<HTMLButtonElement>(null);
  const [extPos, setExtPos] = useState({ left: 0, top: 0 });
  const s = d.style;

  // Fenêtre déplaçable : on glisse par l'en-tête (sauf le titre et le bouton fermer).
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null);
  const onHeadDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest(".is-title-input, .is-close")) return;
    const el = modalRef.current;
    if (!el) return;
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: el.offsetLeft, oy: el.offsetTop };
    e.preventDefault();
  };
  useEffect(() => {
    const move = (e: MouseEvent) => {
      const dg = dragRef.current;
      if (dg) setPos({ left: dg.ox + (e.clientX - dg.sx), top: dg.oy + (e.clientY - dg.sy) });
    };
    const up = () => { dragRef.current = null; };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", move); window.removeEventListener("mouseup", up); };
  }, []);

  // Ferme le menu ouvert (embout / prolonger) au clic en dehors.
  useEffect(() => {
    if (!dd) return;
    const onDoc = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest(".do-cap, .do-extend")) setDd(null);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [dd]);

  // Onglet Mesure : disponible pour tous les traits (trait simple ET flèche).
  const isTrend = d.type === "trend";
  const m: MeasureConfig = d.measure ?? defaultMeasure(s.rightCap === "arrow");
  const setStyle = (patch: Partial<DrawingStyle>) => onChange({ ...d, style: { ...s, ...patch } });
  const setText = (patch: Partial<TextConfig>) => onChange({ ...d, text: { ...d.text, ...patch } });
  const setMeasure = (patch: Partial<MeasureConfig>) => onChange({ ...d, measure: { ...m, ...patch } });
  const setPoint = (i: number, patch: Partial<DPoint>) =>
    onChange({ ...d, points: d.points.map((p, idx) => (idx === i ? { ...p, ...patch } : p)) });

  return (
    <div className="is-modal" ref={modalRef} style={pos ? { left: pos.left, top: pos.top } : undefined}>
      <div className="is-head is-head-drag" onMouseDown={onHeadDown}>
        <input
          className="is-title-input"
          value={d.title}
          onChange={(e) => onChange({ ...d, title: e.target.value })}
          aria-label="Nom du dessin"
        />
        <button className="is-close" onClick={onCancel} aria-label="Fermer">✕</button>
      </div>

      <div className="is-tabs">
        <button className={tab === "style" ? "active" : ""} onClick={() => setTab("style")}>Style</button>
        {d.type !== "brush" && <button className={tab === "text" ? "active" : ""} onClick={() => setTab("text")}>Texte</button>}
        {isTrend && <button className={tab === "measure" ? "active" : ""} onClick={() => setTab("measure")}>Mesure</button>}
        {d.type !== "brush" && <button className={tab === "coords" ? "active" : ""} onClick={() => setTab("coords")}>Coordonnées</button>}
        <button className={tab === "visibility" ? "active" : ""} onClick={() => setTab("visibility")}>Visibilité</button>
      </div>

      <div className="is-body">
        {tab === "style" && (
          <>
            <div className="is-section">Couleur</div>
            <div className="is-swatches">
              {PALETTE.map((c) => (
                <button
                  key={c}
                  className={`is-swatch${s.color.toLowerCase() === c ? " sel" : ""}`}
                  style={{ background: c }}
                  onClick={() => setStyle({ color: c })}
                  title={c}
                />
              ))}
              <label className="is-swatch is-custom" title="Couleur personnalisée">
                +
                <input type="color" value={s.color} onChange={(e) => setStyle({ color: e.target.value })} />
              </label>
            </div>

            <div className="is-field">
              <label>Opacité</label>
              <div className="is-opacity">
                <input type="range" min={0} max={100} value={s.opacity} onChange={(e) => setStyle({ opacity: Number(e.target.value) })} />
                <span>{s.opacity}%</span>
              </div>
            </div>

            {d.type === "brush" ? (
              <>
                <div className="is-section">Épaisseur du pinceau</div>
                <div className="is-choices is-choices-wrap">
                  {BRUSH_WIDTHS.map((w) => (
                    <button key={w} className={`is-choice is-choice-txt${s.width === w ? " sel" : ""}`} onClick={() => setStyle({ width: w })}>{w}</button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="is-section">Épaisseur</div>
                <div className="is-choices">
                  {[1, 2, 3, 4].map((w) => (
                    <button key={w} className={`is-choice${s.width === w ? " sel" : ""}`} onClick={() => setStyle({ width: w })}>
                      <svg width="34" height="12"><line x1="2" y1="6" x2="32" y2="6" stroke="currentColor" strokeWidth={w} /></svg>
                    </button>
                  ))}
                </div>

                <div className="is-section">Style de ligne</div>
                <div className="is-choices">
                  {LINE_STYLES.map((ls) => (
                    <button key={ls.key} className={`is-choice${s.lineStyle === ls.key ? " sel" : ""}`} title={ls.label} onClick={() => setStyle({ lineStyle: ls.key })}>
                      <svg width="34" height="12"><line x1="2" y1="6" x2="32" y2="6" stroke="currentColor" strokeWidth={2} strokeDasharray={ls.dash} /></svg>
                    </button>
                  ))}
                </div>
              </>
            )}

            {d.type === "trend" && (
              <>
                <div className="is-section">Embouts</div>
                <div className="do-caps">
                  <CapDropdown
                    side="left" value={s.leftCap} open={dd === "lcap"}
                    onToggle={() => setDd(dd === "lcap" ? null : "lcap")}
                    onPick={(c) => { setStyle({ leftCap: c }); setDd(null); }}
                  />
                  <CapDropdown
                    side="right" value={s.rightCap} open={dd === "rcap"}
                    onToggle={() => setDd(dd === "rcap" ? null : "rcap")}
                    onPick={(c) => { setStyle({ rightCap: c }); setDd(null); }}
                  />
                </div>
              </>
            )}

            {(d.type === "trend" || d.type === "channel" || d.type === "rect") && (
              <>
                <div className="is-section">Prolonger</div>
                <div className="do-extend">
                  <button
                    ref={extBtnRef}
                    className="do-dd-btn"
                    onClick={() => { if (dd !== "ext") setExtPos(anchorBelow(extBtnRef.current)); setDd(dd === "ext" ? null : "ext"); }}
                  >
                    <span>{extendLabel(s)}</span>
                    <span className="do-chevron">⌄</span>
                  </button>
                  {dd === "ext" && (
                    <div className="do-dd-panel do-dd-wide" style={{ position: "fixed", left: extPos.left, top: extPos.top }}>
                      <label className="is-check">
                        <input type="checkbox" checked={s.extendLeft} onChange={(e) => setStyle({ extendLeft: e.target.checked })} />
                        Prolonger la ligne de gauche
                      </label>
                      <label className="is-check">
                        <input type="checkbox" checked={s.extendRight} onChange={(e) => setStyle({ extendRight: e.target.checked })} />
                        Prolonger la ligne de droite
                      </label>
                    </div>
                  )}
                </div>
              </>
            )}

            {d.type === "channel" && (
              <>
                <div className="is-section">Niveaux</div>
                <div className="do-vchecks">
                  <label className="is-check"><input type="checkbox" checked disabled /> Bord 0 (base)</label>
                  <label className="is-check"><input type="checkbox" checked disabled /> Bord 1 (parallèle)</label>
                  {CHANNEL_LEVELS.map((L) => {
                    const cur = s.levels ?? [];
                    return (
                      <label key={L} className="is-check">
                        <input
                          type="checkbox" checked={cur.includes(L)}
                          onChange={(e) => setStyle({ levels: e.target.checked ? [...cur, L] : cur.filter((x) => x !== L) })}
                        />
                        Niveau {L}
                      </label>
                    );
                  })}
                </div>
                <div className="is-section">Arrière-plan</div>
                <div className="do-text-row">
                  <label className="is-check">
                    <input type="checkbox" checked={s.bgOn !== false} onChange={(e) => setStyle({ bgOn: e.target.checked })} />
                    Remplissage
                  </label>
                  <ColorButton
                    color={s.bgColor ?? "#3f8cff"} opacity={s.bgOpacity ?? 12}
                    onChange={(p) => setStyle({ bgColor: p.color ?? s.bgColor, bgOpacity: p.opacity ?? s.bgOpacity })}
                  />
                </div>
              </>
            )}

            {d.type === "rect" && (
              <>
                <div className="is-section">Ligne médiane</div>
                <div className="do-text-row">
                  <label className="is-check">
                    <input type="checkbox" checked={!!s.midOn} onChange={(e) => setStyle({ midOn: e.target.checked })} />
                    Afficher
                  </label>
                  <ColorButton color={s.midColor ?? "#9c27b0"} opacity={100} onChange={(p) => p.color && setStyle({ midColor: p.color })} />
                  <div className="is-choices" style={{ marginBottom: 0 }}>
                    {LINE_STYLES.map((ls) => (
                      <button key={ls.key} className={`is-choice${(s.midStyle ?? "dashed") === ls.key ? " sel" : ""}`} title={ls.label} onClick={() => setStyle({ midStyle: ls.key })}>
                        <svg width="28" height="12"><line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth={2} strokeDasharray={ls.dash} /></svg>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="is-section">Arrière-plan</div>
                <div className="do-text-row">
                  <label className="is-check">
                    <input type="checkbox" checked={s.bgOn !== false} onChange={(e) => setStyle({ bgOn: e.target.checked })} />
                    Remplissage
                  </label>
                  <ColorButton
                    color={s.bgColor ?? "#3f8cff"} opacity={s.bgOpacity ?? 12}
                    onChange={(p) => setStyle({ bgColor: p.color ?? s.bgColor, bgOpacity: p.opacity ?? s.bgOpacity })}
                  />
                </div>
              </>
            )}

            {d.type === "vline" && (
              <div className="do-vchecks">
                <label className="is-check">
                  <input type="checkbox" checked={!!s.extend} onChange={(e) => setStyle({ extend: e.target.checked })} />
                  Prolonger (au-delà de la zone des bougies)
                </label>
                <label className="is-check">
                  <input type="checkbox" checked={s.timeLabel !== false} onChange={(e) => setStyle({ timeLabel: e.target.checked })} />
                  Étiquette horaire
                </label>
              </div>
            )}
          </>
        )}

        {tab === "text" && (
          <>
            <div className="is-field is-field-col">
              <label>Texte</label>
              <textarea
                className="do-textarea"
                rows={3}
                value={d.text.value}
                placeholder="Votre texte…"
                onChange={(e) => setText({ value: e.target.value })}
              />
            </div>
            <div className="is-section">Police</div>
            <div className="do-text-row">
              <ColorButton color={d.text.color} opacity={100} onChange={(p) => p.color && setText({ color: p.color })} />
              <input
                className="do-size" type="number" min={6} max={96} value={d.text.size}
                title="Taille (px)"
                onChange={(e) => setText({ size: Math.max(6, Number(e.target.value) || 14) })}
              />
              <button className={`do-tbtn${d.text.bold ? " sel" : ""}`} title="Gras" onClick={() => setText({ bold: !d.text.bold })}><b>B</b></button>
              <button className={`do-tbtn${d.text.italic ? " sel" : ""}`} title="Italique" onClick={() => setText({ italic: !d.text.italic })}><i>I</i></button>
            </div>
            <div className="do-align-row">
              <label>Alignement du texte</label>
              <select value={d.text.vAlign} onChange={(e) => setText({ vAlign: e.target.value as TextConfig["vAlign"] })}>
                <option value="top">Haut</option>
                <option value="middle">Milieu</option>
                <option value="bottom">Bas</option>
              </select>
              <select value={d.text.hAlign} onChange={(e) => setText({ hAlign: e.target.value as TextConfig["hAlign"] })}>
                <option value="left">Gauche</option>
                <option value="center">Centre</option>
                <option value="right">Droite</option>
              </select>
            </div>
            {d.type === "vline" && (
              <div className="do-align-row">
                <label>Orientation du texte</label>
                <select value={d.text.orientation ?? "h"} onChange={(e) => setText({ orientation: e.target.value as TextConfig["orientation"] })}>
                  <option value="h">Horizontal</option>
                  <option value="v">Vertical</option>
                </select>
              </div>
            )}
          </>
        )}

        {tab === "measure" && (
          <>
            <div className="do-vchecks">
              <label className="is-check">
                <input type="checkbox" checked={m.percent} onChange={(e) => setMeasure({ percent: e.target.checked })} />
                Variation en %
              </label>
              <label className="is-check">
                <input type="checkbox" checked={m.duration} onChange={(e) => setMeasure({ duration: e.target.checked })} />
                Durée
              </label>
              {m.duration && (
                <div className="do-sub-checks">
                  <label className="is-check">
                    <input type="checkbox" checked={m.durTime} onChange={(e) => setMeasure({ durTime: e.target.checked })} />
                    Échelle de temps
                  </label>
                  <label className="is-check">
                    <input type="checkbox" checked={m.durBars} onChange={(e) => setMeasure({ durBars: e.target.checked })} />
                    Valeur du graphe (barres)
                  </label>
                </div>
              )}
            </div>

            <div className="do-align-row">
              <label>Position</label>
              <select value={m.position} onChange={(e) => setMeasure({ position: e.target.value as MeasureConfig["position"] })}>
                <option value="left">À gauche</option>
                <option value="middle">Au milieu</option>
                <option value="right">À droite</option>
              </select>
            </div>
            <div className="do-align-row">
              <label>Alignement</label>
              <select value={m.align} onChange={(e) => setMeasure({ align: e.target.value as MeasureConfig["align"] })}>
                <option value="left">À gauche</option>
                <option value="center">Au milieu</option>
                <option value="right">À droite</option>
              </select>
            </div>
            <div className="do-align-row">
              <label>Sens du texte</label>
              <select value={m.orientation} onChange={(e) => setMeasure({ orientation: e.target.value as MeasureConfig["orientation"] })}>
                <option value="h">Horizontal</option>
                <option value="along">Le long du tracé</option>
              </select>
            </div>
          </>
        )}

        {tab === "coords" && (
          <>
            {d.points.map((p, i) => (
              <div className="is-coord" key={i}>
                <div className="is-section">Point #{i + 1}</div>
                {d.type !== "vline" && (
                  <div className="is-field">
                    <label>Prix</label>
                    <input
                      type="number" step="any" value={p.price}
                      onChange={(e) => setPoint(i, { price: Number(e.target.value) })}
                    />
                  </div>
                )}
                <div className="is-field">
                  <label>Date</label>
                  <input
                    type="datetime-local" value={toLocalInput(p.time)}
                    onChange={(e) => { const t = fromLocalInput(e.target.value); if (t != null) setPoint(i, { time: t }); }}
                  />
                </div>
              </div>
            ))}
            {d.type === "channel" && (
              <div className="is-field">
                <label>Price offset</label>
                <input
                  type="number" step="any" value={d.channelOffset ?? 0}
                  onChange={(e) => onChange({ ...d, channelOffset: Number(e.target.value) })}
                />
              </div>
            )}
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
