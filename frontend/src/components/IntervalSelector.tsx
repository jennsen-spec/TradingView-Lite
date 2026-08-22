import { useEffect, useRef, useState } from "react";
import { syncToCloud } from "../lib/cloudPrefs";

// Catalogue d'intervalles. Intraday (min/heures) = historique court côté Yahoo.
const CATALOG = [
  { key: "5m", short: "5m", label: "5 minutes", group: "Minutes" },
  { key: "15m", short: "15m", label: "15 minutes", group: "Minutes" },
  { key: "30m", short: "30m", label: "30 minutes", group: "Minutes" },
  { key: "1h", short: "1h", label: "1 heure", group: "Heures" },
  { key: "4h", short: "4h", label: "4 heures", group: "Heures" },
  { key: "1d", short: "1J", label: "1 jour", group: "Jours" },
  { key: "1w", short: "1S", label: "1 semaine", group: "Jours" },
  { key: "1mo", short: "1M", label: "1 mois", group: "Jours" },
  { key: "3mo", short: "3M", label: "3 mois", group: "Jours" },
  { key: "6mo", short: "6M", label: "6 mois", group: "Jours" },
  { key: "12mo", short: "1A", label: "12 mois", group: "Jours" },
];
const GROUPS = ["Minutes", "Heures", "Jours"]; // seuls les groupes présents s'affichent
const LS_KEY = "tvlike:interval-favorites";
const DEFAULT_FAVS = ["5m", "15m", "30m", "1h", "1d", "1w", "1mo", "3mo"];

function loadFavs(): string[] {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return DEFAULT_FAVS;
}

interface Props {
  value: string;
  onChange: (key: string) => void;
}

export default function IntervalSelector({ value, onChange }: Props) {
  const [favs, setFavs] = useState<string[]>(loadFavs);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(LS_KEY, JSON.stringify(favs));
    syncToCloud(LS_KEY); // sinon l'hydratation au démarrage restaure l'ancienne valeur du cloud
  }, [favs]);

  // Fermer le menu au clic en dehors.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const toggleFav = (key: string) =>
    setFavs((f) => (f.includes(key) ? f.filter((k) => k !== key) : [...f, key]));

  const favItems = CATALOG.filter((it) => favs.includes(it.key));
  const grouped = GROUPS.map(
    (g) => [g, CATALOG.filter((it) => it.group === g)] as const
  ).filter(([, items]) => items.length > 0);

  return (
    <div className="interval-selector" ref={ref}>
      <div className="iv-bar">
        {favItems.map((it) => (
          <button
            key={it.key}
            className={value === it.key ? "active" : ""}
            onClick={() => onChange(it.key)}
            title={it.label}
          >
            {it.short}
          </button>
        ))}
        <button
          className={`iv-chevron${open ? " open" : ""}`}
          onClick={() => setOpen((o) => !o)}
          aria-label="Tous les intervalles"
        >
          ⌄
        </button>
      </div>

      {open && (
        <div className="iv-menu">
          {grouped.map(([group, items]) => (
            <div key={group} className="iv-group">
              <div className="iv-group-title">{group.toUpperCase()}</div>
              {items.map((it) => (
                <div key={it.key} className={`iv-row${value === it.key ? " active" : ""}`}>
                  <button
                    className="iv-row-label"
                    onClick={() => {
                      onChange(it.key);
                      setOpen(false);
                    }}
                  >
                    {it.label}
                  </button>
                  <button
                    className={`iv-star${favs.includes(it.key) ? " on" : ""}`}
                    onClick={() => toggleFav(it.key)}
                    aria-label="Favori"
                    title="Ajouter/retirer des favoris"
                  >
                    ★
                  </button>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
