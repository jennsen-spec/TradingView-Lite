import { useEffect, useState } from "react";
import { fetchQuoteDetail, fetchCandles, type QuoteDetail } from "../lib/api";
import { isSynthetic, syntheticDetail, syntheticMetrics, type SyntheticMetrics } from "../lib/portfolios";
import SymbolLogo from "./SymbolLogo";

const CATEGORY: Record<string, string> = {
  EQUITY: "Action", ETF: "ETF", MUTUALFUND: "Fonds", INDEX: "Indice",
  CRYPTOCURRENCY: "Crypto", CURRENCY: "Devise", FUTURE: "Future", OPTION: "Option",
};
const categoryLabel = (t: string | null) => (t ? CATEGORY[t.toUpperCase()] ?? t : null);

// Statut du marché → libellé + classe couleur.
function marketStatus(s: string | null): { label: string; cls: string } {
  const v = (s || "").toUpperCase();
  if (v === "REGULAR") return { label: "Marché ouvert", cls: "open" };
  if (v.startsWith("PRE")) return { label: "Pré-marché", cls: "ext" };
  if (v.startsWith("POST")) return { label: "Après-bourse", cls: "ext" };
  if (v === "CLOSED") return { label: "Marché fermé", cls: "closed" };
  return { label: "", cls: "" };
}

const fr = (n: number, d = 2) => n.toFixed(d).replace(".", ",");
// Compact FR : K (millier) · M (million) · Md (milliard) · Bn (billion = 1e12).
function compact(n: number | null): string {
  if (n == null) return "—";
  const a = Math.abs(n);
  const [div, suf] = a >= 1e12 ? [1e12, "Bn"] : a >= 1e9 ? [1e9, "Md"] : a >= 1e6 ? [1e6, "M"] : a >= 1e3 ? [1e3, "K"] : [1, ""];
  return suf ? `${fr(n / div)} ${suf}` : Math.round(n).toLocaleString("fr-FR");
}

// Fin de mois « MM/AAAA » à partir d'une date ISO.
const moisAn = (t: string) => `${t.slice(5, 7)}/${t.slice(0, 4)}`;

// Volet détail du symbole affiché : nom, bourse, prix + variation, statut, stats clés.
export default function WatchlistDetail({ symbol }: { symbol: string }) {
  const [d, setD] = useState<QuoteDetail | null>(null);
  const [m, setM] = useState<SyntheticMetrics | null>(null);
  const synth = symbol ? syntheticDetail(symbol) : null;

  useEffect(() => {
    if (!symbol) return;
    let stop = false;
    setD(null); setM(null);
    if (isSynthetic(symbol)) {
      // Synthétique : pas de quote Yahoo → on calcule les métriques depuis la série.
      fetchCandles(symbol, "1d").then((r) => { if (!stop) setM(syntheticMetrics(r.candles)); }).catch(() => { /* ignore */ });
    } else {
      fetchQuoteDetail(symbol).then((q) => { if (!stop) setD(q); }).catch(() => { /* ignore */ });
    }
    return () => { stop = true; };
  }, [symbol]);

  if (!symbol) return null;

  // Fiche synthétique : type, composition/stratégie, perf calculée, avertissement.
  if (synth) {
    const sign = (p: number) => (p >= 0 ? "+" : "−");
    return (
      <div className="wl-detail">
        <div className="wl-detail-head">
          <SymbolLogo symbol={symbol} size={26} />
          <span className="wl-detail-sym">{symbol}</span>
        </div>
        <div className="wl-detail-name">{synth.name}</div>
        <div className="wl-detail-meta">{synth.typeLine}</div>

        {m && (
          <div className="wl-detail-price">
            <span className="wl-detail-px">{fr(m.multiple * 100)}</span>
            <span className="wl-detail-cur">CAD</span>
          </div>
        )}

        <div className="wl-syn-desc">{synth.descLabel}<b>{synth.descValue}</b></div>

        <div className="wl-detail-stats">
          <div className="wl-stat"><span>Perf. depuis l'origine</span><b>{m ? `${sign(m.totalReturnPct)}${fr(Math.abs(m.totalReturnPct), 1)} % · ×${fr(m.multiple, 1)}` : "—"}</b></div>
          <div className="wl-stat"><span>Croissance / an</span><b>{m ? `${sign(m.cagrPct)}${fr(Math.abs(m.cagrPct), 1)} %` : "—"}</b></div>
          <div className="wl-stat"><span>Pire baisse</span><b>{m ? `−${fr(Math.abs(m.maxDrawdownPct), 1)} %` : "—"}</b></div>
          <div className="wl-stat"><span>Période</span><b>{m ? `${moisAn(m.from)} → ${moisAn(m.to)}` : "—"}</b></div>
        </div>

        {synth.badge && <div className="wl-syn-badge">⚠ {synth.badge}</div>}
      </div>
    );
  }

  const up = (d?.changePct ?? 0) >= 0;
  const st = marketStatus(d?.marketState ?? null);

  return (
    <div className="wl-detail">
      <div className="wl-detail-head">
        <SymbolLogo symbol={symbol} size={26} />
        <span className="wl-detail-sym">{symbol}</span>
      </div>
      <div className="wl-detail-name">{d?.longName ?? "…"}</div>
      <div className="wl-detail-meta">
        {[d?.exchange, categoryLabel(d?.quoteType ?? null)].filter(Boolean).join(" · ") || " "}
      </div>

      <div className="wl-detail-price">
        <span className="wl-detail-px">{d?.price != null ? fr(d.price) : "—"}</span>
        {d?.currency && <span className="wl-detail-cur">{d.currency}</span>}
        {d?.change != null && d?.changePct != null && (
          <span className={`wl-detail-chg ${up ? "up" : "dn"}`}>
            {up ? "+" : "−"}{fr(Math.abs(d.change))} · {up ? "+" : "−"}{fr(Math.abs(d.changePct))}%
          </span>
        )}
      </div>
      {st.label && <div className={`wl-detail-status ${st.cls}`}>● {st.label}</div>}

      <div className="wl-detail-stats">
        <div className="wl-stat"><span>Volume</span><b>{compact(d?.volume ?? null)}</b></div>
        <div className="wl-stat"><span>Volume moyen (30)</span><b>{compact(d?.avgVolume ?? null)}</b></div>
        <div className="wl-stat"><span>Capitalisation</span><b>{compact(d?.marketCap ?? null)}</b></div>
      </div>
    </div>
  );
}
