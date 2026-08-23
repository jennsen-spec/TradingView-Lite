// Comparaison de plusieurs jeux de règles sur une MÊME base de mois, avec courbes.
//
//   npm run labo:comparer                       (univers market assaini, dividendes inclus)
//   npm run labo:comparer -- --sortie chemin.json
//
// Toutes les stratégies sont mesurées sur l'intersection exacte des mois mesurables :
// une courbe qui commence plus tard fausserait la comparaison.

import { parseArgs } from "node:util";
import { writeFileSync } from "node:fs";
import { chargerDividendes, chargerMarket, chargerReferences } from "./data.ts";
import { actionsCanadiennes, assainir } from "./qualite.ts";
import { definirReferenceRS } from "./indicateurs.ts";
import { chargerSecteurs, definirSecteurs } from "./secteurs.ts";
import { chargerEtfSectoriels, definirPortes } from "./etfSectoriels.ts";
import { chargerJeu } from "./regles.ts";
import { lancer, type MoisResultat } from "./moteur.ts";
import { courbe, episodes, rendementsReference, rendementsStrategie, type Point } from "./courbes.ts";
import { colonne } from "./indicateurs.ts";
import { nombre, pct, sousTitre, titre } from "./rapport.ts";

const { values } = parseArgs({
  allowPositionals: true,
  options: { sortie: { type: "string" }, jeux: { type: "string" }, depuis: { type: "string" }, decalage: { type: "string" } },
});

const JEUX = (values.jeux ?? "c-momentum,c-rs-sma150,c-rs-sma150-stop").split(",");
const REFERENCE = "XIU.TO";

interface Resultat {
  nom: string;
  libelle: string;
  rendements: { date: string; ret: number }[];
  mois?: MoisResultat[];
}

function ecartType(v: number[]): number {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / (v.length - 1));
}

function stats(pts: Point[], rets: number[]) {
  const eq = pts[pts.length - 1].equite;
  const ans = pts.length / 12;
  const eps = episodes(pts, -0.05);
  return {
    equiteFinale: eq,
    cagr: eq ** (1 / ans) - 1,
    vol: ecartType(rets) * Math.sqrt(12),
    pireBaisse: Math.min(...pts.map((p) => p.sousLeau)),
    pireMois: Math.min(...rets),
    meilleurMois: Math.max(...rets),
    partMoisPositifs: rets.filter((r) => r > 0).length / rets.length,
    partTempsSousLeau: pts.filter((p) => p.sousLeau < -0.05).length / pts.length,
    nEpisodes20: eps.filter((e) => e.profondeur <= -0.2).length,
    plusLongueSousLeau: eps.length > 0 ? Math.max(...eps.map((e) => e.moisSousLeau)) : 0,
    episodes: eps,
  };
}

function parAnnee(rendements: { date: string; ret: number }[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const r of rendements) {
    const a = r.date.slice(0, 4);
    m.set(a, (m.get(a) ?? 1) * (1 + r.ret));
  }
  for (const [a, v] of m) m.set(a, v - 1);
  return m;
}

async function principal(): Promise<number> {
  titre("LABO · comparaison de stratégies — courbes de capital et de sous-l'eau");

  const refs = await chargerReferences();
  const xiu = refs.get(REFERENCE);
  if (!xiu) throw new Error(`référence ${REFERENCE} introuvable`);
  definirReferenceRS(xiu); // la force relative se mesure contre XIU

  const divs = await chargerDividendes();
  const brut = await chargerMarket();
  const perimetre = actionsCanadiennes(brut);
  console.log(
    ` Périmètre : ${brut.series.length} séries → ${perimetre.univers.series.length} actions canadiennes` +
      ` (${perimetre.horsBourse.length} cotations étrangères et ${perimetre.etf.length} ETF écartés)`,
  );
  if (perimetre.horsBourse.length > 0) console.log(`   étrangers : ${perimetre.horsBourse.join(" ")}`);
  const { univers, ecartes, ruptures } = assainir(perimetre.univers);
  console.log(
    ` Qualité des prix : ${perimetre.univers.series.length} → ${univers.series.length} séries` +
      ` (${ecartes.length} titres écartés pour ${ruptures.length} ruptures d'échelle)`,
  );
  console.log(` Dividendes : ${divs.size} tickers couverts — rendements TOTAUX (plus-value + dividendes détachés).`);
  console.log(` Référence de force relative et d'achat-conservation : ${REFERENCE}.`);

  definirSecteurs(await chargerSecteurs(univers.series.map((s) => s.ticker)));
  definirPortes(await chargerEtfSectoriels());

  const resultats: Resultat[] = [];
  let fenetres: { reb: string; next: string }[] = [];

  for (const nom of JEUX) {
    const regles = chargerJeu(nom);
    const { mois } = lancer(univers, regles, refs, undefined, divs, Number(values.decalage ?? 0));
    if (mois.length === 0) {
      console.log(` ⚠ ${nom} : aucun mois mesurable.`);
      continue;
    }
    const retenusMois = values.depuis ? mois.filter((m) => m.reb >= values.depuis!) : mois;
    if (retenusMois.length === 0) { console.log(` ⚠ ${nom} : aucun mois après ${values.depuis}.`); continue; }
    if (fenetres.length === 0) fenetres = retenusMois.map((m) => ({ reb: m.reb, next: m.next }));
    resultats.push({ nom, libelle: regles.description?.split("—")[1]?.trim() ?? nom, rendements: rendementsStrategie(retenusMois), mois: retenusMois });
  }

  resultats.push({
    nom: "achat-conservation",
    libelle: `Achat-conservation ${REFERENCE} (TSX 60, dividendes inclus)`,
    rendements: rendementsReference(xiu, fenetres, divs),
  });
  // XSP.TO suit le S&P 500 couvert depuis 2002 : contrairement à HXS (2011), il couvre
  // toute la fenêtre de mesure — donc 2008. C'est la seule façon honnête de comparer
  // l'indice américain sur la même période que les stratégies.
  const xsp = refs.get("XSP.TO");
  if (xsp) {
    resultats.push({
      nom: "achat-conservation-xsp",
      libelle: "Achat-conservation XSP.TO (S&P 500 couvert, dividendes inclus)",
      rendements: rendementsReference(xsp, fenetres, divs),
    });
  }

  // XSP piloté par SON PROPRE interrupteur : on détient l'indice quand il clôture au-dessus
  // de sa MM150 à la date de signal, liquidités sinon. C'est le témoin qui manque — il dit si
  // l'interrupteur vaut par lui-même, ou seulement combiné au tri momentum.
  if (xsp) {
    const sma = colonne(xsp, "sma150");
    const auDessus = (reb: string): boolean => {
      let i = xsp.dates.length - 1;
      while (i >= 0 && xsp.dates[i] > reb) i--;
      return i >= 0 && xsp.close[i] > sma[i];
    };
    const brut = rendementsReference(xsp, fenetres, divs);
    const parDate = new Map(fenetres.map((f) => [f.next, f.reb]));
    resultats.push({
      nom: "xsp-timing",
      libelle: "XSP.TO avec interrupteur (cash si XSP < MM150)",
      rendements: brut.map((r) => ({ date: r.date, ret: auDessus(parDate.get(r.date)!) ? r.ret : 0 })),
    });
  }

  // Intersection exacte des mois — aucune courbe ne démarre plus tôt qu'une autre.
  let communs: Set<string> | null = null;
  for (const r of resultats) {
    const d = new Set(r.rendements.map((x) => x.date));
    communs = communs === null ? d : new Set([...communs].filter((x) => d.has(x)));
  }
  const garder = communs!;
  for (const r of resultats) r.rendements = r.rendements.filter((x) => garder.has(x.date));

  const n = resultats[0].rendements.length;
  sousTitre(`${n} mois communs · ${resultats[0].rendements[0].date} → ${resultats[0].rendements[n - 1].date}`);

  const sortie: Record<string, unknown> = { genere: new Date().toISOString(), nMois: n, strategies: [] };

  for (const r of resultats) {
    const pts = courbe(r.rendements);
    const rets = r.rendements.map((x) => x.ret);
    const st = stats(pts, rets);
    console.log();
    console.log(` ▶ ${r.nom}`);
    console.log(`   ${r.libelle}`);
    console.log(
      `   capital final ×${nombre(st.equiteFinale, 1)} · croissance annualisée ${pct(st.cagr, 1)} · volatilité ${pct(st.vol, 1)}`,
    );
    console.log(
      `   PIRE BAISSE ${pct(st.pireBaisse, 1)} · épisodes sous −20 % : ${st.nEpisodes20} · plus longue traversée : ${st.plusLongueSousLeau} mois`,
    );
    console.log(
      `   temps passé à plus de 5 % sous le sommet : ${pct(st.partTempsSousLeau, 0)} · mois positifs : ${pct(st.partMoisPositifs, 0)}` +
        ` · pire mois ${pct(st.pireMois, 1)} · meilleur ${pct(st.meilleurMois, 1)}`,
    );
    if (r.mois) {
      const stoppes = r.mois.reduce((a, m) => a + m.stoppes, 0);
      const lignes = r.mois.reduce((a, m) => a + m.nSel, 0);
      if (stoppes > 0) console.log(`   stops déclenchés : ${stoppes} sur ${lignes} lignes détenues (${pct(stoppes / lignes, 1)})`);
      const dernier = r.mois[r.mois.length - 1];
      console.log(`   portefeuille au ${dernier.reb} : ${dernier.retenus.join(" ")}`);
    }
    (sortie.strategies as unknown[]).push({
      nom: r.nom,
      libelle: r.libelle,
      points: pts.map((p) => ({ d: p.date, e: Number(p.equite.toFixed(6)), u: Number(p.sousLeau.toFixed(6)) })),
      stats: { ...st, episodes: st.episodes.slice(0, 20) },
      parAnnee: [...parAnnee(r.rendements).entries()],
      dernierPortefeuille: r.mois ? r.mois[r.mois.length - 1].retenus : [],
    });
  }

  // ── Références à historique court : comparées sur LEUR fenêtre, jamais sur 22 ans.
  // XWD.TO ne commence qu'en octobre 2009 et HXS en 2011 : leur « pire baisse » n'inclut
  // pas 2008. Les comparer sur toute la période ferait passer une fenêtre clémente pour
  // une qualité du produit.
  const partielles = ["XWD.TO", "HXS.TO", "ZEQT.TO"];
  const blocsPartiels: unknown[] = [];
  for (const t of partielles) {
    const s2 = refs.get(t);
    if (!s2) continue;
    const debut = s2.dates[0];
    const fen = fenetres.filter((f) => f.reb >= debut && garder.has(f.next));
    if (fen.length < 24) continue;
    sousTitre(`Référence ${t} — sa propre fenêtre : ${fen.length} mois depuis ${fen[0].next}`);
    const bloc: Record<string, unknown> = { ticker: t, nMois: fen.length, depuis: fen[0].next, lignes: [] };
    // Courbe propre de la référence, base 1 à SA première mesure — elle démarre en cours
    // de graphique, ce qui est le fait à montrer, pas à masquer.
    const dates = new Set(fen.map((f) => f.next));
    const rendsRef = rendementsReference(s2, fen, divs);
    const candidats: { nom: string; rends: { date: string; ret: number }[] }[] = [
      { nom: t, rends: rendsRef },
      ...resultats.map((r) => ({ nom: r.nom, rends: r.rendements.filter((x) => dates.has(x.date)) })),
    ];
    for (const c of candidats) {
      if (c.rends.length === 0) continue;
      const p2 = courbe(c.rends);
      const st2 = stats(p2, c.rends.map((x) => x.ret));
      console.log(
        `   ${c.nom.padEnd(20)} ×${nombre(st2.equiteFinale, 1).padStart(6)} · ${pct(st2.cagr, 1).padStart(8)}/an · pire baisse ${pct(st2.pireBaisse, 1).padStart(8)} · vol ${pct(st2.vol, 1)}`,
      );
      (bloc.lignes as unknown[]).push({ nom: c.nom, equiteFinale: st2.equiteFinale, cagr: st2.cagr, pireBaisse: st2.pireBaisse, vol: st2.vol });
      if (c.nom === t) bloc.points = p2.map((q) => ({ d: q.date, e: Number(q.equite.toFixed(6)) }));
    }
    blocsPartiels.push(bloc);
  }
  sortie.referencesPartielles = blocsPartiels;

  if (values.sortie) {
    writeFileSync(values.sortie, JSON.stringify(sortie, null, 1));
    console.log(`\n Courbes écrites dans ${values.sortie}`);
  }
  return 0;
}

principal().then((c) => process.exit(c), (e) => { console.error(e); process.exit(1); });
