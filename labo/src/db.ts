// Écriture des résultats dans le schéma `research` du projet opérationnel,
// via des RPC dédiés (labo_save_run, labo_cartouche, labo_compteurs).
// Les tables sont minuscules (quelques Ko par jeu de règles) — garde-fou côté SQL.

import { PROJETS, VERSION_MOTEUR } from "./config.ts";
import { postRpc } from "./rest.ts";
import type { JeuDeRegles } from "./regles.ts";
import type { Metriques } from "./metriques.ts";
import type { MoisResultat } from "./moteur.ts";

export interface Compteurs {
  jeux: number;
  variantes: number;
  cartouches_total: number;
  cartouches_jeu: number;
}

function arrondir(x: number | null): number | null {
  return x === null || Number.isNaN(x) ? null : Math.round(x * 1e8) / 1e8;
}

function metricsJson(m: Metriques): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(m).map(([k, v]) => [k, typeof v === "number" ? arrondir(v) : v]),
  );
}

export async function sauvegarderRun(
  regles: JeuDeRegles,
  univers: string,
  selection: Metriques,
  validation: Metriques,
  total: Metriques,
  mois: MoisResultat[],
): Promise<Compteurs> {
  const { url, cle } = PROJETS.operationnel;
  // La série mensuelle (net + bench, arrondie) part avec la période « total » pour #51.
  const serie = mois.map((m) => [m.reb, arrondir(m.net), arrondir(m.bench), m.investi ? 1 : 0]);
  const rep = await postRpc(url, cle, "labo_save_run", {
    p_nom: regles.nom,
    p_version: regles.version,
    p_spec: regles,
    p_univers: univers,
    p_moteur: VERSION_MOTEUR,
    p_selection: metricsJson(selection),
    p_validation: metricsJson(validation),
    p_total: { ...metricsJson(total), serie },
  });
  return rep as Compteurs;
}

export async function consommerCartouche(regles: JeuDeRegles, note: string): Promise<number> {
  const { url, cle } = PROJETS.operationnel;
  const rep = await postRpc(url, cle, "labo_cartouche", {
    p_nom: regles.nom,
    p_version: regles.version,
    p_note: note,
  });
  return rep as number;
}

export async function compteurs(nom: string): Promise<Compteurs> {
  const { url, cle } = PROJETS.operationnel;
  return (await postRpc(url, cle, "labo_compteurs", { p_nom: nom })) as Compteurs;
}
