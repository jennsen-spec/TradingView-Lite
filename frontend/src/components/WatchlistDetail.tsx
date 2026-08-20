import { useEffect, useState } from "react";
import { fetchQuoteDetail, type QuoteDetail } from "../lib/api";
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

// Volet détail du symbole affiché : nom, bourse, prix + variation, statut, stats clés.
export default function WatchlistDetail({ symbol }: { symbol: string }) {
  const [d, setD] = useState<QuoteDetail | null>(null);

  useEffect(() => {
    if (!symbol) return;
    let stop = false;
    setD(null);
    fetchQuoteDetail(symbol).then((q) => { if (!stop) setD(q); }).catch(() => { /* ignore */ });
    return () => { stop = true; };
  }, [symbol]);

  if (!symbol) return null;
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
