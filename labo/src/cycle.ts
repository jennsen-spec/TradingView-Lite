// Le cycle mensuel, en console.
//
//   npm run cycle                          dernier signal disponible
//   npm run cycle -- --signal 2026-08-31   un signal précis
//   npm run cycle -- --sortie chemin.json
//
// Le calcul vit dans cycleCalc.ts — la console et le rapport HTML s'en servent
// tous les deux et doivent dire exactement la même chose.

import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { calculerCycle } from "./cycleCalc.ts";

const { values } = parseArgs({ options: {
  signal: { type: "string" }, sortie: { type: "string" }, marge: { type: "string" }, frais: { type: "boolean" },
} });

const c = await calculerCycle({ signal: values.signal, marge: values.marge ? Number(values.marge) : undefined, frais: values.frais });
const eur = (v: number) => v.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1).replace(".", ",") + " %";

console.log(`\n╔═ CYCLE ${c.signal} ${"═".repeat(60)}`);
console.log(`║ Signal lu à la clôture du ${c.signal} · ordre à l'ouverture de la séance suivante`);
console.log(`║ Poche duo ${eur(c.poche)} $ · ${c.regles.trier.selection.n} lignes · ${eur(c.ligne)} $ par ligne · ${c.nEligibles} titres éligibles`);
console.log(`╠═ INTERRUPTEUR`);
console.log(`║ ${c.marche.ticker} au ${c.marche.date} : ${c.marche.seance ? `ouverture ${c.marche.ouverture.toFixed(2)} $ / clôture ${c.marche.cours.toFixed(2)} $` : `${c.marche.cours.toFixed(2)} $`} contre MM${c.marche.ma.slice(3)} à ${c.marche.moyenne.toFixed(2)} $`
  + `  →  ${c.marche.investi ? "INVESTI" : "LIQUIDITÉS — aucun achat ce mois-ci"}`);

if (c.marche.investi) {
  const achats = c.ordres.filter((o) => o.action === "acheter").length;
  console.log(`╠═ ORDRES  (${achats} achat(s), ${c.ordres.length - achats} reconduit(s), ${c.sortants.length} vente(s))`);
  console.log(`║`);
  console.log(`║ ${"titre".padEnd(10)}${"sect".padEnd(6)}${"rang".padStart(5)}${"momentum".padStart(10)}${"clôture".padStart(11)}${"qté".padStart(6)}${"engagé".padStart(12)}${"limite".padStart(10)}${"action".padStart(12)}`);
  console.log(`║ ${"─".repeat(80)}`);
  for (const o of c.ordres) {
    console.log(`║ ${o.ticker.padEnd(10)}${(o.secteur === "Technology" ? "tech" : "indu").padEnd(6)}${String(o.rang).padStart(5)}`
      + pc(o.momentum).padStart(10) + eur(o.cloture).padStart(11) + String(o.quantite).padStart(6)
      + eur(o.engage).padStart(12) + eur(o.limite).padStart(10) + o.action.padStart(12));
  }
  console.log(`║ ${"─".repeat(80)}`);
  console.log(`║ ${"engagé".padEnd(10)}${eur(c.engage).padStart(49)} $  ·  liquidités résiduelles ${eur(c.residuel)} $ (${(c.residuel / c.poche * 100).toFixed(1)} %)`);
  if (c.sortants.length) console.log(`║ À VENDRE : ${c.sortants.join(" ")}`);

  console.log(`╠═ CANDIDATS EN RÉSERVE  (vus, non retenus)`);
  for (const g of c.candidats) {
    const r = g.titres.filter((t) => !t.retenu);
    console.log(`║ ${g.secteur} : ${r.map((t) => `${t.ticker} (${pc(t.momentum)})`).join(" · ") || "—"}`);
  }
  if (c.alertes.inachetables.length)
    console.log(`╠═ ⚠ INACHETABLES à ${eur(c.ligne)} $ la ligne : ${c.alertes.inachetables.map((o) => `${o.ticker} ${eur(o.cloture)} $`).join(" · ")}`);
  if (c.alertes.lourds.length)
    console.log(`╠═ ⚠ ORDRE LOURD (> 5 % du volume quotidien) : ${c.alertes.lourds.map((o) => `${o.ticker} ${(o.partVolume * 100).toFixed(0)} %`).join(" · ")}`);
}
console.log(`╚${"═".repeat(70)}\n`);

if (values.sortie) {
  writeFileSync(values.sortie, JSON.stringify(c, null, 1));
  console.log(` Cycle écrit dans ${values.sortie}\n`);
}
