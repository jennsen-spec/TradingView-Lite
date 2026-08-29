// Inventaire mensuel de l'univers (#60) — l'univers doit grandir avec la bourse.
//
// Source : le fichier officiel Cboe Canada (symbol_listings.csv), qui couvre TOUT le
// marché canadien consolidé — TSX (XTSE), TSXV (XTSX), Cboe/NEO (NEOE), CSE (XCNQ) —
// avec devise, classe d'actif et volume quotidien moyen. Le pré-filtre de liquidité
// est donc gratuit, avant tout appel à Yahoo.
//
// Ce que la commande produit :
//   - MANQUANTS DU DUO : titres CAD des secteurs Industrials/Technology, cotés
//     (TSX/TSXV/Cboe), assez liquides, absents de la base → à ajouter.
//   - À CLASSIFIER : candidats liquides dont le secteur est inconnu ; Yahoo est
//     interrogé par lots limités (--max-yahoo, défaut 40) et le cache retient tout —
//     l'inventaire converge en quelques passages mensuels sans marteler Yahoo.
//   - MATURATION : titres duo de la base avec moins de 253 barres (les CDR ajoutés
//     le 27/08 surtout) — barres accumulées et date estimée d'éligibilité.
//   - RADIÉS : tickers de la base absents du fichier Cboe (jamais supprimés, signalés).
//
// Écrit labo/.cache/inventaire.json ; le rapport (page.ts) l'affiche si récent.
//
// Procédure d'ajout d'un manquant (celle du 27/08, à dérouler telle quelle) :
//   1. SQL : select public.backfill_ticker('X.TO', 6);
//   2. SQL : insert into bars_coverage (ticker, interval, max_range, currency, name, fetched_at)
//            values ('X.TO','1d','6y','CAD','NOM', now());
//   3. Ajouter le ticker à labo/data/secteurs-seed.json (secteur + industrie), committer.
//   4. Si le titre paie des dividendes : les charger dans la table `dividends`.
//
// Usage : npm run inventaire [-- --max-yahoo N] [--seuil-dv N]

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { PROJETS, REPERTOIRE_CACHE, TICKERS_REFERENCE } from "./config.ts";
import { getJson, enParallele } from "./rest.ts";
import { chargerSecteurs, type Secteur } from "./secteurs.ts";

const { values } = parseArgs({ options: {
  "max-yahoo": { type: "string" }, "seuil-dv": { type: "string" },
} });
const MAX_YAHOO = Number(values["max-yahoo"] ?? 40);
// Le filtre de la stratégie est dv50 ≥ 500 k$ ; l'inventaire regarde plus bas pour
// voir venir — un titre à 250 k$ aujourd'hui peut être éligible dans six mois.
const SEUIL_DV = Number(values["seuil-dv"] ?? 250_000);
const DUO = new Set(["Industrials", "Technology"]);
const CSV = "https://cdn.cboe.com/ca/equities/mnow/symbol_listings.csv";
const SUFFIXE: Record<string, string> = { XTSE: ".TO", XTSX: ".V", NEOE: ".NE" };

// ── 1. Le fichier Cboe ───────────────────────────────────────────────────────
const rep = await fetch(CSV, { headers: { "User-Agent": "Mozilla/5.0" } });
if (!rep.ok) throw new Error(`Cboe symbol_listings : HTTP ${rep.status}`);
const lignesCsv = (await rep.text()).split("\n").filter((l) => l.length > 0);
// 1re ligne = méta (environment=prod,…), 2e = en-têtes.
const tetes = lignesCsv[1].split(",");
const col = (nom: string) => tetes.indexOf(nom);
const iSym = col("symbol"), iNom = col("company_name"), iDev = col("currency"),
  iMic = col("mic"), iLive = col("live"), iTest = col("test"), iCls = col("asset_class"),
  iAdv = col("adv"), iPx = col("reference_price");
interface Cote { sym: string; nom: string; mic: string; yahoo: string; dv: number; cdr: boolean }
const cotes: Cote[] = [];
const tousSymboles = new Set<string>(); // toutes classes confondues — pour les radiés
for (const l of lignesCsv.slice(2)) {
  const c = l.split(",");
  if (c.length < tetes.length) continue;
  const suf = SUFFIXE[c[iMic]];
  if (suf) tousSymboles.add(c[iSym].replace(/\./g, "-") + suf);
  if (c[iDev] !== "CAD" || c[iLive] !== "t" || c[iTest] === "t" || !suf) continue;
  const cdr = c[iNom].toUpperCase().includes("CDR");
  if (c[iCls] !== "EQTY" && !cdr) continue; // les CDR sont classés ETF chez Cboe
  const dv = Math.round(Number(c[iAdv] || 0) * Number(c[iPx] || 0));
  cotes.push({ sym: c[iSym], nom: c[iNom], mic: c[iMic], yahoo: c[iSym].replace(/\./g, "-") + suf, dv, cdr });
}
process.stderr.write(`  inventaire : ${cotes.length} titres CAD en périmètre (EQTY + CDR), ${tousSymboles.size} symboles toutes classes\n`);

// ── 2. La base ───────────────────────────────────────────────────────────────
const { url, cle } = PROJETS.operationnel;
const couverture = (await getJson(`${url}/rest/v1/bars_coverage?select=ticker&interval=eq.1d`, cle)) as { ticker: string }[];
const enBase = new Set([...couverture.map((x) => x.ticker), ...TICKERS_REFERENCE]);

// ── 3. Classification : seed + cache d'abord, Yahoo par lot limité ───────────
const connus = new Map<string, Secteur>();
for (const chemin of [new URL("../data/secteurs-seed.json", import.meta.url).pathname, join(REPERTOIRE_CACHE, "secteurs.json")]) {
  if (!existsSync(chemin)) continue;
  for (const [t, s] of Object.entries(JSON.parse(readFileSync(chemin, "utf8")) as Record<string, Secteur>))
    connus.set(t, s);
}
const candidats = cotes.filter((c) => !enBase.has(c.yahoo) && c.dv >= SEUIL_DV);
const inconnus = candidats.filter((c) => !connus.has(c.yahoo));
const lot = inconnus.slice(0, MAX_YAHOO).map((c) => c.yahoo);
process.stderr.write(`  inventaire : ${candidats.length} candidats liquides absents de la base, ${inconnus.length} sans secteur (lot Yahoo : ${lot.length})\n`);
const classes = await chargerSecteurs([...candidats.filter((c) => connus.has(c.yahoo)).map((c) => c.yahoo), ...lot]);

const manquants = candidats
  .filter((c) => DUO.has(classes.get(c.yahoo)?.secteur ?? ""))
  .map((c) => ({ ticker: c.yahoo, nom: c.nom, secteur: classes.get(c.yahoo)!.secteur, dv: c.dv, cdr: c.cdr }))
  .sort((a, b) => b.dv - a.dv);

// ── 4. Maturation : titres duo de la base sous les 253 barres ────────────────
const duoEnBase = [...enBase].filter((t) => DUO.has(connus.get(t)?.secteur ?? ""));
const comptes = await enParallele(duoEnBase, 8, async (t) => {
  const r = await fetch(`${url}/rest/v1/bars?ticker=eq.${encodeURIComponent(t)}&interval=eq.1d&select=bar_date&order=bar_date.asc&limit=1`,
    { headers: { apikey: cle, Prefer: "count=exact", Range: "0-0" } });
  const total = Number((r.headers.get("content-range") ?? "/0").split("/")[1] || 0);
  const premiere = ((await r.json()) as { bar_date: string }[])[0]?.bar_date ?? null;
  return { ticker: t, barres: total, premiere };
});
const maturation = comptes.filter((x) => x.barres > 0 && x.barres < 253)
  .map((x) => {
    const restantes = 253 - x.barres;
    const d = new Date(); d.setDate(d.getDate() + Math.round((restantes * 7) / 5));
    return { ...x, restantes, estimee: d.toISOString().slice(0, 7) };
  }).sort((a, b) => a.restantes - b.restantes);

// ── 5. Radiés : dans la base, plus au fichier Cboe ───────────────────────────
const refs = new Set<string>(TICKERS_REFERENCE);
const radies = [...enBase].filter((t) => !refs.has(t) && !tousSymboles.has(t)).sort();

// ── 6. Sortie ────────────────────────────────────────────────────────────────
const etat = { date: new Date().toISOString().slice(0, 10),
  manquantsDuo: manquants, aClassifier: Math.max(0, inconnus.length - lot.length),
  maturation, radies };
writeFileSync(join(REPERTOIRE_CACHE, "inventaire.json"), JSON.stringify(etat, null, 1) + "\n");

console.log(`\n Inventaire du ${etat.date} — base : ${enBase.size} tickers · périmètre coté : ${cotes.length}`);
if (manquants.length) {
  console.log(`\n ⚠ ${manquants.length} titre(s) du duo cotés mais ABSENTS de la base :`);
  for (const m of manquants) console.log(`   ${m.ticker.padEnd(10)} ${(m.dv / 1e6).toFixed(1).padStart(6)} M$/j · ${m.secteur}${m.cdr ? " · CDR" : ""} · ${m.nom.slice(0, 40)}`);
  console.log(`   → procédure d'ajout : voir l'en-tête de labo/src/inventaire.ts`);
} else console.log(` Univers duo complet : aucun manquant.`);
if (etat.aClassifier) console.log(` ${etat.aClassifier} candidat(s) liquides encore sans secteur (relancer pour continuer, lot de ${MAX_YAHOO}).`);
if (maturation.length) {
  console.log(`\n ${maturation.length} titre(s) duo en maturation (< 253 barres) :`);
  for (const m of maturation) console.log(`   ${m.ticker.padEnd(10)} ${String(m.barres).padStart(4)} barres · éligible ~${m.estimee}`);
}
if (radies.length) console.log(`\n ${radies.length} ticker(s) de la base absents du fichier Cboe (radiés ?) : ${radies.join(", ")}`);
