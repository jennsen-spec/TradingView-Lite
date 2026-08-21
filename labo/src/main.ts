// Labo de mesure (#50) — CLI.
//
//   npm run labo -- <jeu-de-regles>            mesure (affiche la SÉLECTION 2004-2015 seulement)
//   npm run labo -- <jeu> --valider            révèle la validation 2016-2026 + l'univers market
//                                              (consomme une cartouche, journalisée)
//   npm run labo -- <jeu> --trace 2005-01-31   trace pas à pas un rebalancement (anti look-ahead)
//   npm run labo -- <jeu> --comparer-cowork    compare mois par mois avec l'analyse précédente
//   npm run labo -- --verifier                 recalcule les indicateurs vs ta_ca_daily
//   Options : --univers research|market · --sans-db · --sans-cache
//
// Pourquoi la validation est masquée : en testant 12 variantes sur tout l'historique,
// une gagnante apparaît par hasard. On compose les règles sur 2004-2015 ; 2016-2026 ne
// sert qu'à confirmer — chaque regard est compté. L'univers market (pan-canadien) est
// masqué avec elle : ses données couvrent presque exclusivement l'ère de validation.

import { parseArgs } from "node:util";
import { FIN_SELECTION } from "./config.ts";
import { chargerMarket, chargerReferences, chargerResearch, type Univers } from "./data.ts";
import { chargerJeu } from "./regles.ts";
import { lancer, type MoisResultat } from "./moteur.ts";
import { calculer } from "./metriques.ts";
import { blocMetriques, nombre, pts, sousTitre, titre } from "./rapport.ts";
import { comparerCowork, verifierIndicateurs } from "./verif.ts";
import { compteurs, consommerCartouche, sauvegarderRun, type Compteurs } from "./db.ts";

const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    valider: { type: "boolean", default: false },
    trace: { type: "string" },
    univers: { type: "string" },
    verifier: { type: "boolean", default: false },
    "comparer-cowork": { type: "boolean", default: false },
    "sans-db": { type: "boolean", default: false },
    "sans-cache": { type: "boolean", default: false },
  },
});

function decouper(mois: MoisResultat[]): { selection: MoisResultat[]; validation: MoisResultat[] } {
  return {
    selection: mois.filter((m) => m.reb <= FIN_SELECTION),
    validation: mois.filter((m) => m.reb > FIN_SELECTION),
  };
}

async function principal(): Promise<number> {
  const sansCache = values["sans-cache"];

  if (values.verifier) {
    const research = await chargerResearch(sansCache);
    return verifierIndicateurs(research) ? 0 : 1;
  }

  const nomJeu = positionals[0];
  if (!nomJeu) {
    console.error("Usage : npm run labo -- <jeu-de-regles> [--valider] [--trace AAAA-MM-JJ] [--comparer-cowork]");
    console.error("        npm run labo -- --verifier");
    return 2;
  }
  const regles = chargerJeu(nomJeu);
  const refs = await chargerReferences(sansCache);

  // La cartouche se consomme AVANT de révéler quoi que ce soit : pas de journal, pas de validation.
  let cartoucheNum: number | null = null;
  if (values.valider) {
    if (values["sans-db"]) {
      console.error("--valider exige la journalisation (incompatible avec --sans-db).");
      return 2;
    }
    cartoucheNum = await consommerCartouche(regles, `univers: ${values.univers ?? "research+market"}`);
    console.log(` ⚠ CARTOUCHE DE VALIDATION CONSOMMÉE — n° ${cartoucheNum} pour « ${regles.nom} » (geste journalisé).`);
  }

  const universDemandes: ("research" | "market")[] =
    values.univers === "research" ? ["research"] : values.univers === "market" ? ["market"] : ["research", "market"];

  titre(`LABO · jeu de règles « ${regles.nom} » v${regles.version}`);
  if (regles.description) console.log(` ${regles.description}`);
  console.log(
    ` TRIER : ${regles.trier.indicateur} (${regles.trier.ordre}) → ${JSON.stringify(regles.trier.selection)}` +
      ` · FILTRER : ${regles.filtrer.map((c) => `${c.indicateur} ${c.op} ${c.valeur}`).join(" ET ") || "aucun"}` +
      ` · INTERRUPTEUR : ${regles.interrupteur ? `${regles.interrupteur.indicateur} ${regles.interrupteur.op} ${regles.interrupteur.valeur}` : "aucun"}`,
  );
  console.log(` Frais : ${nombre(regles.frais_aller_retour * 100)} % aller-retour sur la rotation réelle · détention ${regles.detention_mois} mois`);

  let compteursFinaux: Compteurs | null = null;
  let codeSortie = 0;
  const ecartsParUnivers = new Map<string, { ecart: number; t: number; periode: string }>();

  for (const nomUnivers of universDemandes) {
    const univers: Univers = nomUnivers === "research" ? await chargerResearch(sansCache) : await chargerMarket(sansCache);
    const { mois, trace } = lancer(univers, regles, refs, values.trace);
    if (mois.length === 0) {
      console.log(` Univers ${nomUnivers} : aucun mois mesurable.`);
      continue;
    }
    const { selection, validation } = decouper(mois);
    const mSel = calculer(selection, refs);
    const mVal = calculer(validation, refs);
    const mTot = calculer(mois, refs);

    sousTitre(
      `Univers ${nomUnivers.toUpperCase()} — ${univers.series.length} titres · ${mois[0].reb} → ${mois[mois.length - 1].next}` +
        (nomUnivers === "research" ? " · prix ajustés dividendes+splits" : " · close Yahoo (splits oui, DIVIDENDES NON — voir ticket)"),
    );

    const masquerTout = nomUnivers === "market" && !values.valider;
    if (masquerTout && selection.length === 0) {
      console.log(" [MASQUÉ] Cet univers ne couvre pratiquement que 2016-2026 (période de validation).");
      console.log(" Le mesurer est fait et enregistré ; l'AFFICHER exige --valider (cartouche).");
    } else {
      if (selection.length > 0) blocMetriques(`SÉLECTION 2004-2015 (${selection.length} mois)`, mSel);
      else console.log(" (aucun mois dans la période de sélection 2004-2015)");
      if (values.valider) {
        if (validation.length > 0) blocMetriques(`VALIDATION 2016-2026 (${validation.length} mois) — CARTOUCHE CONSOMMÉE`, mVal);
        blocMetriques(`TOTAL (${mois.length} mois)`, mTot);
      } else {
        console.log(` [MASQUÉ] validation 2016-2026 (${validation.length} mois) — « --valider » pour la voir : le geste est journalisé et décompté.`);
      }
    }

    const mComp = values.valider ? mTot : mSel;
    const periodeComp = values.valider ? "total" : "sélection 2004-2015";
    if ((values.valider ? mois : selection).length > 0)
      ecartsParUnivers.set(nomUnivers, { ecart: mComp.ecartNet, t: mComp.tNet, periode: periodeComp });

    if (values["comparer-cowork"] && nomUnivers === "research") {
      console.log();
      const ok = comparerCowork(mois);
      if (!ok) codeSortie = 1;
    }

    if (trace) {
      console.log();
      for (const l of trace.lignes) console.log(l);
    }

    if (!values["sans-db"]) {
      try {
        compteursFinaux = await sauvegarderRun(regles, nomUnivers, mSel, mVal, mTot, mois);
      } catch (e) {
        console.error(` ⚠ écriture dans research impossible : ${(e as Error).message}`);
      }
    }
  }

  // Les deux univers ne se moyennent jamais : un désaccord s'affiche comme tel.
  const r = ecartsParUnivers.get("research");
  const m = ecartsParUnivers.get("market");
  if (r && m) {
    sousTitre("Accord entre les univers (jamais moyennés)");
    console.log(` research : écart net ${pts(r.ecart)}/mois (t = ${nombre(r.t)}) · market : ${pts(m.ecart)}/mois (t = ${nombre(m.t)}) — période : ${r.periode}`);
    if (r.ecart > 0 === m.ecart > 0) {
      console.log(` → ACCORD sur le signe de l'écart. Les grandeurs restent à juger séparément.`);
    } else {
      console.log(` → DÉSACCORD : les deux univers ne racontent pas la même histoire. Ne pas moyenner — comprendre.`);
    }
  }

  sousTitre("Compteurs (garde-fous)");
  try {
    const c = compteursFinaux && !values.valider ? compteursFinaux : await compteurs(regles.nom);
    console.log(
      ` Jeux de règles testés au total : ${c.jeux} (${c.variantes} variantes) — en tester 12, c'est fabriquer un gagnant par hasard.`,
    );
    const nCart = cartoucheNum ?? c.cartouches_jeu;
    console.log(` Cartouches de validation consommées pour « ${regles.nom} » : ${nCart} · toutes règles confondues : ${c.cartouches_total}`);
  } catch (e) {
    console.log(` (compteurs indisponibles : ${(e as Error).message})`);
  }
  return codeSortie;
}

principal().then(
  (code) => process.exit(code),
  (e) => {
    console.error(e);
    process.exit(1);
  },
);
