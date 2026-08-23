// Jeu de règles nommé et versionné — les TROIS EMPLACEMENTS de #47 :
//   TRIER        : classement transversal de tous les titres → une sélection
//   FILTRER      : condition oui/non appliquée à chaque titre isolément
//   INTERRUPTEUR : condition sur le marché entier → on joue ce mois-ci ou pas
// Un même critère change de sens selon son emplacement — c'est mesuré, pas théorique.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPERTOIRE_RULESETS } from "./config.ts";
import { INDICATEURS_CONNUS } from "./indicateurs.ts";

export type Op = ">=" | ">" | "<=" | "<" | "==";

export interface Condition {
  indicateur: string;
  op: Op;
  valeur: number;
}

// STOP — quatrième emplacement, ajouté pour #52.
// Le niveau est FIXÉ au rebalancement (donc « recalculé chaque mois compte tenu des
// nouvelles valeurs d'indicateur ») mais VÉRIFIÉ sur chaque clôture de la détention :
// c'est le seul montage qui protège d'un décrochage en cours de mois.
// Niveau = prix d'achat × (1 − k × σ), où σ = écart-type des rendements journaliers
// sur 20 séances, ramené à l'échelle du mois (× √21). Un titre volatil obtient donc
// un stop large, un titre calme un stop serré — le stop s'adapte au titre.
// Sortie à l'OUVERTURE de la séance SUIVANT la clôture qui perce (aucun look-ahead) ;
// le produit reste en liquidités jusqu'à la fin du mois.
export interface Stop {
  type: "volatilite";
  k: number; // nombre d'écarts-types mensuels sous le prix d'achat
}

export type Selection =
  | { type: "decile"; rang: number } // ntile(10) — décile 1 = le haut du classement
  | { type: "topN"; n: number }
  | { type: "fraction"; part: number };

export interface JeuDeRegles {
  nom: string;
  version: number;
  description?: string;
  trier: { indicateur: string; ordre: "desc" | "asc"; selection: Selection };
  filtrer: Condition[];
  interrupteur: Condition | null; // indicateurs de marché : xiu_sur_sma200, largeur_sma50
  stop?: Stop | null;
  // CASH_SOUS — emplacement par LIGNE (ni filtre, ni interrupteur global) : dès que le
  // cours clôture sous cet indicateur, la ligne part en liquidités jusqu'à la
  // re-sélection suivante. Le portefeuille peut donc être partiellement investi.
  cash_sous?: string | null; // ex. "sma150"
  // PLAFOND DE CONCENTRATION — au plus `n` lignes par secteur (ou par industrie) dans
  // le portefeuille. On descend le classement et on saute les titres dont le panier est
  // plein : la place revient au suivant, le portefeuille garde sa taille.
  // Répond au constat « 16 titres d'or sur 29 » : ce n'est pas 29 paris, c'est un seul.
  plafond?: { n: number; niveau: "secteur" | "industrie" } | null;
  // PORTES PAR SECTEUR — un interrupteur par secteur au lieu d'un seul global.
  // Un secteur dont l'ETF clôture sous sa moyenne est FERMÉ. Deux modes :
  //   "reallouer" : ses titres sortent du classement, les autres secteurs comblent
  //                 (le portefeuille garde ses 20 lignes, mais se concentre) ;
  //   "cash"      : les lignes du secteur fermé passent en liquidités et ne sont pas
  //                 remplacées (le portefeuille est partiellement investi).
  // Les deux disent des choses opposées sur le risque — c'est le point à mesurer.
  portes_secteur?: { ma: string; mode: "reallouer" | "cash" } | null;
  detention_mois: number;
  // FRAIS — deux modèles, parce que la commission et la fourchette ne se comportent pas pareil.
  //  - `frais_aller_retour` : forfait en fraction, identique pour tous les titres. C'est le
  //    modèle historique ; il mélangeait commission du courtier et fourchette acheteur-vendeur.
  //  - `frais_fourchette` : la commission étant tombée à 0 $ chez les courtiers canadiens en
  //    ligne, il ne reste que la fourchette — et elle ne dépend PAS d'un pourcentage, elle
  //    dépend du pas de cotation rapporté au prix. Un cent d'écart sur un titre à 100 $ ne
  //    coûte rien ; le même cent sur un titre à 0,66 $ coûte 1,5 %. Coût d'un aller-retour =
  //    `ticks` × pas de cotation ÷ prix d'achat, + `commission` en fraction.
  //    C'est le seul modèle sous lequel un PLANCHER DE PRIX peut montrer ce qu'il vaut : sous
  //    un forfait, le moteur facture pareil un titre à 0,66 $ et un titre à 250 $, donc écarter
  //    les titres bon marché ne peut qu'apparaître comme une perte sèche.
  frais_fourchette?: { ticks: number; commission: number } | null;
  frais_aller_retour: number;
}

// Indicateurs de marché acceptés en INTERRUPTEUR :
//  - « <ticker>_sur_sma<N> » : la référence rapportée à sa moyenne N jours (> 1 = au-dessus).
//    Le ticker doit être chargé dans TICKERS_REFERENCE (xiu, xwd, hxs, zeqt, xsp).
//  - « largeur_sma50 » : part de l'univers éligible au-dessus de sa propre moyenne 50 jours.
const MOTIF_MARCHE = /^[a-z]+_(sur_sma\d+|sous_sma50_depuis|pente_sma50_75)$/;
export const INDICATEURS_MARCHE = ["<ticker>_sur_sma<N>", "largeur_sma50"];
export function estIndicateurMarche(nom: string): boolean {
  return nom === "largeur_sma50" || MOTIF_MARCHE.test(nom);
}

export function comparer(a: number, op: Op, b: number): boolean {
  if (Number.isNaN(a)) return false; // indéfini → condition non remplie
  switch (op) {
    case ">=": return a >= b;
    case ">": return a > b;
    case "<=": return a <= b;
    case "<": return a < b;
    case "==": return a === b;
  }
}

export function chargerJeu(nomOuChemin: string): JeuDeRegles {
  const chemin = nomOuChemin.endsWith(".json")
    ? nomOuChemin
    : join(REPERTOIRE_RULESETS, `${nomOuChemin}.json`);
  const brut = JSON.parse(readFileSync(chemin, "utf8")) as JeuDeRegles;
  valider(brut);
  return brut;
}

function valider(j: JeuDeRegles): void {
  const erreurs: string[] = [];
  if (!j.nom || !/^[a-z0-9-]+$/.test(j.nom)) erreurs.push("nom manquant ou invalide (kebab-case)");
  if (!Number.isInteger(j.version) || j.version < 1) erreurs.push("version doit être un entier ≥ 1");
  if (!j.trier || !INDICATEURS_CONNUS.includes(j.trier.indicateur))
    erreurs.push(`trier.indicateur inconnu : ${j.trier?.indicateur}`);
  if (j.trier && j.trier.ordre !== "desc" && j.trier.ordre !== "asc") erreurs.push("trier.ordre : desc|asc");
  for (const c of j.filtrer ?? []) {
    if (!INDICATEURS_CONNUS.includes(c.indicateur)) erreurs.push(`filtrer : indicateur inconnu ${c.indicateur}`);
  }
  if (j.interrupteur && !estIndicateurMarche(j.interrupteur.indicateur))
    erreurs.push(`interrupteur : indicateur de marché inconnu ${j.interrupteur.indicateur} (connus : ${INDICATEURS_MARCHE.join(", ")})`);
  if (j.stop) {
    if (j.stop.type !== "volatilite") erreurs.push(`stop.type inconnu : ${j.stop.type} (connu : volatilite)`);
    if (typeof j.stop.k !== "number" || j.stop.k <= 0 || j.stop.k > 10) erreurs.push("stop.k : nombre entre 0 et 10");
  }
  if (j.portes_secteur) {
    if (!INDICATEURS_CONNUS.includes(j.portes_secteur.ma)) erreurs.push(`portes_secteur.ma inconnu : ${j.portes_secteur.ma}`);
    if (j.portes_secteur.mode !== "reallouer" && j.portes_secteur.mode !== "cash")
      erreurs.push("portes_secteur.mode : reallouer|cash");
  }
  if (j.plafond) {
    if (!Number.isInteger(j.plafond.n) || j.plafond.n < 1) erreurs.push("plafond.n : entier ≥ 1");
    if (j.plafond.niveau !== "secteur" && j.plafond.niveau !== "industrie")
      erreurs.push("plafond.niveau : secteur|industrie");
  }
  if (j.cash_sous && !INDICATEURS_CONNUS.includes(j.cash_sous))
    erreurs.push(`cash_sous : indicateur inconnu ${j.cash_sous}`);
  if (!Number.isInteger(j.detention_mois) || j.detention_mois < 1 || j.detention_mois > 12)
    erreurs.push("detention_mois : entier entre 1 et 12");
  if (typeof j.frais_aller_retour !== "number" || j.frais_aller_retour < 0 || j.frais_aller_retour > 0.05)
    erreurs.push("frais_aller_retour : nombre entre 0 et 0.05");
  if (j.frais_fourchette) {
    if (typeof j.frais_fourchette.ticks !== "number" || j.frais_fourchette.ticks <= 0 || j.frais_fourchette.ticks > 50)
      erreurs.push("frais_fourchette.ticks : nombre entre 0 et 50");
    if (typeof j.frais_fourchette.commission !== "number" || j.frais_fourchette.commission < 0 || j.frais_fourchette.commission > 0.05)
      erreurs.push("frais_fourchette.commission : nombre entre 0 et 0.05");
  }
  if (erreurs.length > 0) throw new Error(`Jeu de règles invalide :\n  - ${erreurs.join("\n  - ")}`);
}
