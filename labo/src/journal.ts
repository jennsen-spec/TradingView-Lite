// Le journal du backtest — chaque achat, chaque vente, chaque mois en liquidités,
// en dollars, depuis le premier mois où la stratégie a pu jouer.
//
// Modèle monétaire calqué à l'identique sur le moteur :
//   - mois investi : le solde est réparti à parts égales entre les lignes retenues ;
//   - une ligne qui ENTRE paie la fourchette (ticks × pas de cotation ÷ prix d'achat) ;
//     une ligne reconduite ne paie rien, on ne la vend pas pour la racheter ;
//   - achat à l'OUVERTURE de la séance suivant la clôture du signal, vente à
//     l'OUVERTURE de la séance suivant la fin du mois suivant ;
//   - mois en liquidités : solde inchangé.
// Contrôle : solde(t+1) doit égaler solde(t) × (1 + net) du moteur. L'écart mesuré
// est de l'ordre de 1e-14 % — si un jour il grimpe, c'est que les deux modèles ont
// divergé et qu'il ne faut plus croire le journal.

import { chargerMarket, chargerReferences, chargerDividendes, dividendesEntre,
  type Dividendes, type Serie } from "./data.ts";
import { actionsCanadiennes, assainir } from "./qualite.ts";
import { definirReferenceRS } from "./indicateurs.ts";
import { chargerSecteurs, definirSecteurs, secteurDe } from "./secteurs.ts";
import { chargerEtfSectoriels, definirPortes } from "./etfSectoriels.ts";
import { chargerJeu } from "./regles.ts";
import { lancer } from "./moteur.ts";

export interface LigneMois {
  mois: string; reb: string; next: string; ticker: string; secteur: string; achatDate: string; achatPrix: number;
  venteDate: string; ventePrix: number; div: number; ret: number;
  mise: number; frais: number; fin: number; resultat: number; entree: boolean; k: number;
}
export interface Position {
  ticker: string; secteur: string; sigAchat: string; achatDate: string; achatPrix: number;
  sigVente: string; venteDate: string; ventePrix: number; nMois: number;
  mise: number; ajustements: number; produit: number; resultat: number;
  pctPrix: number; div: number; frais: number;
}
export interface Barre {
  mois: string; reb: string; next: string; investi: boolean; n: number;
  avant: number; apres: number; net: number; frais: number;
}
export interface Journal {
  capital: number; soldeFinal: number; ecartMax: number;
  barres: Barre[]; positions: Position[]; lignes: LigneMois[];
  depuis: string; jusqua: string;
}

const pasDeCotation = (prix: number) => (prix < 0.5 ? 0.005 : 0.01);

export async function construireJournal(opts: {
  capital?: number; jeu?: string; ticks?: number; commission?: number; secteurs?: string[];
} = {}): Promise<Journal> {
  const CAPITAL = opts.capital ?? 10_000;
  const TICKS = opts.ticks ?? 2, COMMISSION = opts.commission ?? 0;
  const cout = (prix: number) => COMMISSION + (TICKS * pasDeCotation(prix)) / prix;

  const refs = await chargerReferences(); definirReferenceRS(refs.get("XIU.TO")!);
  const divs: Dividendes = await chargerDividendes();
  const u = assainir(actionsCanadiennes(await chargerMarket()).univers).univers;
  definirSecteurs(await chargerSecteurs(u.series.map((s) => s.ticker)));
  definirPortes(await chargerEtfSectoriels());
  const SEC = new Set(opts.secteurs ?? ["Industrials", "Technology"]);
  const series = u.series.filter((s) => SEC.has(secteurDe(s.ticker)));
  const carte = new Map(series.map((s) => [s.ticker, s]));
  const mois = lancer({ nom: "market", series }, chargerJeu(opts.jeu ?? "c-duo-plaf5-p1"), refs, undefined, divs).mois;

  const apres = (s: Serie, d: string) => {
    const i = s.idx.get(d);
    return i === undefined || i + 1 >= s.dates.length ? null : { date: s.dates[i + 1], prix: s.open[i + 1] };
  };

  const lignes: LigneMois[] = [], barres: Barre[] = [];
  let solde = CAPITAL, ecartMax = 0, demarre = false;
  let prec = new Set<string>(), investiPrec = false;

  mois.forEach((m, k) => {
    const investi = m.investi && m.retenus.length > 0;
    if (!demarre) { if (!investi) { prec = new Set(); investiPrec = false; return; } demarre = true; }
    const avant = solde, lot: LigneMois[] = [];
    if (investi) {
      const mise = avant / m.retenus.length;
      for (const t of m.retenus) {
        const s = carte.get(t)!, a = apres(s, m.reb)!, v = apres(s, m.next)!;
        const div = dividendesEntre(divs, s, a.date, v.date).somme;
        const ret = (v.prix + div) / a.prix - 1;
        const entree = !investiPrec || !prec.has(t);
        const frais = entree ? cout(a.prix) * mise : 0;
        lot.push({ mois: m.next.slice(0, 7), reb: m.reb, next: m.next, ticker: t, secteur: secteurDe(t), achatDate: a.date,
          achatPrix: a.prix, venteDate: v.date, ventePrix: v.prix, div, ret, mise, frais,
          fin: mise * (1 + ret) - frais, resultat: mise * ret - frais, entree, k });
      }
    }
    const apresSolde = avant + lot.reduce((x, l) => x + l.resultat, 0);
    ecartMax = Math.max(ecartMax, Math.abs(apresSolde - avant * (1 + m.net)) / Math.max(1, avant));
    lignes.push(...lot);
    barres.push({ mois: m.next.slice(0, 7), reb: m.reb, next: m.next, investi, n: lot.length,
      avant, apres: apresSolde, net: m.net, frais: lot.reduce((x, l) => x + l.frais, 0) });
    solde = apresSolde; prec = investi ? new Set(m.retenus) : new Set(); investiPrec = investi;
  });

  // Positions = suites de mois consécutifs où le titre est détenu. Entre deux mois
  // la ligne est redimensionnée (poids remis à parts égales) : `ajustements` porte
  // l'argent net ajouté ou retiré en cours de route, sinon le résultat ne boucle pas.
  const parTicker = new Map<string, LigneMois[]>();
  for (const l of lignes) { const a = parTicker.get(l.ticker) ?? []; a.push(l); parTicker.set(l.ticker, a); }
  const positions: Position[] = [];
  for (const [t, ls] of parTicker) {
    ls.sort((a, b) => a.k - b.k);
    let i = 0;
    while (i < ls.length) {
      let j = i; while (j + 1 < ls.length && !ls[j + 1].entree) j++;
      const seg = ls.slice(i, j + 1), fin = seg[seg.length - 1];
      let ajust = 0; for (let q = 1; q < seg.length; q++) ajust += seg[q].mise - seg[q - 1].fin;
      const div = seg.reduce((a, s) => a + s.div, 0);
      positions.push({ ticker: t, secteur: seg[0].secteur, sigAchat: seg[0].reb, achatDate: seg[0].achatDate,
        achatPrix: seg[0].achatPrix, sigVente: fin.next, venteDate: fin.venteDate, ventePrix: fin.ventePrix,
        nMois: seg.length, mise: seg[0].mise, ajustements: ajust, produit: fin.fin,
        resultat: fin.fin - seg[0].mise - ajust, pctPrix: (fin.ventePrix + div) / seg[0].achatPrix - 1,
        div, frais: seg.reduce((a, s) => a + s.frais, 0) });
      i = j + 1;
    }
  }
  positions.sort((a, b) => (a.venteDate === b.venteDate ? (a.ticker < b.ticker ? -1 : 1) : a.venteDate < b.venteDate ? -1 : 1));

  return { capital: CAPITAL, soldeFinal: solde, ecartMax, barres, positions, lignes,
    depuis: barres[0].mois, jusqua: barres[barres.length - 1].mois };
}
