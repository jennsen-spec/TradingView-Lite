// Formatage des étiquettes horaires selon l'intervalle du graphique (détail adaptatif).
// UTC : les temps journaliers/mensuels sont à minuit UTC et les intraday déjà décalés (gmt) → getUTC* donne le bon libellé.
import type { Time } from "./indicators";

const tsOf = (t: Time) => (typeof t === "number" ? t : Date.parse(t) / 1000);

type Detail = "time" | "day" | "month" | "year";

// Niveau de détail par intervalle : intraday = heure ; jour/semaine = jour ; mois/trim/sem. = mois ; an = année.
function detailForInterval(interval: string): Detail {
  switch (interval) {
    case "5m": case "15m": case "30m": case "1h": case "4h": return "time";
    case "1d": case "1w": return "day";
    case "1mo": case "3mo": case "6mo": return "month";
    case "12mo": return "year";
    default: return "day";
  }
}

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

// style "numeric" → 01-01-2026 / 01-2026 / 2026 / 01-01-2026 09:30
// style "letter"  → 01 jan '26 / jan '26 / 2026 / 01 jan '26 09:30
export function fmtTimeByInterval(time: Time, interval: string, style: "numeric" | "letter" = "numeric"): string {
  const d = new Date(tsOf(time) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const detail = detailForInterval(interval);
  const dd = p(d.getUTCDate()), mm = p(d.getUTCMonth() + 1), yyyy = d.getUTCFullYear();
  const HH = p(d.getUTCHours()), MM = p(d.getUTCMinutes());

  if (style === "letter") {
    const mmm = MONTHS[d.getUTCMonth()], yy = String(yyyy).slice(2);
    if (detail === "year") return String(yyyy);
    if (detail === "month") return `${mmm} '${yy}`;
    const base = `${dd} ${mmm} '${yy}`;
    return detail === "time" ? `${base} ${HH}:${MM}` : base;
  }
  if (detail === "year") return String(yyyy);
  if (detail === "month") return `${mm}-${yyyy}`;
  const base = `${dd}-${mm}-${yyyy}`;
  return detail === "time" ? `${base} ${HH}:${MM}` : base;
}
