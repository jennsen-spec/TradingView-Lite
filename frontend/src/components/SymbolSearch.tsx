import { useEffect, useMemo, useRef, useState } from "react";
import { searchSymbols, type SymbolHit } from "../lib/api";

interface Props {
  onSelect?: (symbol: string) => void;
  onClose: () => void;
  mode?: "select" | "add"; // "add" = ajout à une collection (un « + » par ligne, reste ouverte)
  onAdd?: (symbol: string) => void;
  currentSymbol?: string; // symbole affiché sur le graphe (ajout rapide en mode « add »)
}

const CATEGORIES = [
  { key: "tous", label: "Tous" },
  { key: "action", label: "Actions" },
  { key: "fonds", label: "ETF & Fonds" },
  { key: "obligation", label: "Obligations" },
  { key: "crypto", label: "Crypto" },
  { key: "indice", label: "Indices" },
];

// Métadonnées pays : drapeau + région (pour la vue « Sources »).
const COUNTRY_META: Record<string, { flag: string; region: string }> = {
  USA: { flag: "🇺🇸", region: "Amérique du Nord" },
  Canada: { flag: "🇨🇦", region: "Amérique du Nord" },
  Mexique: { flag: "🇲🇽", region: "Amérique du Nord" },
  "Royaume-Uni": { flag: "🇬🇧", region: "Europe" },
  Allemagne: { flag: "🇩🇪", region: "Europe" },
  France: { flag: "🇫🇷", region: "Europe" },
  "Pays-Bas": { flag: "🇳🇱", region: "Europe" },
  Belgique: { flag: "🇧🇪", region: "Europe" },
  Portugal: { flag: "🇵🇹", region: "Europe" },
  Espagne: { flag: "🇪🇸", region: "Europe" },
  Italie: { flag: "🇮🇹", region: "Europe" },
  Suisse: { flag: "🇨🇭", region: "Europe" },
  Suède: { flag: "🇸🇪", region: "Europe" },
  Finlande: { flag: "🇫🇮", region: "Europe" },
  Norvège: { flag: "🇳🇴", region: "Europe" },
  Danemark: { flag: "🇩🇰", region: "Europe" },
  Autriche: { flag: "🇦🇹", region: "Europe" },
  Pologne: { flag: "🇵🇱", region: "Europe" },
  Brésil: { flag: "🇧🇷", region: "Amérique du Sud" },
  Argentine: { flag: "🇦🇷", region: "Amérique du Sud" },
  Chili: { flag: "🇨🇱", region: "Amérique du Sud" },
  Thaïlande: { flag: "🇹🇭", region: "Asie" },
  "Hong Kong": { flag: "🇭🇰", region: "Asie" },
  Japon: { flag: "🇯🇵", region: "Asie" },
  Inde: { flag: "🇮🇳", region: "Asie" },
  Australie: { flag: "🇦🇺", region: "Océanie" },
  "Afrique du Sud": { flag: "🇿🇦", region: "Afrique" },
  Israël: { flag: "🇮🇱", region: "Moyen-Orient" },
  Crypto: { flag: "🌐", region: "Autre" },
  Forex: { flag: "💱", region: "Autre" },
  Autre: { flag: "🏳️", region: "Autre" },
};
const REGION_ORDER = [
  "Amérique du Nord",
  "Europe",
  "Amérique du Sud",
  "Asie",
  "Océanie",
  "Afrique",
  "Moyen-Orient",
  "Autre",
];

// Surligne la portion de `text` qui correspond à la recherche `q`.
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <span className="hl">{text.slice(idx, idx + q.length)}</span>
      {text.slice(idx + q.length)}
    </>
  );
}

export default function SymbolSearch({ onSelect, onClose, mode = "select", onAdd, currentSymbol }: Props) {
  // Choisit un symbole : en mode « add » on l'ajoute (la fenêtre reste ouverte) ; sinon on le sélectionne.
  const pick = (sym: string) => {
    if (mode === "add") onAdd?.(sym);
    else onSelect?.(sym);
  };
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SymbolHit[]>([]);
  const [category, setCategory] = useState("tous");
  const [country, setCountry] = useState(""); // "" = tous les pays
  const [view, setView] = useState<"results" | "sources">("results");
  const [countryQuery, setCountryQuery] = useState("");
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const [currentHit, setCurrentHit] = useState<SymbolHit | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Mode « add » : récupère les infos du symbole affiché sur le graphe (nom, type, bourse)
  // pour l'afficher comme une ligne de résultat normale (ajout rapide).
  useEffect(() => {
    if (mode !== "add" || !currentSymbol) return;
    let cancelled = false;
    searchSymbols(currentSymbol)
      .then((res) => {
        if (cancelled) return;
        const exact = res.find((h) => h.symbol.toUpperCase() === currentSymbol.toUpperCase());
        setCurrentHit(exact ?? res[0] ?? null);
      })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [mode, currentSymbol]);

  // Recherche débouncée (250 ms après la dernière frappe).
  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setHits([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      searchSymbols(q)
        .then((res) => {
          setHits(res);
          setActive(0);
          setCountry(""); // nouvelle recherche → on réinitialise le filtre pays
        })
        .catch(() => setHits([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  // Résultats filtrés par catégorie, puis par pays.
  const catFiltered = useMemo(
    () => (category === "tous" ? hits : hits.filter((h) => h.category === category)),
    [hits, category]
  );
  const filtered = useMemo(
    () => (country ? catFiltered.filter((h) => h.country === country) : catFiltered),
    [catFiltered, country]
  );

  useEffect(() => setActive(0), [category, country]);

  // Pays présents dans les résultats (de la catégorie courante), groupés par région.
  const groupedCountries = useMemo(() => {
    const q = countryQuery.trim().toLowerCase();
    const set = new Set(catFiltered.map((h) => h.country).filter(Boolean));
    const list = [...set].filter((c) => !q || c.toLowerCase().includes(q));
    const byRegion: Record<string, string[]> = {};
    for (const c of list) {
      const region = COUNTRY_META[c]?.region || "Autre";
      (byRegion[region] ||= []).push(c);
    }
    for (const r in byRegion) byRegion[r].sort((a, b) => a.localeCompare(b));
    return REGION_ORDER.filter((r) => byRegion[r]?.length).map(
      (r) => [r, byRegion[r]] as [string, string[]]
    );
  }, [catFiltered, countryQuery]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active].symbol);
      else if (query.trim()) pick(query.trim().toUpperCase());
    }
  };

  const pickCountry = (c: string) => {
    setCountry(c);
    setView("results");
    setCountryQuery("");
  };

  return (
    <div
      className="search-overlay"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-modal" role="dialog" aria-label="Recherche de symbole">
        {view === "results" ? (
          <>
            <div className="search-head">
              <h2>{mode === "add" ? "Ajouter un symbole" : "Recherche de symbole"}</h2>
              <button className="search-close" onClick={onClose} aria-label="Fermer">
                ✕
              </button>
            </div>

            <div className="search-inputwrap">
              <span className="search-ico">🔍</span>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Rechercher par tick ou nom (ex : BRK, Apple)"
                spellCheck={false}
              />
              {query && (
                <button className="search-clear" onClick={() => setQuery("")} aria-label="Effacer">
                  ✕
                </button>
              )}
            </div>

            <div className="search-tabs">
              {CATEGORIES.map((c) => (
                <button
                  key={c.key}
                  className={category === c.key ? "active" : ""}
                  onClick={() => setCategory(c.key)}
                >
                  {c.label}
                </button>
              ))}
            </div>

            {/* Ligne de filtre pays : seulement après avoir choisi une catégorie. */}
            {category !== "tous" && (
              <div className="search-subfilters">
                <button className="pays-chip" onClick={() => setView("sources")}>
                  <span className="globe">{country ? COUNTRY_META[country]?.flag : "🌐"}</span>
                  {country || "Tous les pays"}
                  <span className="chev">⌄</span>
                </button>
              </div>
            )}

            <ul className="search-results">
              {loading && <li className="search-empty">Chargement…</li>}
              {!loading && query && filtered.length === 0 && (
                <li className="search-empty">Aucun résultat</li>
              )}
              {!loading && !query && mode === "add" && currentSymbol && (
                <li className="cur-quick" onMouseEnter={() => setActive(-1)}>
                  <span className="r-sym">{currentHit?.symbol ?? currentSymbol}</span>
                  <span className="r-name">{currentHit?.name ?? "Affiché sur le graphe"}</span>
                  <span className="r-meta">
                    {currentHit && (
                      <>
                        <span className="r-type">{currentHit.type}</span>
                        <span className="r-exch">{currentHit.exchange}</span>
                      </>
                    )}
                  </span>
                  <button
                    className="r-add"
                    title={`Ajouter ${currentSymbol}`}
                    onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pick(currentSymbol); }}
                  >
                    +
                  </button>
                </li>
              )}
              {!loading && !query && !(mode === "add" && currentSymbol) && (
                <li className="search-empty">Tapez un tick ou un nom d'entreprise.</li>
              )}
              {!loading &&
                filtered.map((h, i) => (
                  <li
                    key={`${h.symbol}-${h.exchange}-${i}`}
                    className={i === active ? "active" : ""}
                    onMouseEnter={() => setActive(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      if (mode !== "add") pick(h.symbol);
                    }}
                  >
                    <span className="r-sym">
                      <Highlight text={h.symbol} q={query.trim()} />
                    </span>
                    <span className="r-name">
                      <Highlight text={h.name} q={query.trim()} />
                    </span>
                    <span className="r-meta">
                      <span className="r-type">{h.type}</span>
                      <span className="r-exch">{h.exchange}</span>
                    </span>
                    {mode === "add" && (
                      <button
                        className="r-add"
                        title={`Ajouter ${h.symbol}`}
                        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); pick(h.symbol); }}
                      >
                        +
                      </button>
                    )}
                  </li>
                ))}
            </ul>
          </>
        ) : (
          /* --- Vue « Sources » : choix du pays --- */
          <>
            <div className="search-head">
              <button
                className="search-back"
                onClick={() => setView("results")}
                aria-label="Retour"
              >
                ‹
              </button>
              <h2>Sources</h2>
              <button className="search-close" onClick={onClose} aria-label="Fermer">
                ✕
              </button>
            </div>

            <div className="search-inputwrap">
              <span className="search-ico">🔍</span>
              <input
                autoFocus
                value={countryQuery}
                onChange={(e) => setCountryQuery(e.target.value)}
                placeholder="Chercher"
                spellCheck={false}
              />
            </div>

            <ul className="sources-list">
              <li
                className={`source-all${country === "" ? " active" : ""}`}
                onMouseDown={(e) => {
                  e.preventDefault();
                  pickCountry("");
                }}
              >
                <span className="globe">🌐</span> Tous les pays
              </li>

              {groupedCountries.map(([region, countries]) => (
                <li key={region} className="source-group">
                  <div className="source-region">{region.toUpperCase()}</div>
                  {countries.map((c) => (
                    <div
                      key={c}
                      className={`source-country${country === c ? " active" : ""}`}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        pickCountry(c);
                      }}
                    >
                      <span className="flag">{COUNTRY_META[c]?.flag || "🏳️"}</span>
                      {c}
                    </div>
                  ))}
                </li>
              ))}

              {groupedCountries.length === 0 && (
                <li className="search-empty">Aucun pays</li>
              )}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}
