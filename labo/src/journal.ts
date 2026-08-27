// Le journal du backtest — chaque achat, chaque vente, chaque mois en liquidités,
// en dollars, depuis le premier mois où la stratégie a pu jouer.
//
// Modèle monétaire calqué à l'identique sur le moteur :
//   - mois investi : le solde est réparti à parts égales entre les lignes retenues ;
//   - une ligne qui ENTRE paie la fourchette (ticks × pas de cotation ÷ prix d'achat) ;
//     une ligne reconduite ne paie rien, on ne la vend pas pour la racheter ;
//   - vente à l'OUVERTURE de la séance suivant la fin du mois suivant ; achat à
//     l'OUVERTURE de la séance suivant la clôture du signal — SAUF sous l'hypothèse de
//     financement `differe`, où une ligne qui ENTRE attend le produit des ventes
//     (clôture du même jour, ou ouverture du lendemain). Une ligne reconduite n'est
//     jamais vendue, donc jamais décalée ;
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
  differe: "aucun" | "cloture" | "lendemain"; // l'hypothèse RÉELLEMENT appliquée
  // #61 — le dernier mois INVESTI que le moteur connaît, tickers triés : le test de
  // conformité vérifie que le rapport (cycleCalc) retient les mêmes titres à ce signal.
  moteurDernier: { reb: string; retenus: string[] } | null;

  barres: Barre[]; positions: Position[]; lignes: LigneMois[];
  depuis: string; jusqua: string;
}

const pasDeCotation = (prix: number) => (prix < 0.5 ? 0.005 : 0.01);

export async function construireJournal(opts: {
  capital?: number; jeu?: string; ticks?: number; commission?: number; secteurs?: string[];
  differe?: "aucun" | "cloture" | "lendemain"; depuis?: string;
  // #62 — pondération des lignes. « egale » (défaut) : le modèle du backtest, dix parts
  // égales chaque mois, reconduites comprises. « derivante » : la pratique réelle — une
  // reconduite garde sa valeur, seules les entrantes se partagent, à parts égales entre
  // elles, l'argent libéré par les sortantes.
  ponderation?: "egale" | "derivante";
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
  // L'hypothèse de financement appartient au JEU DE RÈGLES, pas à l'appelant : sinon
  // chaque script doit se souvenir de la passer, et un oubli produit en silence des
  // chiffres « même encan » au milieu d'un dossier qui dit « vendre d'abord ».
  // `opts.differe` ne sert plus qu'aux mesures de sensibilité qui comparent exprès
  // les deux hypothèses.
  const jeuBase = chargerJeu(opts.jeu ?? "c-duo-plaf5-p1-seance");
  const DIFFERE = opts.differe ?? jeuBase.execution?.achat_differe ?? "aucun";
  const jeu = { ...jeuBase, execution: { modele: "ouverture" as const, marge: 0,
    vente_penalisee: false, achat_differe: DIFFERE } };
  const tous = lancer({ nom: "market", series }, jeu, refs, undefined, divs).mois;
  const mois = opts.depuis ? tous.filter((m) => m.reb >= opts.depuis!) : tous;

  const apres = (s: Serie, d: string) => {
    const i = s.idx.get(d);
    return i === undefined || i + 1 >= s.dates.length ? null : { date: s.dates[i + 1], prix: s.open[i + 1] };
  };
  // Prix d'achat effectif : identique au moteur, décalage compris.
  const achatDe = (s: Serie, reb: string, entree: boolean) => {
    const base = apres(s, reb)!;
    if (!entree || DIFFERE === "aucun") return base;
    const j = s.idx.get(base.date)!;
    if (DIFFERE === "cloture") return { date: base.date, prix: s.close[j] };
    return j + 1 < s.dates.length ? { date: s.dates[j + 1], prix: s.open[j + 1] } : base;
  };

  const PONDERATION = opts.ponderation ?? "egale";
  const lignes: LigneMois[] = [], barres: Barre[] = [];
  let solde = CAPITAL, ecartMax = 0, demarre = false;
  let prec = new Set<string>(), investiPrec = false;
  let finsPrec = new Map<string, number>(); // ticker → valeur de fin du mois précédent

  mois.forEach((m, k) => {
    const investi = m.investi && m.retenus.length > 0;
    if (!demarre) { if (!investi) { prec = new Set(); investiPrec = false; return; } demarre = true; }
    const avant = solde, lot: LigneMois[] = [];
    let cashDormant = 0; // mode dérivante : l'argent qu'aucune entrante ne réclame
    if (investi) {
      const mise = avant / m.retenus.length;
      // Mode dérivante : les reconduites reprennent leur valeur de fin du mois
      // précédent ; les entrantes se partagent le reste. S'il n'y a aucune entrante
      // et que des sortantes ont libéré du cash, il dort jusqu'au mois suivant —
      // c'est exactement ce que ferait le compte réel.
      const entrees = m.retenus.filter((t) => !investiPrec || !prec.has(t));
      const reconduites = m.retenus.filter((t) => investiPrec && prec.has(t));
      const totalReconduites = reconduites.reduce((x, t) => x + (finsPrec.get(t) ?? 0), 0);
      const miseEntrante = entrees.length ? (avant - totalReconduites) / entrees.length : 0;
      if (!entrees.length) cashDormant = avant - totalReconduites;
      for (const t of m.retenus) {
        const s = carte.get(t)!;
        const entree = !investiPrec || !prec.has(t);
        const a = achatDe(s, m.reb, entree), v = apres(s, m.next)!;
        const div = dividendesEntre(divs, s, a.date, v.date).somme;
        const ret = (v.prix + div) / a.prix - 1;
        const miseLigne = PONDERATION === "derivante"
          ? (entree ? miseEntrante : finsPrec.get(t) ?? 0)
          : mise;
        const frais = entree ? cout(a.prix) * miseLigne : 0;
        lot.push({ mois: m.next.slice(0, 7), reb: m.reb, next: m.next, ticker: t, secteur: secteurDe(t), achatDate: a.date,
          achatPrix: a.prix, venteDate: v.date, ventePrix: v.prix, div, ret, mise: miseLigne, frais,
          fin: miseLigne * (1 + ret) - frais, resultat: miseLigne * ret - frais, entree, k });
      }
    }
    const apresSolde = avant + lot.reduce((x, l) => x + l.resultat, 0);
    finsPrec = new Map(lot.map((l) => [l.ticker, l.fin]));
    // La réconciliation contre m.net (équipondéré du moteur) n'a de sens qu'en mode égal.
    if (PONDERATION === "egale")
      ecartMax = Math.max(ecartMax, Math.abs(apresSolde - avant * (1 + m.net)) / Math.max(1, avant));
    void cashDormant; // porté par apresSolde (les lots ne le consomment pas)
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

  const mDernier = [...tous].reverse().find((m) => m.retenus.length > 0) ?? null;
  return { capital: CAPITAL, soldeFinal: solde, ecartMax, differe: DIFFERE, barres, positions, lignes,
    moteurDernier: mDernier ? { reb: mDernier.reb, retenus: [...mDernier.retenus].sort() } : null,
    depuis: barres[0].mois, jusqua: barres[barres.length - 1].mois };
}
