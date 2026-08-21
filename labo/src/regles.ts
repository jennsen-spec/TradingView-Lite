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
  detention_mois: number;
  frais_aller_retour: number;
}

export const INDICATEURS_MARCHE = ["xiu_sur_sma200", "largeur_sma50"];

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
  if (j.interrupteur && !INDICATEURS_MARCHE.includes(j.interrupteur.indicateur))
    erreurs.push(`interrupteur : indicateur de marché inconnu ${j.interrupteur.indicateur} (connus : ${INDICATEURS_MARCHE.join(", ")})`);
  if (j.detention_mois !== 1)
    erreurs.push("detention_mois : seul 1 est supporté pour l'instant (autres durées → #52)");
  if (typeof j.frais_aller_retour !== "number" || j.frais_aller_retour < 0 || j.frais_aller_retour > 0.05)
    erreurs.push("frais_aller_retour : nombre entre 0 et 0.05");
  if (erreurs.length > 0) throw new Error(`Jeu de règles invalide :\n  - ${erreurs.join("\n  - ")}`);
}
