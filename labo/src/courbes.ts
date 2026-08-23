// Courbes de capital et de « sous l'eau » (drawdown).
//
// La pire baisse résume un seul instant ; elle ne dit ni combien de fois on plonge,
// ni combien de temps on reste sous le sommet précédent. C'est cette seconde question
// qui décide si une stratégie est TENABLE — d'où la courbe de sous-l'eau.

import type { Serie, Dividendes } from "./data.ts";
import { dividendesEntre } from "./data.ts";
import type { MoisResultat } from "./moteur.ts";

export interface Point {
  date: string; // fin du mois mesuré
  equite: number; // base 1 au départ
  sousLeau: number; // (equite / sommet − 1), donc ≤ 0
}

export interface Episode {
  debut: string;
  creux: string;
  fin: string | null; // null = toujours sous l'eau à la fin de la mesure
  profondeur: number; // ≤ 0
  moisSousLeau: number;
  moisPourRevenir: number | null;
}

export function courbe(rendements: { date: string; ret: number }[]): Point[] {
  const pts: Point[] = [];
  let equite = 1;
  let sommet = 1;
  for (const r of rendements) {
    equite *= 1 + r.ret;
    if (equite > sommet) sommet = equite;
    pts.push({ date: r.date, equite, sousLeau: equite / sommet - 1 });
  }
  return pts;
}

// Épisodes de baisse : chaque passage sous le sommet précédent, jusqu'au retour au sommet.
export function episodes(pts: Point[], seuil = -0.05): Episode[] {
  const res: Episode[] = [];
  let courant: { debut: string; creux: string; profondeur: number; iDebut: number; iCreux: number } | null = null;
  pts.forEach((p, i) => {
    if (p.sousLeau < 0) {
      if (!courant) courant = { debut: p.date, creux: p.date, profondeur: p.sousLeau, iDebut: i, iCreux: i };
      else if (p.sousLeau < courant.profondeur) {
        courant.profondeur = p.sousLeau;
        courant.creux = p.date;
        courant.iCreux = i;
      }
    } else if (courant) {
      if (courant.profondeur <= seuil) {
        res.push({
          debut: courant.debut,
          creux: courant.creux,
          fin: p.date,
          profondeur: courant.profondeur,
          moisSousLeau: i - courant.iDebut,
          moisPourRevenir: i - courant.iCreux,
        });
      }
      courant = null;
    }
  });
  if (courant && (courant as any).profondeur <= seuil) {
    const c = courant as any;
    res.push({
      debut: c.debut,
      creux: c.creux,
      fin: null,
      profondeur: c.profondeur,
      moisSousLeau: pts.length - c.iDebut,
      moisPourRevenir: null,
    });
  }
  return res;
}

// Rendements mensuels d'une stratégie (nets de frais).
export function rendementsStrategie(mois: MoisResultat[]): { date: string; ret: number }[] {
  return mois.map((m) => ({ date: m.next, ret: m.net }));
}

// Achat-conservation d'une référence, sur les MÊMES fenêtres mensuelles et la même
// convention d'exécution (ouverture suivante), dividendes inclus.
export function rendementsReference(
  s: Serie,
  fenetres: { reb: string; next: string }[],
  divs?: Dividendes,
): { date: string; ret: number }[] {
  const ouvertureApres = (d: string): { date: string; prix: number } | null => {
    let lo = 0;
    let hi = s.dates.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (s.dates[mid] <= d) lo = mid + 1;
      else hi = mid;
    }
    return lo < s.dates.length ? { date: s.dates[lo], prix: s.open[lo] } : null;
  };
  const out: { date: string; ret: number }[] = [];
  for (const f of fenetres) {
    const a = ouvertureApres(f.reb);
    const v = ouvertureApres(f.next);
    if (!a || !v) continue;
    const div = divs ? dividendesEntre(divs, s, a.date, v.date).somme : 0;
    out.push({ date: f.next, ret: (v.prix + div) / a.prix - 1 });
  }
  return out;
}
