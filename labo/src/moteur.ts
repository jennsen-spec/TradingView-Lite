// Le moteur : boucle de rebalancement mensuel, trois emplacements, zéro look-ahead.
//
// Conventions (identiques au protocole de référence, vérifiées contre ta_ca_mom) :
//  - date de rebalancement t = dernière séance du mois (sur l'union des dates de l'univers) ;
//  - le signal est lu sur la CLÔTURE de t ; l'exécution se fait à l'OUVERTURE de la
//    séance suivante DU TITRE (lead(open,1)) — achat après t, vente après t' (mois suivant) ;
//  - un titre sans barre à t' ou sans ouverture suivante est retiré du calcul du mois
//    (même convention que le protocole de référence — voir la critique dans le ticket) ;
//  - frais : 0,35 % aller-retour comptés à l'ENTRÉE d'un titre dans le portefeuille
//    (rotation réelle : un titre conservé d'un mois sur l'autre ne paie rien).

import type { Serie, Univers } from "./data.ts";
import { colonne } from "./indicateurs.ts";
import { comparer, type JeuDeRegles, type Selection } from "./regles.ts";

export interface MoisResultat {
  reb: string; // date du signal (clôture)
  next: string; // fin de mois suivante (la vente s'exécute à l'ouverture qui la suit)
  nElig: number;
  nSel: number; // titres sélectionnés ET valorisables (achat + vente disponibles)
  retenus: string[];
  brut: number; // rendement moyen équipondéré, avant frais (0 si mois en cash)
  bench: number; // benchmark apparié : moyenne de l'univers ÉLIGIBLE, même fenêtre
  entrees: number;
  frais: number; // en fraction du portefeuille
  net: number;
  investi: boolean;
}

export interface Trace {
  lignes: string[];
}

function taille(sel: Selection, n: number): number {
  switch (sel.type) {
    case "decile": {
      // ntile(10) de Postgres : les (n mod 10) premiers paquets reçoivent une unité de plus.
      const base = Math.floor(n / 10);
      return base + (sel.rang <= n % 10 ? 1 : 0);
    }
    case "topN":
      return Math.min(sel.n, n);
    case "fraction":
      return Math.max(1, Math.round(n * sel.part));
  }
}

function finsDeMois(univers: Univers): string[] {
  const parMois = new Map<string, string>();
  for (const s of univers.series) {
    for (const d of s.dates) {
      const mois = d.slice(0, 7);
      const courant = parMois.get(mois);
      if (!courant || d > courant) parMois.set(mois, d);
    }
  }
  return [...parMois.values()].sort();
}

// Ouverture de la séance suivant la date `d` pour ce titre (lead(open,1) sur SA série).
function achatSuivant(s: Serie, d: string): { date: string; prix: number } | null {
  const i = s.idx.get(d);
  if (i === undefined || i + 1 >= s.dates.length) return null;
  return { date: s.dates[i + 1], prix: s.open[i + 1] };
}

function indicateurMarche(
  nom: string,
  refs: Map<string, Serie>,
  eligibles: { s: Serie; i: number }[],
  reb: string,
): number {
  if (nom === "xiu_sur_sma200") {
    const xiu = refs.get("XIU.TO");
    if (!xiu) return NaN;
    // dernière barre du XIU ≤ date de rebalancement (aucune donnée future)
    let i = xiu.dates.length - 1;
    while (i >= 0 && xiu.dates[i] > reb) i--;
    if (i < 0) return NaN;
    return xiu.close[i] / colonne(xiu, "sma200")[i];
  }
  if (nom === "largeur_sma50") {
    if (eligibles.length === 0) return NaN;
    let dessus = 0;
    for (const { s, i } of eligibles) {
      if (s.close[i] > colonne(s, "sma50")[i]) dessus++;
    }
    return dessus / eligibles.length;
  }
  return NaN;
}

export function lancer(
  univers: Univers,
  regles: JeuDeRegles,
  refs: Map<string, Serie>,
  traceDate?: string,
): { mois: MoisResultat[]; trace?: Trace } {
  const fins = finsDeMois(univers);
  const mois: MoisResultat[] = [];
  let trace: Trace | undefined;
  let precedents = new Set<string>(); // titres détenus le mois précédent
  let investiPrecedent = false;

  for (let k = 0; k + 1 < fins.length; k++) {
    const reb = fins[k];
    const next = fins[k + 1];

    // 1) FILTRER — éligibilité titre par titre, à la clôture de reb.
    const eligibles: { s: Serie; i: number; cle: number }[] = [];
    for (const s of univers.series) {
      const i = s.idx.get(reb);
      if (i === undefined) continue;
      const cle = colonne(s, regles.trier.indicateur)[i];
      if (Number.isNaN(cle)) continue; // critère de tri indéfini → hors classement
      let ok = true;
      for (const c of regles.filtrer) {
        if (!comparer(colonne(s, c.indicateur)[i], c.op, c.valeur)) {
          ok = false;
          break;
        }
      }
      if (ok) eligibles.push({ s, i, cle });
    }
    if (eligibles.length === 0) continue;

    // 2) TRIER — classement transversal, sélection.
    const sens = regles.trier.ordre === "desc" ? -1 : 1;
    eligibles.sort((a, b) => (a.cle === b.cle ? (a.s.ticker < b.s.ticker ? -1 : 1) : sens * (a.cle - b.cle)));
    const nSel = taille(regles.trier.selection, eligibles.length);
    const debut = regles.trier.selection.type === "decile"
      ? tailleCumulee(regles.trier.selection.rang, eligibles.length)
      : 0;
    const selection = eligibles.slice(debut, debut + nSel);

    // 3) Valorisation : achat à l'ouverture suivant reb, vente à l'ouverture suivant next.
    const valorise = (e: { s: Serie; i: number }): { achat: { date: string; prix: number }; vente: { date: string; prix: number }; ret: number } | null => {
      const achat = achatSuivant(e.s, reb);
      if (!achat) return null;
      if (!e.s.idx.has(next)) return null; // pas de barre à la fin de mois suivante
      const vente = achatSuivant(e.s, next);
      if (!vente) return null;
      return { achat, vente, ret: vente.prix / achat.prix - 1 };
    };

    const retenus: { ticker: string; ret: number }[] = [];
    for (const e of selection) {
      const v = valorise(e);
      if (v) retenus.push({ ticker: e.s.ticker, ret: v.ret });
    }
    const retsBench: number[] = [];
    for (const e of eligibles) {
      const v = valorise(e);
      if (v) retsBench.push(v.ret);
    }
    if (retenus.length === 0 || retsBench.length === 0) continue;

    // 4) INTERRUPTEUR — le marché entier, oui/non pour ce mois.
    let investi = true;
    let valeurInterrupteur = NaN;
    if (regles.interrupteur) {
      valeurInterrupteur = indicateurMarche(regles.interrupteur.indicateur, refs, eligibles, reb);
      investi = comparer(valeurInterrupteur, regles.interrupteur.op, regles.interrupteur.valeur);
    }

    const brut = investi ? moyenne(retenus.map((r) => r.ret)) : 0;
    const bench = moyenne(retsBench);

    // 5) Frais sur la rotation réelle : chaque ENTRÉE paie l'aller-retour complet.
    const actuels = investi ? new Set(retenus.map((r) => r.ticker)) : new Set<string>();
    let entrees = 0;
    if (investi) {
      for (const t of actuels) if (!investiPrecedent || !precedents.has(t)) entrees++;
    }
    const frais = investi && retenus.length > 0 ? (regles.frais_aller_retour * entrees) / retenus.length : 0;
    const net = brut - frais;

    mois.push({
      reb,
      next,
      nElig: eligibles.length,
      nSel: retenus.length,
      retenus: investi ? retenus.map((r) => r.ticker) : [],
      brut,
      bench,
      entrees,
      frais,
      net,
      investi,
    });
    precedents = actuels;
    investiPrecedent = investi;

    if (traceDate === reb) {
      trace = construireTrace(reb, next, regles, eligibles, selection, retenus, valorise, bench, investi, valeurInterrupteur, entrees, frais);
    }
  }
  return { mois, trace };
}

// Position de départ du décile r dans un classement de n titres (ntile Postgres).
function tailleCumulee(rang: number, n: number): number {
  const base = Math.floor(n / 10);
  const reste = n % 10;
  let debut = 0;
  for (let r = 1; r < rang; r++) debut += base + (r <= reste ? 1 : 0);
  return debut;
}

function moyenne(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function construireTrace(
  reb: string,
  next: string,
  regles: JeuDeRegles,
  eligibles: { s: Serie; i: number; cle: number }[],
  selection: { s: Serie; i: number; cle: number }[],
  retenus: { ticker: string; ret: number }[],
  valorise: (e: { s: Serie; i: number }) => { achat: { date: string; prix: number }; vente: { date: string; prix: number }; ret: number } | null,
  bench: number,
  investi: boolean,
  valeurInterrupteur: number,
  entrees: number,
  frais: number,
): Trace {
  const l: string[] = [];
  l.push(`TRACE du rebalancement ${reb} (vente après ${next})`);
  l.push(`  1. FILTRER  → ${eligibles.length} titres éligibles (signal lu à la CLÔTURE du ${reb})`);
  l.push(`  2. TRIER    → « ${regles.trier.indicateur} » ${regles.trier.ordre}, sélection ${JSON.stringify(regles.trier.selection)} → ${selection.length} titres`);
  for (const e of selection) {
    const v = valorise(e);
    if (v) {
      l.push(
        `     ${e.s.ticker.padEnd(10)} signal=${e.cle.toFixed(4)}  ACHAT ouverture ${v.achat.date} à ${v.achat.prix.toFixed(4)}  VENTE ouverture ${v.vente.date} à ${v.vente.prix.toFixed(4)}  → ${(v.ret * 100).toFixed(2)} %`,
      );
    } else {
      l.push(`     ${e.s.ticker.padEnd(10)} signal=${e.cle.toFixed(4)}  — invalorisable (barre manquante) → retiré du mois`);
    }
  }
  if (regles.interrupteur) {
    l.push(`  3. INTERRUPTEUR → ${regles.interrupteur.indicateur} = ${valeurInterrupteur.toFixed(4)} ${regles.interrupteur.op} ${regles.interrupteur.valeur} → ${investi ? "ON (investi)" : "OFF (cash)"}`);
  } else {
    l.push(`  3. INTERRUPTEUR → aucun (toujours investi)`);
  }
  l.push(`  4. Rendement brut du mois : ${(moyenne(retenus.map((r) => r.ret)) * 100).toFixed(2)} % · benchmark apparié (${"moyenne de l'univers éligible"}) : ${(bench * 100).toFixed(2)} %`);
  l.push(`  5. Rotation : ${entrees} entrée(s) → frais ${(frais * 100).toFixed(3)} % du portefeuille`);
  l.push(`  Aucune donnée postérieure à ${reb} n'entre dans le signal ; l'exécution n'utilise que des ouvertures STRICTEMENT postérieures.`);
  return { lignes: l };
}
