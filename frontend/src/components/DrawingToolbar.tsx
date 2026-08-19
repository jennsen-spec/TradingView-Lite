import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Outils de la barre (concept UI : "arrow" = trait à embout flèche ; le reste = types de dessin).
export type Tool = "cursor" | "trend" | "arrow" | "vline" | "channel" | "brush" | "fib" | "longpos";

interface ToolDef {
  key: Tool;
  label: string;
  icon: React.ReactNode;
}

// Curseur (sélection) + outils de dessin. (Trait ici ; #32/#33/#34/#35 s'ajouteront.)
const TOOLS: ToolDef[] = [
  {
    key: "cursor",
    label: "Curseur",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
        <path d="M5 3l14 8-6 1.5L9.5 19z" />
      </svg>
    ),
  },
  {
    key: "trend",
    label: "Trait (ligne de tendance)",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="20" x2="20" y2="4" />
        <circle cx="4" cy="20" r="2" fill="currentColor" stroke="none" />
        <circle cx="20" cy="4" r="2" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    key: "arrow",
    label: "Flèche",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="4" y1="20" x2="19" y2="5" />
        <polyline points="11 4 20 4 20 13" />
      </svg>
    ),
  },
  {
    key: "vline",
    label: "Ligne verticale",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="12" y1="3" x2="12" y2="21" />
      </svg>
    ),
  },
  {
    key: "channel",
    label: "Canal parallèle",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="15" x2="21" y2="7" />
        <line x1="3" y1="20" x2="21" y2="12" />
      </svg>
    ),
  },
  {
    key: "fib",
    label: "Retracement de Fibonacci",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="3" y1="5" x2="21" y2="5" />
        <line x1="3" y1="10" x2="21" y2="10" />
        <line x1="3" y1="15" x2="21" y2="15" />
        <line x1="3" y1="20" x2="21" y2="20" />
      </svg>
    ),
  },
  {
    key: "longpos",
    label: "Position longue",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="4" y="4" width="16" height="16" rx="1.5" />
        <line x1="4" y1="12" x2="20" y2="12" />
        <line x1="9" y1="8" x2="15" y2="8" strokeWidth="1.5" opacity="0.6" />
        <line x1="9" y1="16" x2="15" y2="16" strokeWidth="1.5" opacity="0.6" />
      </svg>
    ),
  },
  {
    key: "brush",
    label: "Surligneur",
    icon: (
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 20c3-1 4-4 7-7l6-6" />
        <path d="M14 4l6 6-3 3-6-6z" fill="currentColor" stroke="none" opacity="0.5" />
      </svg>
    ),
  },
];

interface Props {
  active: Tool;
  onSelect: (t: Tool) => void;
}

// Barre horizontale ; repli en dropdown « ⋯ » quand la place manque (responsive).
export default function DrawingToolbar({ active, onSelect }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Détecte l'overflow : si les boutons ne tiennent pas, on replie tout en dropdown.
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const check = () => {
      // Mesure la largeur naturelle des boutons vs la place dispo.
      const need = row.scrollWidth;
      const have = row.clientWidth;
      setCollapsed(need - have > 1);
    };
    const ro = new ResizeObserver(check);
    ro.observe(row);
    check();
    return () => ro.disconnect();
  }, []);

  // Ferme le dropdown au clic extérieur.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const activeDef = TOOLS.find((t) => t.key === active) ?? TOOLS[0];

  return (
    <div className="draw-toolbar" ref={wrapRef}>
      {/* Rangée mesurée (masquée visuellement si repliée, mais garde sa largeur pour le calcul). */}
      <div className={`dt-row${collapsed ? " dt-measuring" : ""}`} ref={rowRef}>
        {TOOLS.map((t) => (
          <button
            key={t.key}
            className={`dt-btn${active === t.key ? " active" : ""}`}
            title={t.label}
            aria-label={t.label}
            onClick={() => onSelect(t.key)}
          >
            {t.icon}
          </button>
        ))}
      </div>

      {collapsed && (
        <div className="dt-collapsed">
          <button
            className="dt-btn active"
            title={activeDef.label}
            onClick={() => setOpen((o) => !o)}
          >
            {activeDef.icon}
            <span className="dt-chevron">⌄</span>
          </button>
          {open && (
            <div className="dt-menu">
              {TOOLS.map((t) => (
                <button
                  key={t.key}
                  className={`dt-menu-item${active === t.key ? " active" : ""}`}
                  onClick={() => {
                    onSelect(t.key);
                    setOpen(false);
                  }}
                >
                  <span className="dt-menu-ico">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
