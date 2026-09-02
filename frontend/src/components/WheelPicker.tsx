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
  onTap?: () => void; // tap sans déplacement = comportement d'origine (recherche…) ; sinon rien
  label: string; // libellé accessible
  /** Recharge la liste au début du geste (la collection courante peut avoir changé). */
  refresh?: () => WheelEntry[];
}

const ITEM_H = 34; // pas d'un cran, en pixels de glissement
const SEUIL = 8; // au-delà, c'est un glissement et non un tap
const RAYON = 4; // entrées visibles de chaque côté du centre (réduit si la liste est courte)

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
  // Molette sans butée : l'index boucle, le dernier est suivi du premier.
  const at = (i: number) => (list.length ? list[((i % list.length) + list.length) % list.length] : null);
  // Pas plus de voisins que d'entrées distinctes, sinon la carte répéterait les mêmes.
  const rayon = Math.min(RAYON, Math.max(0, Math.floor((list.length - 1) / 2)));

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
    // Glisser vers le haut fait monter la liste → on avance dans les entrées (sans butée).
    const next = d.startIdx - Math.round(dy / ITEM_H);
    if (next !== d.idx) {
      dragRef.current = { ...d, idx: next };
      setDrag(dragRef.current);
    }
  };

  const annuler = () => { dragRef.current = null; setDrag(null); movedRef.current = false; };

  const finir = () => {
    const d = dragRef.current;
    if (!d) return;
    const n = liveRef.current.length;
    const choisi = n ? liveRef.current[((d.idx % n) + n) % n] : null;
    const bouge = movedRef.current;
    annuler();
    if (!bouge) onTap?.();
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
            {Array.from({ length: rayon * 2 + 1 }, (_, k) => {
              const i = idx - rayon + k;
              const e = at(i);
              if (!e) return <div className="wheel-item" key={`v${k}`} />;
              const d = Math.abs(i - idx);
              return (
                <div
                  className={`wheel-item${d === 0 ? " sel" : ""}`}
                  key={`${e.key}-${k}`}
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
