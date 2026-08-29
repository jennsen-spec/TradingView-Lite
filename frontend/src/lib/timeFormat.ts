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
// Jour de la semaine, abréviations demandées par Jean (28/08) — l'index suit getUTCDay (0 = dimanche).
const JOURS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];
const MOIS_FR = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juill.", "août", "sept.", "oct.", "nov.", "déc."];

// style "numeric" → 01-01-2026 / 01-2026 / 2026 / 01-01-2026 09:30
// style "letter"  → 01 jan '26 / jan '26 / 2026 / 01 jan '26 09:30
export function fmtTimeByInterval(time: Time, interval: string, style: "numeric" | "letter" = "numeric"): string {
  const d = new Date(tsOf(time) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const detail = detailForInterval(interval);
  const dd = p(d.getUTCDate()), mm = p(d.getUTCMonth() + 1), yyyy = d.getUTCFullYear();
  const HH = p(d.getUTCHours()), MM = p(d.getUTCMinutes());

  const jour = JOURS[d.getUTCDay()];
  if (style === "letter") {
    const mmm = MONTHS[d.getUTCMonth()], yy = String(yyyy).slice(2);
    if (detail === "year") return String(yyyy);
    if (detail === "month") return `${mmm} '${yy}`;
    const base = `${jour} ${dd} ${mmm} '${yy}`;
    return detail === "time" ? `${base} ${HH}:${MM}` : base;
  }
  if (detail === "year") return String(yyyy);
  if (detail === "month") return `${mm}-${yyyy}`;
  const base = `${jour} ${dd}-${mm}-${yyyy}`;
  return detail === "time" ? `${base} ${HH}:${MM}` : base;
}

// Libellé du CURSEUR (axe du temps) : toujours la date complète de la bougie, avec le
// jour de la semaine — c'est lui que Jean lit pour dater une bougie, quel que soit
// l'intervalle. En français, comme l'affichait la locale du navigateur avant lui.
// Intraday : l'heure s'ajoute. (Les graduations de l'axe, elles, ne changent pas.)
export function fmtCrosshair(time: Time, interval: string): string {
  const d = new Date(tsOf(time) * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const base = `${JOURS[d.getUTCDay()]} ${p(d.getUTCDate())} ${MOIS_FR[d.getUTCMonth()]} '${String(d.getUTCFullYear()).slice(2)}`;
  return detailForInterval(interval) === "time" ? `${base} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}` : base;
}

// Durée civile entre deux instants, en clair : « 2 ans, 3 mois et 2 jours »,
// « 1 an et 15 jours », « 3 mois », « 12 jours ». Décomposition calendaire
// (on avance d'abord les ans, puis les mois, puis les jours restants), donc
// « 1 an » va bien du 15 mars au 15 mars. Demandé par Jean (29/08) pour l'outil
// de mesure. Vide si moins d'un jour (mesure intraday).
// `unites` (#65) : une unité plus grande désactivée est REPORTÉE sur l'inférieure
// (16 ans 9 mois → 201 mois — on ne l'extrait pas, elle coule dans la suivante) ;
// une plus petite est TRONQUÉE. Si la troncature ne laisse rien alors que la durée
// dépasse le jour, on affiche « 0 <unité> » plutôt que rien.
export interface DureeUnites { ans: boolean; mois: boolean; jours: boolean }
export function dureeEntre(t0: Time, t1: Time, unites?: DureeUnites): string {
  const u = unites ?? { ans: true, mois: true, jours: true };
  let a = new Date(Math.min(tsOf(t0), tsOf(t1)) * 1000);
  const b = new Date(Math.max(tsOf(t0), tsOf(t1)) * 1000);
  const avance = (d: Date, mois: number) => {
    const x = new Date(d); x.setUTCMonth(x.getUTCMonth() + mois);
    // Fin de mois : « 31 janv. + 1 mois » déborde sur le 2-3 mars → rabattre au dernier jour de février.
    if (x.getUTCDate() < d.getUTCDate()) x.setUTCDate(0);
    return x;
  };
  let ans = 0, mois = 0;
  if (u.ans) while (avance(a, 12) <= b) { a = avance(a, 12); ans++; }
  if (u.mois) while (avance(a, 1) <= b) { a = avance(a, 1); mois++; }
  const jours = Math.floor((b.getTime() - a.getTime()) / 86400000);
  const parts: string[] = [];
  if (u.ans && ans) parts.push(`${ans} an${ans > 1 ? "s" : ""}`);
  if (u.mois && mois) parts.push(`${mois} mois`);
  if (u.jours && jours) parts.push(`${jours} jour${jours > 1 ? "s" : ""}`);
  if (!parts.length) {
    // Moins d'un jour : mesure intraday, rien à dire ici (fmtDuration prend le relais).
    if (jours < 1) return "";
    // ≥ 1 jour mais tout tronqué (ex. « 12 jours » sans Jour) : « 0 mois », pas le silence.
    return u.jours ? "0 jour" : u.mois ? "0 mois" : "0 an";
  }
  return parts.length === 1 ? parts[0]
    : parts.slice(0, -1).join(", ") + " et " + parts[parts.length - 1];
}
