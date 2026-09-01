// Exporteur DUO.MOM (#77) — courbe d'équité mensuelle base 100 du duo `c-duo-plaf5-p1`,
// écrite dans frontend/src/data/duo-mom.json pour l'instrument synthétique local.
//
// NB : le mécanisme de cartouche (journalisation Supabase `research.validation_log`) est
// HORS-LIGNE (schéma research supprimé) → l'export inclut la fenêtre de validation sans
// pouvoir la journaliser. Geste autorisé par Jean (option 1). Univers RESEARCH (prix
// ajustés dividendes+splits, couverture 2004-2026).

import { writeFileSync } from "node:fs";
import { chargerResearch, chargerReferences } from "./data.ts";
import { chargerJeu } from "./regles.ts";
import { lancer } from "./moteur.ts";
import { courbe, rendementsStrategie } from "./courbes.ts";

const JEU = "c-duo-plaf5-p1";
const SORTIE = "frontend/src/data/duo-mom.json";

const regles = chargerJeu(JEU);
const refs = await chargerReferences();
const univers = await chargerResearch();
const { mois } = lancer(univers, regles, refs);
if (mois.length === 0) {
  console.error("Aucun mois mesurable — abandon.");
  process.exit(1);
}

const pts = courbe(rendementsStrategie(mois)); // {date, equite (base 1), sousLeau}
const points = pts.map((p) => ({ time: p.date, close: Number((p.equite * 100).toFixed(4)) }));

writeFileSync(
  SORTIE,
  JSON.stringify(
    {
      _note: "Courbe d'équité base 100 du duo c-duo-plaf5-p1 (backtest labo, univers research, prix ajustés). LOCAL — non validé. Cartouche NON journalisée (DB hors-ligne).",
      strategie: JEU,
      univers: "research",
      base: 100,
      points,
    },
    null,
    2,
  ) + "\n",
);

console.log(`OK — ${points.length} points · ${points[0].time} → ${points[points.length - 1].time} · dernier=${points[points.length - 1].close}`);
