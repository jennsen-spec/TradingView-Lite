import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export interface WheelEntry {
  key: string;
  label: string;
  icon?: ReactNode;
}

interface Props {
  entries: WheelEntry[];
  value: string;
  onSelect: (key: string) => void; // au RELÂCHEMENT seulement (sinon une requête par cran)
  onTap: () => void; // tap sans déplacement = comportement d'origine (recherche, menu…)
  label: string; // libellé accessible
  /** Recharge la liste au début du geste (la collection courante peut avoir changé). */
  refresh?: () => WheelEntry[];
}

const ITEM_H = 38; // hauteur d'un cran, en pixels de glissement
const SEUIL = 8; // au-delà, c'est un glissement et non un tap
const RAYON = 4; // entrées visibles de chaque côté du centre

// Molette façon sélecteur iOS (#87) : au repos, un aperçu « précédent / courant /
// suivant » dans la barre ; pendant le glissement vertical, une carte flottante
// centrée sur le graphique dont l'entrée centrale est nette et les voisines dégradées.
export default function WheelPicker({ entries, value, onSelect, onTap, label, refresh }: Props) {
  // L'état du geste vit dans une référence (les événements peuvent arriver dans la
  // même frame que le rendu : un état React y serait encore périmé) ; `drag` ne sert
  // qu'à déclencher l'affichage.
  const [drag, setDrag] = useState<{ startY: number; startIdx: number; idx: number } | null>(null);
  const dragRef = useRef<{ startY: number; startIdx: number; idx: number } | null>(null);
  const [live, setLive] = useState<WheelEntry[]>(entries);
  const liveRef = useRef<WheelEntry[]>(entries);
  const movedRef = useRef(false);

  const list = drag ? live : entries;
  const curIdx = Math.max(0, list.findIndex((e) => e.key === value));
  const idx = drag ? drag.idx : curIdx;
  const at = (i: number) => (i >= 0 && i < list.length ? list[i] : null);

  const onPointerDown = (e: React.PointerEvent) => {
    const l = refresh ? refresh() : entries;
    liveRef.current = l;
    setLive(l);
    movedRef.current = false;
    const start = Math.max(0, l.findIndex((x) => x.key === value));
    dragRef.current = { startY: e.clientY, startIdx: start, idx: start };
    setDrag(dragRef.current);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    if (!movedRef.current) {
      if (Math.abs(dy) < SEUIL) return;
      movedRef.current = true;
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    }
    // Glisser vers le haut fait monter la liste → on avance dans les entrées.
    const next = Math.min(liveRef.current.length - 1, Math.max(0, d.startIdx - Math.round(dy / ITEM_H)));
    if (next !== d.idx) {
      dragRef.current = { ...d, idx: next };
      setDrag(dragRef.current);
    }
  };

  const annuler = () => { dragRef.current = null; setDrag(null); movedRef.current = false; };

  const finir = () => {
    const d = dragRef.current;
    if (!d) return;
    const choisi = liveRef.current[d.idx];
    const bouge = movedRef.current;
    annuler();
    if (!bouge) onTap();
    else if (choisi && choisi.key !== value) onSelect(choisi.key);
  };

  return (
    <div
      className={`wheel${drag && movedRef.current ? " dragging" : ""}`}
      role="button"
      tabIndex={0}
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={finir}
      onPointerCancel={annuler}
    >
      <span className="wheel-nb">{at(idx - 1)?.label ?? ""}</span>
      <span className="wheel-cur">{at(idx)?.label ?? value}</span>
      <span className="wheel-nb">{at(idx + 1)?.label ?? ""}</span>

      {drag && movedRef.current &&
        createPortal(
          <div className="wheel-card">
            {Array.from({ length: RAYON * 2 + 1 }, (_, k) => {
              const i = idx - RAYON + k;
              const e = at(i);
              if (!e) return <div className="wheel-item" key={`v${k}`} />;
              const d = Math.abs(i - idx);
              return (
                <div
                  className={`wheel-item${d === 0 ? " sel" : ""}`}
                  key={e.key}
                  style={{ opacity: Math.max(0.18, 1 - d * 0.22), fontSize: `${Math.max(13, 26 - d * 3.5)}px` }}
                >
                  {e.icon}
                  <span>{e.label}</span>
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
}
