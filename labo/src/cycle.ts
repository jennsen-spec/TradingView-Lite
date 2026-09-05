// Le cycle mensuel, en console.
//
//   npm run cycle                          dernier signal disponible
//   npm run cycle -- --signal 2026-08-31   un signal précis
//   npm run cycle -- --provisoire           « et si le mois finissait ce soir ? » (#96)
//   npm run cycle -- --sortie chemin.json
//
// Le calcul vit dans cycleCalc.ts — la console et le rapport HTML s'en servent
// tous les deux et doivent dire exactement la même chose.

import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { calculerCycle } from "./cycleCalc.ts";

const { values } = parseArgs({ options: {
  signal: { type: "string" }, sortie: { type: "string" }, marge: { type: "string" }, frais: { type: "boolean" },
  provisoire: { type: "boolean" },
} });

const c = await calculerCycle({ signal: values.signal, marge: values.marge ? Number(values.marge) : undefined,
  frais: values.frais, provisoire: values.provisoire });
const eur = (v: number) => v.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1).replace(".", ",") + " %";

console.log(`\n╔═ CYCLE ${c.signal}${c.provisoire ? " (PROVISOIRE)" : ""} ${"═".repeat(60)}`);
console.log(`║ Signal lu à la clôture du ${c.signal} · ordre à l'ouverture de la séance suivante`);
console.log(`║ Poche duo ${eur(c.poche)} $ · ${c.regles.trier.selection.n} lignes · ${eur(c.ligne)} $ par ligne · ${c.nEligibles} titres éligibles`);
console.log(`╠═ INTERRUPTEUR`);
console.log(`║ ${c.marche.ticker} au ${c.marche.date} : ${c.marche.seance ? `ouverture ${c.marche.ouverture.toFixed(2)} $ / clôture ${c.marche.cours.toFixed(2)} $` : `${c.marche.cours.toFixed(2)} $`} contre MM${c.marche.ma.slice(3)} à ${c.marche.moyenne.toFixed(2)} $`
  + `  →  ${c.marche.investi ? "INVESTI" : "LIQUIDITÉS — aucun achat ce mois-ci"}`);

if (c.marche.investi) {
  const achats = c.ordres.filter((o) => o.action === "acheter").length;
  console.log(`╠═ ORDRES  (${achats} achat(s), ${c.ordres.length - achats} reconduit(s), ${c.sortants.length} vente(s))`);
  console.log(`║`);
  // Un seul tableau, trié par rang, comme le rapport : ventes, achats et
  // conservations mêlés, la colonne « action » fait le tri. Sur une ligne gardée la
  // quantité est celle DÉTENUE — si la console disait la ligne cible là où le rapport
  // dit les actions en main, l'un des deux mentirait.
  const lignes = [
    ...c.ordres.map((o) => ({
      ticker: o.ticker, secteur: o.secteur, action: o.action, rang: o.rang, momentum: o.momentum,
      cloture: o.cloture, quantite: o.action === "conserver" ? (o.detenu ?? o.quantite) : o.quantite,
      montant: o.montant, prix: o.action === "acheter" ? eur(o.limite) : "—",
      gain: o.gain, pctGain: o.pctGain,
    })),
    ...c.sortants.map((v) => ({
      ticker: v.ticker, secteur: v.secteur, action: "vendre", rang: v.rang, momentum: v.momentum,
      cloture: v.cloture, quantite: v.detenu, montant: v.produit, prix: "marché",
      gain: v.gain, pctGain: v.pctGain,
    })),
  ].sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9));

  console.log(`║ ${"titre".padEnd(10)}${"sect".padEnd(6)}${"rang".padStart(5)}${"momentum".padStart(10)}${"clôture".padStart(11)}${"qté".padStart(6)}${"montant".padStart(12)}${"prix".padStart(10)}${"action".padStart(12)}${"résultat".padStart(20)}`);
  console.log(`║ ${"─".repeat(102)}`);
  for (const o of lignes) {
    const res = o.gain === null ? "" : `${o.gain >= 0 ? "+" : "−"}${eur(Math.abs(o.gain))} $ ${pc(o.pctGain!)}`;
    console.log(`║ ${o.ticker.padEnd(10)}${(o.secteur === "Technology" ? "tech" : "indu").padEnd(6)}${String(o.rang ?? "—").padStart(5)}`
      + (o.momentum === null ? "—" : pc(o.momentum)).padStart(10)
      + (o.cloture === null ? "—" : eur(o.cloture)).padStart(11) + String(o.quantite ?? "—").padStart(6)
      + (o.montant === null ? "—" : eur(o.montant)).padStart(12) + o.prix.padStart(10)
      + o.action.padStart(12) + res.padStart(20));
  }
  console.log(`║ ${"─".repeat(102)}`);
  const res = (g: number | null, p: number | null) => g === null ? "—" : `${g >= 0 ? "+" : "−"}${eur(Math.abs(g))} $ ${p === null ? "" : pc(p)}`;
  if (c.sortants.length) console.log(`║ ventes         produit ${eur(c.produit).padStart(10)} $  ·  résultat réalisé ${res(c.gainRealise, c.pctRealise)}`);
  console.log(`║ achats         engagé  ${eur(c.engage).padStart(10)} $  ·  coût max ${eur(c.coutMax)} $`);
  if (c.conserve) console.log(`║ conservations  valeur  ${eur(c.conserve).padStart(10)} $  ·  résultat latent  ${res(c.gainLatent, c.pctLatent)}`);
  console.log(`║ liquidités résiduelles ${eur(c.residuel)} $ (${(c.residuel / c.poche * 100).toFixed(1)} %)`);

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
