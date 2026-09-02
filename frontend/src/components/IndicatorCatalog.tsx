import { useEffect, useRef, useState } from "react";
import { IND_TYPES } from "../lib/indicatorSettings";
import type { IndType } from "../lib/indicatorSettings";

interface Props {
  favorites: IndType[];
  onAdd: (type: IndType) => void;
  onToggleFavorite: (type: IndType) => void;
}

// Bouton « Indicateurs » (ouvre le catalogue) + chevron (accès rapide aux favoris).
export default function IndicatorCatalog({ favorites, onAdd, onToggleFavorite }: Props) {
  const [open, setOpen] = useState(false); // catalogue
  const [favOpen, setFavOpen] = useState(false); // dropdown favoris
  const [q, setQ] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: Event) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setFavOpen(false);
      }
    };
    // `touchstart` en plus de `mousedown` : sur iOS le tap hors d'un élément
    // interactif ne produit pas toujours de mousedown → le panneau ne fermait pas.
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("touchstart", onDoc);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  const rows = IND_TYPES.filter((t) => t.label.toLowerCase().includes(q.trim().toLowerCase())).filter(
    (t) => (favOnly ? favorites.includes(t.type) : true)
  );
  const favRows = IND_TYPES.filter((t) => favorites.includes(t.type));

  return (
    <div className="icat" ref={ref}>
      <div className="icat-bar">
        <button
          className="icat-main"
          title="Ajouter un indicateur"
          onClick={() => {
            setOpen((o) => !o);
            setFavOpen(false);
          }}
        >
          <span className="icat-ico">+</span>
          {/* Mobile : le libellé cède la place à une icône (barre du bas, #86). */}
          <svg className="icat-svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
            <path d="M2 9c2.5 0 2.5-5 5-5s2.5 5 5 5" />
            <path d="M12 15c2.5 0 2.5-5 5-5s2.5 5 5 5" />
          </svg>
          <span className="icat-label">Indicateurs</span>
        </button>
        <button
          className="icat-chevron"
          aria-label="Favoris"
          title="Favoris (ajout rapide)"
          onClick={() => {
            setFavOpen((o) => !o);
            setOpen(false);
          }}
        >
          ⌄
        </button>
      </div>

      {favOpen && (
        <div className="icat-menu icat-fav">
          {favRows.length === 0 && <div className="icat-empty">Aucun favori</div>}
          {favRows.map((t) => (
            <button
              key={t.type}
              className="icat-fav-row"
              onClick={() => {
                onAdd(t.type);
                setFavOpen(false);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {open && (
        <div className="icat-modal">
          <div className="icat-head">
            <span className="icat-title">Indicateurs</span>
            <button className={`icat-filter${favOnly ? " on" : ""}`} onClick={() => setFavOnly((f) => !f)}>
              ★ Favoris
            </button>
          </div>
          <div className="icat-search">
            <input autoFocus placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="icat-list">
            <div className="icat-list-head">
              <span>Nom</span>
              <span>Favoris</span>
            </div>
            {rows.map((t) => (
              <div className="icat-row" key={t.type}>
                <button className="icat-name" title="Ajouter" onClick={() => onAdd(t.type)}>
                  {t.label}
                </button>
                <button
                  className={`icat-switch${favorites.includes(t.type) ? " on" : ""}`}
                  onClick={() => onToggleFavorite(t.type)}
                  title="Basculer favori"
                >
                  {favorites.includes(t.type) ? "Oui" : "Non"}
                </button>
              </div>
            ))}
            {rows.length === 0 && <div className="icat-empty">Aucun indicateur</div>}
          </div>
        </div>
      )}
    </div>
  );
}
