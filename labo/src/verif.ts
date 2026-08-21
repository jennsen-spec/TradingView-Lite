// Vérifications d'honnêteté :
//  1) --verifier : recalcul de chaque indicateur en TS et comparaison aux valeurs
//     de ta_ca_daily (fixtures/indicateurs.json, extrait figé de la base recherche).
//  2) --comparer-cowork : comparaison mois par mois du protocole de référence
//     avec la table ta_ca_mom de l'analyse précédente (fixtures/cowork_mom.json).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPERTOIRE_FIXTURES } from "./config.ts";
import type { Univers } from "./data.ts";
import { colonne } from "./indicateurs.ts";
import type { MoisResultat } from "./moteur.ts";
import { nombre, pts } from "./rapport.ts";

interface FixtureIndicateur {
  ticker: string;
  bar_date: string;
  attendu: Record<string, number>;
}

export function verifierIndicateurs(research: Univers): boolean {
  const fixtures = JSON.parse(
    readFileSync(join(REPERTOIRE_FIXTURES, "indicateurs.json"), "utf8"),
  ) as FixtureIndicateur[];
  let echecs = 0;
  let tests = 0;
  console.log("Vérification des indicateurs TS contre ta_ca_daily (extrait figé) :");
  for (const f of fixtures) {
    const s = research.series.find((x) => x.ticker === f.ticker);
    if (!s) {
      console.log(`  ✗ ${f.ticker} absent de l'univers research`);
      echecs++;
      continue;
    }
    const i = s.idx.get(f.bar_date);
    if (i === undefined) {
      console.log(`  ✗ ${f.ticker} ${f.bar_date} : barre absente`);
      echecs++;
      continue;
    }
    for (const [nom, attendu] of Object.entries(f.attendu)) {
      tests++;
      const calcule = nom === "next_open" ? (i + 1 < s.dates.length ? s.open[i + 1] : NaN) : colonne(s, nom)[i];
      const tolerance = Math.max(1e-9, Math.abs(attendu) * 1e-9);
      const ok = Math.abs(calcule - attendu) <= tolerance;
      if (!ok) {
        echecs++;
        console.log(`  ✗ ${f.ticker} ${f.bar_date} ${nom} : calculé ${calcule} ≠ attendu ${attendu}`);
      } else {
        console.log(`  ✓ ${f.ticker} ${f.bar_date} ${nom.padEnd(12)} = ${calcule}`);
      }
    }
  }
  console.log(echecs === 0 ? `→ ${tests} valeurs vérifiées, aucune divergence.` : `→ ${echecs} DIVERGENCE(S) sur ${tests}.`);
  return echecs === 0;
}

// [reb, (next,)? retDecile1, nDecile1, retUnivers, nUnivers]
type LigneRef = [string, ...(string | number)[]];

function comparerFixture(
  mois: MoisResultat[],
  fichier: string,
  etiquette: string,
): { alignes: number; exacts: number; maxD1: number; maxBench: number; divergences: string[] } {
  const brut = JSON.parse(readFileSync(join(REPERTOIRE_FIXTURES, fichier), "utf8")) as LigneRef[];
  const parDate = new Map(mois.map((m) => [m.reb, m]));
  let alignes = 0;
  let exacts = 0;
  let maxD1 = 0;
  let maxBench = 0;
  const divergences: string[] = [];
  for (const ligne of brut) {
    const reb = ligne[0];
    const nums = ligne.slice(1).filter((x) => typeof x === "number") as number[];
    const [retD1, nD1, retU] = nums;
    const m = parDate.get(reb);
    if (!m) {
      divergences.push(`  mois ${reb} : présent dans ${etiquette}, absent chez nous`);
      continue;
    }
    alignes++;
    const dD1 = Math.abs(m.brut - retD1);
    const dB = Math.abs(m.bench - retU);
    maxD1 = Math.max(maxD1, dD1);
    maxBench = Math.max(maxBench, dB);
    if (dD1 < 1e-6 && dB < 1e-6) exacts++;
    else divergences.push(
      `  ${reb} : décile1 ${nombre(m.brut * 100, 3)}/${nombre(retD1 * 100, 3)} (n ${m.nSel}/${nD1}) · univers ${nombre(m.bench * 100, 3)}/${nombre(retU * 100, 3)}`,
    );
  }
  return { alignes, exacts, maxD1, maxBench, divergences };
}

export function comparerCowork(mois: MoisResultat[]): boolean {
  // 1) Critère dur : le moteur TS doit reproduire EXACTEMENT le protocole recalculé
  //    en SQL sur l'état ACTUEL de ta_ca_daily (fixtures/protocole_sql_actuel.json,
  //    photo du 2026-08-21).
  const sql = comparerFixture(mois, "protocole_sql_actuel.json", "SQL actuel");
  console.log(`Réplication exacte (protocole recalculé en SQL sur les données du 2026-08-21) :`);
  console.log(`  mois alignés : ${sql.alignes} · identiques (<1e-6) : ${sql.exacts} · écart max décile 1 : ${pts(sql.maxD1, 4)} · benchmark : ${pts(sql.maxBench, 4)}`);
  for (const d of sql.divergences.slice(0, 10)) console.log(d);
  const ok = sql.exacts === sql.alignes && sql.divergences.length === 0;

  // 2) Information : la table ta_ca_mom de l'analyse d'origine est une PHOTO plus
  //    ancienne des mêmes barres. Yahoo réajuste tout l'historique à chaque dividende,
  //    donc les chiffres bougent un peu — c'est la donnée qui a changé, pas la méthode.
  const cow = comparerFixture(mois, "cowork_mom.json", "ta_ca_mom");
  console.log(`Contre la photo d'origine (ta_ca_mom, figée avant les derniers réajustements de dividendes) :`);
  console.log(`  mois alignés : ${cow.alignes} · identiques : ${cow.exacts} · écart max décile 1 : ${pts(cow.maxD1, 4)} · benchmark : ${pts(cow.maxBench, 4)}`);
  console.log(ok ? `→ RÉPLICATION EXACTE sur les données actuelles.` : `→ ÉCHEC de réplication : le moteur ne reproduit pas le protocole SQL.`);
  return ok;
}
