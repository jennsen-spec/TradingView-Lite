// Le calcul d'un cycle mensuel — ce que les règles disent de faire, en dollars
// et en actions. Sans affichage : la console (cycle.ts) et le rapport (page.ts)
// s'en servent tous les deux, et doivent dire exactement la même chose.
//
// Le signal se lit à la CLÔTURE du dernier jour ouvrable du mois ; l'ordre passe
// à l'OUVERTURE du premier jour du mois suivant — qui n'existe pas encore au
// moment du calcul. Les quantités sont donc établies sur la DERNIÈRE CLÔTURE
// CONNUE. L'écart d'une nuit est réel, le backtest le porte déjà, et il ne faut
// pas le maquiller en certitude.

import { readFileSync } from "node:fs";
import { chargerMarket, chargerReferences, chargerDividendes, type Serie } from "./data.ts";
import { actionsCanadiennes, assainir } from "./qualite.ts";
import { definirReferenceRS, colonne } from "./indicateurs.ts";
import { chargerSecteurs, definirSecteurs, secteurDe } from "./secteurs.ts";
import { chargerEtfSectoriels, definirPortes } from "./etfSectoriels.ts";
import { chargerJeu, comparer, type JeuDeRegles } from "./regles.ts";

export const RACINE = new URL("../../", import.meta.url).pathname;
export const lireEtat = () => JSON.parse(readFileSync(RACINE + "portefeuille/etat.json", "utf8"));

export interface Candidat {
  ticker: string; secteur: "Industrials" | "Technology"; rang: number;
  momentum: number; cloture: number; dv50: number; retenu: boolean;
}
export interface Ordre extends Candidat {
  quantite: number; engage: number; limite: number; plafondOrdre: number;
  action: "acheter" | "conserver"; partVolume: number;
}
export interface Cycle {
  signal: string; genere: string;
  // Séance d'exécution : la PREMIÈRE séance postérieure au signal, prise dans les
  // données. `null` quand elle n'existe pas encore — c'est le cas normal d'un
  // signal du soir même. Ne jamais la deviner : le 3 août 2026 est un lundi
  // ouvrable au calendrier mais le TSX est fermé (congé civique), et le backtest
  // exécute le 4. Annoncer une date fausse est pire que n'en annoncer aucune.
  execution: string | null;
  marche: { ticker: string; ma: string; date: string; cours: number; moyenne: number; ratio: number; investi: boolean };
  poche: number; ligne: number; marge: number; nEligibles: number;
  ordres: Ordre[]; sortants: string[]; detenus: string[];
  candidats: { secteur: string; titres: Candidat[] }[];
  engage: number; residuel: number;
  alertes: { inachetables: Ordre[]; lourds: Ordre[] };
  regles: JeuDeRegles; etat: Record<string, unknown>;
}

export async function calculerCycle(opts: { signal?: string; marge?: number; frais?: boolean } = {}): Promise<Cycle> {
  const etat = lireEtat();
  // +5 % : Jean a confirmé le 24/08 qu'un ordre limité déposé la veille participe
  // à l'encan d'ouverture du TSX (jusqu'à 60 jours de validité). L'encan servant à
  // son propre prix, une limite large ne coûte rien — alors qu'une limite serrée
  // coûte cher : mesuré, à +0,5 % un ordre sur quatre ne passe pas et le capital
  // final est divisé par deux. +5 % couvre 99,3 % des cas.
  const marge = opts.marge ?? 0.05;
  // `frais` = ignorer le cache local. Le cache ne se périme jamais tout seul :
  // sans ça, un rapport du 31 peut être calculé sur les données du 23 sans que
  // rien ne le signale. L'Action tourne toujours sur un runner neuf, donc à froid.
  const frais = opts.frais ?? false;

  const refs = await chargerReferences(frais); definirReferenceRS(refs.get("XIU.TO")!);
  await chargerDividendes(frais);
  const u = assainir(actionsCanadiennes(await chargerMarket(frais)).univers).univers;
  definirSecteurs(await chargerSecteurs(u.series.map((s) => s.ticker)));
  definirPortes(await chargerEtfSectoriels());

  const DUO = new Set(["Industrials", "Technology"]);
  // CDR : certificats canadiens adossés à une action américaine. Mesurés le 23/08 —
  // les garder fait ×50,5 contre ×40,7, à pire baisse identique. Ils restent.
  const CDR = new Set<string>(etat.regles.exclure_cdr ? etat.regles.cdr : []);
  const duo = u.series.filter((s) => DUO.has(secteurDe(s.ticker)) && !CDR.has(s.ticker));
  const regles = chargerJeu(etat.regles.jeu);

  // Fins de mois COMPLÈTES. Un mois est complet si des données existent dans un
  // mois postérieur, OU si la date du jour a atteint son dernier jour civil.
  //
  // La seconde condition est indispensable à l'usage réel : le soir du 31 août,
  // aucune barre de septembre n'existe encore, et pourtant le signal du 31 est
  // bien celui sur lequel Jean passera ses ordres le lendemain matin. Attendre
  // une barre de septembre le lui livrerait un jour trop tard.
  // Elle gère aussi le cas d'un dernier jour civil non ouvré : la fin de mois
  // retenue reste la dernière SÉANCE du mois, pas le dernier jour du calendrier.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const dernierJourCivil = (mois: string) => {
    const [y, mo] = mois.split("-").map(Number);
    return new Date(Date.UTC(y, mo, 0)).toISOString().slice(0, 10);
  };
  const fins = (() => {
    const p = new Map<string, string>();
    for (const s of duo) for (const d of s.dates) { const m = d.slice(0, 7); const c = p.get(m); if (!c || d > c) p.set(m, d); }
    const paires = [...p.entries()].sort();
    const dernierMois = paires[paires.length - 1][0];
    // Garde-fou : la règle du calendrier n'est appliquée que si les données du
    // mois vont jusqu'à sa fin (à 4 jours près, pour absorber week-ends et fériés).
    // Sans ça, une Action lancée le 31 avant l'ingestion de la barre du jour
    // prendrait le 28 pour la fin de mois et publierait un signal périmé.
    const aJour = (mois: string, derniere: string) => {
      const fin = new Date(dernierJourCivil(mois) + "T00:00:00Z").getTime();
      return (fin - new Date(derniere + "T00:00:00Z").getTime()) / 86400000 <= 4;
    };
    return paires
      .filter(([mois, d]) => mois < dernierMois || (aujourdhui >= dernierJourCivil(mois) && aJour(mois, d)))
      .map(([, d]) => d);
  })();
  const signal = opts.signal ?? fins[fins.length - 1];
  if (!fins.includes(signal)) throw new Error(`« ${signal} » n'est pas une fin de mois complète (dernières : ${fins.slice(-3).join(", ")})`);

  // Première séance strictement postérieure au signal, sur l'union des dates de
  // l'univers. Absente = elle n'a pas encore eu lieu.
  const execution = (() => {
    let d: string | null = null;
    for (const s of duo) for (let i = s.dates.length - 1; i >= 0 && s.dates[i] > signal; i--)
      if (d === null || s.dates[i] < d) d = s.dates[i];
    return d;
  })();

  // INTERRUPTEUR — lu sur la dernière barre de la référence ≤ signal.
  const m = /^([a-z]+)_sur_(sma\d+)$/.exec(regles.interrupteur!.indicateur)!;
  const ref = refs.get(m[1].toUpperCase() + ".TO")!;
  let ir = ref.dates.length - 1; while (ir >= 0 && ref.dates[ir] > signal) ir--;
  const ratio = ref.close[ir] / colonne(ref, m[2])[ir];
  const marche = { ticker: ref.ticker, ma: m[2], date: ref.dates[ir], cours: ref.close[ir],
    moyenne: colonne(ref, m[2])[ir], ratio, investi: comparer(ratio, regles.interrupteur!.op, regles.interrupteur!.valeur) };

  // FILTRER puis TRIER — identique au moteur.
  const elig: (Candidat & { s: Serie })[] = [];
  for (const s of duo) {
    const i = s.idx.get(signal); if (i === undefined) continue;
    const mom = colonne(s, regles.trier.indicateur)[i]; if (Number.isNaN(mom)) continue;
    let ok = true;
    for (const c of regles.filtrer) if (!comparer(colonne(s, c.indicateur)[i], c.op, c.valeur)) { ok = false; break; }
    if (ok) elig.push({ s, ticker: s.ticker, secteur: secteurDe(s.ticker) as "Industrials" | "Technology",
      rang: 0, momentum: mom, cloture: s.close[i], dv50: colonne(s, "dv50")[i], retenu: false });
  }
  elig.sort((a, b) => (a.momentum === b.momentum ? (a.ticker < b.ticker ? -1 : 1) : b.momentum - a.momentum));
  elig.forEach((e, k) => { e.rang = k + 1; });

  // PLAFOND — on descend le classement en sautant les paniers pleins ; la place
  // libérée revient au titre suivant, la taille du portefeuille est préservée.
  const compte = new Map<string, number>();
  const retenus: typeof elig = [];
  for (const e of elig) {
    if (retenus.length >= (regles.trier.selection as { n: number }).n) break;
    const n = compte.get(e.secteur) ?? 0;
    if (n >= regles.plafond!.n) continue;
    compte.set(e.secteur, n + 1); retenus.push(e); e.retenu = true;
  }

  const parSecteur = new Map<string, Candidat[]>();
  for (const e of elig) {
    const a = parSecteur.get(e.secteur) ?? [];
    if (a.length < etat.regles.candidats_affiches_par_secteur) { a.push(e); parSecteur.set(e.secteur, a); }
  }

  const precedent: string[] = etat.cycles.length ? (etat.cycles[etat.cycles.length - 1].detenus ?? []) : [];
  const detenus = new Set(precedent);
  const estRetenu = new Set(retenus.map((e) => e.ticker));
  const poche = (etat.poche_duo.montant_initial ?? 0) + (etat.poche_duo.liquidites ?? 0);
  const ligne = marche.investi ? poche / (regles.trier.selection as { n: number }).n : 0;

  const ordres: Ordre[] = retenus.map((e) => {
    const quantite = Math.floor(ligne / e.cloture);
    const limite = Math.ceil(e.cloture * (1 + marge) * 100) / 100;
    return { ticker: e.ticker, secteur: e.secteur, rang: e.rang, momentum: e.momentum,
      cloture: e.cloture, dv50: e.dv50, retenu: true, quantite, engage: quantite * e.cloture,
      limite, plafondOrdre: quantite * limite,
      action: detenus.has(e.ticker) ? "conserver" : "acheter",
      partVolume: (quantite * e.cloture) / e.dv50 };
  });
  const engage = ordres.reduce((a, o) => a + o.engage, 0);

  return { signal, genere: new Date().toISOString(), execution, marche, poche, ligne, marge,
    nEligibles: elig.length, ordres, sortants: precedent.filter((t) => !estRetenu.has(t)),
    detenus: retenus.map((e) => e.ticker),
    candidats: [...parSecteur].map(([secteur, titres]) => ({ secteur,
      titres: titres.map(({ ...c }) => ({ ticker: c.ticker, secteur: c.secteur, rang: c.rang,
        momentum: c.momentum, cloture: c.cloture, dv50: c.dv50, retenu: c.retenu })) })),
    engage, residuel: poche - engage,
    alertes: { inachetables: ordres.filter((o) => o.quantite === 0), lourds: ordres.filter((o) => o.partVolume > 0.05) },
    regles, etat };
}
