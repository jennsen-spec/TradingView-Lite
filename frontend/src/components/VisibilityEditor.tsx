// Bloc de visibilité par unité de temps (commun indicateurs #7 <-> dessins #4).
import type { Visibility } from "../lib/indicatorSettings";

const VIS_ROWS: { key: keyof Visibility; label: string }[] = [
  { key: "minutes", label: "Minutes" },
  { key: "jours", label: "Jours" },
  { key: "semaines", label: "Semaines" },
  { key: "mois", label: "Mois" },
];

interface Props {
  visibility: Visibility;
  onChange: (v: Visibility) => void;
}

export default function VisibilityEditor({ visibility, onChange }: Props) {
  const setVis = (unit: keyof Visibility, patch: Partial<Visibility[keyof Visibility]>) =>
    onChange({ ...visibility, [unit]: { ...visibility[unit], ...patch } });

  return (
    <div className="is-vis">
      {VIS_ROWS.map(({ key, label }) => {
        const u = visibility[key];
        return (
          <div className="is-vis-row" key={key}>
            <label className="is-check">
              <input type="checkbox" checked={u.on} onChange={(e) => setVis(key, { on: e.target.checked })} />
              {label}
            </label>
            <input
              type="number" className="is-vis-num" value={u.min} disabled={!u.on}
              onChange={(e) => setVis(key, { min: Number(e.target.value) || 0 })}
            />
            <span className="is-vis-sep">→</span>
            <input
              type="number" className="is-vis-num" value={u.max} disabled={!u.on}
              onChange={(e) => setVis(key, { max: Number(e.target.value) || 0 })}
            />
          </div>
        );
      })}
    </div>
  );
}
