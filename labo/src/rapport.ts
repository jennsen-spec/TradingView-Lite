// Sortie console. Par défaut : période de SÉLECTION uniquement — la validation
// 2016-2026 est masquée (la voir est un geste explicite, journalisé et décompté).

import type { Metriques } from "./metriques.ts";

export function pct(x: number | null, decimales = 2): string {
  if (x === null || Number.isNaN(x)) return "—";
  return (x * 100).toFixed(decimales).replace(".", ",") + " %";
}

export function pts(x: number | null, decimales = 2): string {
  if (x === null || Number.isNaN(x)) return "—";
  const v = (x * 100).toFixed(decimales).replace(".", ",");
  return (x >= 0 ? "+" : "") + v + " pt";
}

export function nombre(x: number, decimales = 2): string {
  return x.toFixed(decimales).replace(".", ",");
}

const LARGEUR = 78;

export function titre(texte: string): void {
  console.log("═".repeat(LARGEUR));
  console.log(" " + texte);
  console.log("═".repeat(LARGEUR));
}

export function sousTitre(texte: string): void {
  console.log("─".repeat(LARGEUR));
  console.log(" " + texte);
  console.log("─".repeat(LARGEUR));
}

export function blocMetriques(nomPeriode: string, m: Metriques): void {
  console.log(` ${nomPeriode}`);
  console.log(`   ▶ ÉCART CONTRE BENCHMARK APPARIÉ : ${pts(m.ecartNet)}/mois net de frais (t = ${nombre(m.tNet)})`);
  console.log(`     écart brut (comparable à l'analyse de référence) : ${pts(m.ecartBrut)}/mois (t = ${nombre(m.tBrut)})`);
  console.log(
    `   mois : ${m.nMois} · temps investi : ${pct(m.pctInvesti, 0)} · rendement net moyen : ${pct(m.retNetMoyen)}/mois`,
  );
  console.log(
    `   croissance annualisée (nette) : ${pct(m.cagrNet, 1)} · volatilité : ${pct(m.volAnnualisee, 1)} · pire baisse : ${pct(m.pireBaisse, 1)} · pire mois : ${pct(m.pireMois, 1)}`,
  );
  const refs: string[] = [`benchmark apparié : ${pct(m.benchMoyen)}/mois`];
  if (m.refXiu !== null) refs.push(`XIU.TO : ${pct(m.refXiu)}/mois`);
  if (m.refXwd !== null) refs.push(`XWD.TO : ${pct(m.refXwd)}/mois`);
  console.log(`   ${refs.join(" · ")}`);
  console.log(
    `   univers éligible : médiane ${nombre(m.eligiblesMediane, 0)} titres (min ${nombre(m.eligiblesMin, 0)}) · portefeuille : médiane ${nombre(m.seleMediane, 0)} titres` +
      (m.eligiblesMediane < 30 ? "  ⚠ univers maigre — résultat fragile" : ""),
  );
}
