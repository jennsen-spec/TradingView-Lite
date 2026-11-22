import { useEffect, useMemo, useState } from "react";
import { fetchQuotes } from "../lib/api";
import { CIBLE, rebalancer, tolerance } from "../lib/buyEq";

// BUY EQ (#103) : un seul formulaire (parts détenues + liquidités) → acheter / vendre / conserver.
// Rien n'est mémorisé : l'état vit dans le composant, un rechargement vide tout.

const fmt$ = (n: number) =>
  n.toLocaleString("fr-CA", { style: "currency", currency: "CAD", minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = (x: number | null) => x === null ? "—" : `${(x * 100).toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
const fmtPts = (x: number) => {
  const v = x * 100;
  return `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toLocaleString("fr-CA", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pt`;
};
const fmtHeure = (ms: number) => {
  const d = new Date(ms);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}-${p(d.getMonth() + 1)}-${d.getFullYear()} à ${p(d.getHours())}:${p(d.getMinutes())}`;
};

// Champ vide = 0 ; sinon nombre ≥ 0 (virgule acceptée). NaN = saisie invalide.
function lire(v: string, entier: boolean): number {
  const t = v.replace(/\s/g, "").replace(",", ".");
  if (t === "") return 0;
  if (!/^\d*\.?\d*$/.test(t) || t === ".") return NaN;
  const n = Number(t);
  if (entier && !Number.isInteger(n)) return NaN;
  return n;
}

export default function BuyEqPanel({ onClose }: { onClose?: () => void }) {
  const [saisieParts, setSaisieParts] = useState<Record<string, string>>({});
  const [saisieCash, setSaisieCash] = useState("");
  const [achatsSeulement, setAchatsSeulement] = useState(false);
  const [cours, setCours] = useState<Record<string, number | null> | null>(null);
  const [coursAt, setCoursAt] = useState<number | null>(null);
  const [erreurCours, setErreurCours] = useState<string | null>(null);
  const [chargement, setChargement] = useState(false);

  const chargerCours = () => {
    setChargement(true);
    setErreurCours(null);
    fetchQuotes(CIBLE.map((c) => c.ticker))
      .then((rows) => {
        const m: Record<string, number | null> = {};
        for (const c of CIBLE) m[c.ticker] = rows.find((q) => q.symbol === c.ticker)?.price ?? null;
        setCours(m);
        setCoursAt(Date.now());
      })
      .catch((e) => setErreurCours(e.message ?? "cours indisponibles"))
      .finally(() => setChargement(false));
  };
  useEffect(chargerCours, []);

  const parts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of CIBLE) m[c.ticker] = lire(saisieParts[c.ticker] ?? "", true);
    return m;
  }, [saisieParts]);
  const cash = lire(saisieCash, false);
  const invalides = CIBLE.filter((c) => Number.isNaN(parts[c.ticker])).map((c) => c.label);
  const cashInvalide = Number.isNaN(cash);
  const manquants = cours ? CIBLE.filter((c) => !(cours[c.ticker]! > 0)).map((c) => c.label) : [];

  const res = useMemo(() => {
    if (!cours || manquants.length || invalides.length || cashInvalide) return null;
    return rebalancer(parts, cash, cours as Record<string, number>, achatsSeulement);
  }, [cours, parts, cash, achatsSeulement, manquants.length, invalides.length, cashInvalide]);

  return (
    <div className="buyeq">
      <div className="buyeq-head">
        <div>
          <h2>BUY EQ</h2>
          <div className="buyeq-sub">
            Cible 60/10/30 · {CIBLE.map((c) => `${c.label} ${Math.round(c.poids * 100)}`).join(" · ")}
          </div>
        </div>
        {onClose && (
          <button className="buyeq-close" onClick={onClose} aria-label="Fermer">✕</button>
        )}
      </div>

      <section className="buyeq-form">
        <div className="buyeq-form-title">Mes parts détenues</div>
        {CIBLE.map((c) => {
          const v = saisieParts[c.ticker] ?? "";
          const p = cours?.[c.ticker];
          return (
            <label key={c.ticker} className={`buyeq-field${Number.isNaN(parts[c.ticker]) ? " invalide" : ""}`}>
              <span className="bf-label">
                <b>{c.label}</b>
                <small>{p ? fmt$(p) : cours ? "cours indisponible" : "…"}</small>
              </span>
              <input
                inputMode="numeric"
                placeholder="0"
                value={v}
                onChange={(e) => setSaisieParts((s) => ({ ...s, [c.ticker]: e.target.value }))}
              />
            </label>
          );
        })}
        <label className={`buyeq-field cash${cashInvalide ? " invalide" : ""}`}>
          <span className="bf-label"><b>Liquidités</b><small>CAD</small></span>
          <input
            inputMode="decimal"
            placeholder="0"
            value={saisieCash}
            onChange={(e) => setSaisieCash(e.target.value)}
          />
        </label>
        <label className="buyeq-switch">
          <span>
            <b>Achats seulement</b>
            <small>{achatsSeulement ? "Aucune vente : le cash va aux titres en retard" : "Rebalancement complet, ventes comprises"}</small>
          </span>
          <input
            type="checkbox"
            role="switch"
            checked={achatsSeulement}
            onChange={(e) => setAchatsSeulement(e.target.checked)}
          />
          <i aria-hidden="true" />
        </label>
        <div className="buyeq-cours">
          {erreurCours
            ? <>Cours indisponibles ({erreurCours}). </>
            : coursAt
              ? <>Cours du {fmtHeure(coursAt)} — estimation : les ordres passent à l'ouverture suivante. </>
              : "Chargement des cours… "}
          <button onClick={chargerCours} disabled={chargement}>↻ Actualiser</button>
        </div>
      </section>

      {manquants.length > 0 && (
        <div className="buyeq-msg alerte">
          Cours indisponible pour {manquants.join(", ")} : impossible de valoriser le portefeuille.
        </div>
      )}
      {(invalides.length > 0 || cashInvalide) && (
        <div className="buyeq-msg alerte">
          Saisie invalide{invalides.length ? ` (${invalides.join(", ")} : nombre entier de parts)` : ""}
          {cashInvalide ? " (liquidités : montant en dollars)" : ""}.
        </div>
      )}

      {res && (
        <>
          {achatsSeulement && cash === 0 ? (
            <div className="buyeq-msg">
              Rien à acheter sans liquidités. Désactive <b>Achats seulement</b> pour rebalancer en vendant.
            </div>
          ) : achatsSeulement && res.horsBandeApres ? (
            <div className="buyeq-msg alerte">
              Le cash ne suffit pas à revenir dans la cible. Pour y revenir, désactive <b>Achats seulement</b>.
            </div>
          ) : null}
          {!res.horsBandeAvant && cash === 0 && (
            <div className="buyeq-msg ok">Écart dérisoire : rebalancer est facultatif.</div>
          )}

          <section className="buyeq-lignes">
            {res.lignes.map((l) => {
              const action = l.delta > 0 ? "acheter" : l.delta < 0 ? "vendre" : "conserver";
              const manque = l.cours - res.liquiditesRestantes;
              return (
                <div key={l.ticker} className={`buyeq-ligne${l.horsBandeAvant ? " hors" : ""}`}>
                  <div className="bl-top">
                    <b>{l.label}</b>
                    <span className={`bl-action ${action}`}>
                      {action === "acheter" ? `Acheter ${l.delta}` : action === "vendre" ? `Vendre ${-l.delta}` : l.parts === 0 ? "Pas d'achat" : "Conserver"}
                    </span>
                  </div>
                  <div className="bl-row">
                    <span>{l.parts} → {l.partsApres} parts</span>
                    <span>{l.delta !== 0 ? `${Math.abs(l.delta)} × ${fmt$(l.cours)} = ${fmt$(l.montant)}` : fmt$(l.cours)}</span>
                  </div>
                  <div className="bl-row">
                    <span>
                      {fmtPct(l.pctAvant)} → {fmtPct(l.pctApres)} <small>(cible {fmtPct(l.poids)})</small>
                    </span>
                    <span className="bl-ecart" title={`Bande ±${fmtPct(tolerance(l.poids)).replace(" %", " pt")}`}>
                      {l.pctAvant === null ? "" : `écart ${fmtPts(l.pctAvant - l.poids)}`}
                      {l.pctAvant !== null && l.horsBandeAvant ? " · hors bande" : ""}
                    </span>
                  </div>
                  <div className="bl-manque">
                    {manque > 0 ? `Il manque ${fmt$(manque)} pour une part de plus` : "Une part de plus est possible"}
                  </div>
                </div>
              );
            })}
          </section>

          <section className="buyeq-recap">
            <div><span>Valeur totale (titres + liquidités)</span><b>{fmt$(res.total)}</b></div>
            <div><span>Cash dégagé par les ventes</span><b>{fmt$(res.cashVentes)}</b></div>
            <div><span>Cash utilisé par les achats</span><b>{fmt$(res.cashAchats)}</b></div>
            <div className="fort">
              <span>Liquidités restantes</span>
              <b>{fmt$(res.liquiditesRestantes)} <small>({fmtPct(res.liquiditesRestantes / res.total)})</small></b>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
