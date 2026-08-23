// Le cycle mensuel — ce que les règles disent de faire, en dollars et en actions.
//
//   npm run cycle                          dernier signal disponible
//   npm run cycle -- --signal 2026-08-31   un signal précis
//   npm run cycle -- --sortie chemin.json
//
// Le signal se lit à la CLÔTURE du dernier jour ouvrable du mois ; l'ordre passe à
// l'OUVERTURE du premier jour du mois suivant — qui n'existe pas encore au moment
// du calcul. Les quantités sont donc établies sur la DERNIÈRE CLÔTURE CONNUE, et le
// prix réellement obtenu sera celui de l'encan d'ouverture. C'est un écart d'une nuit,
// assumé par le backtest lui-même : il ne faut pas le maquiller en certitude.

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { chargerMarket, chargerReferences, chargerDividendes, type Serie } from "./data.ts";
import { actionsCanadiennes, assainir } from "./qualite.ts";
import { definirReferenceRS, colonne } from "./indicateurs.ts";
import { chargerSecteurs, definirSecteurs, secteurDe } from "./secteurs.ts";
import { chargerEtfSectoriels, definirPortes } from "./etfSectoriels.ts";
import { chargerJeu, comparer } from "./regles.ts";

const { values } = parseArgs({ options: {
  signal: { type: "string" }, sortie: { type: "string" }, marge: { type: "string" },
} });

const RACINE = new URL("../../", import.meta.url).pathname;
const ETAT = JSON.parse(readFileSync(RACINE + "portefeuille/etat.json", "utf8"));
// Marge du prix limite. Dans un encan d'ouverture, un ordre limité AU-DESSUS du cours
// d'ouverture calculé s'exécute AU cours d'ouverture, pas à la limite : la marge sert
// à entrer dans l'encan, elle ne coûte rien si elle est trop large.
const MARGE = Number(values.marge ?? 0.03);

const refs = await chargerReferences(); definirReferenceRS(refs.get("XIU.TO")!);
await chargerDividendes();
const u = assainir(actionsCanadiennes(await chargerMarket()).univers).univers;
definirSecteurs(await chargerSecteurs(u.series.map((s) => s.ticker))); definirPortes(await chargerEtfSectoriels());
const DUO = new Set(["Industrials", "Technology"]);
// CDR : certificats canadiens adossés à une action américaine. Le 70 % ETF de Jean
// (HXS = S&P 500, ZEQT majoritairement US, VMO momentum mondial) détient déjà ces
// sociétés — les reprendre dans le duo revient à les acheter deux fois.
const CDR = new Set<string>(ETAT.regles.exclure_cdr ? ETAT.regles.cdr : []);
const duo = u.series.filter((s) => DUO.has(secteurDe(s.ticker)) && !CDR.has(s.ticker));
const regles = chargerJeu(ETAT.regles.jeu);

// Dernière fin de mois COMPLÈTE : le mois en cours ne compte pas, sa dernière séance
// n'est pas une fin de mois.
const finsDeMois = (() => {
  const p = new Map<string, string>();
  for (const s of duo) for (const d of s.dates) { const m = d.slice(0, 7); const c = p.get(m); if (!c || d > c) p.set(m, d); }
  const tout = [...p.values()].sort();
  const dernierMois = tout[tout.length - 1].slice(0, 7);
  const auj = duo.reduce((a, s) => (s.dates[s.dates.length - 1] > a ? s.dates[s.dates.length - 1] : a), "");
  return auj.slice(0, 7) === dernierMois ? tout.slice(0, -1) : tout;
})();
const signal = values.signal ?? finsDeMois[finsDeMois.length - 1];
if (!finsDeMois.includes(signal)) {
  console.error(`« ${signal} » n'est pas une fin de mois complète. Dernières : ${finsDeMois.slice(-3).join(", ")}`);
  process.exit(1);
}

// INTERRUPTEUR — lu sur la dernière barre de la référence ≤ signal.
const marche = (() => {
  const m = /^([a-z]+)_sur_(sma\d+)$/.exec(regles.interrupteur!.indicateur)!;
  const ref = refs.get(m[1].toUpperCase() + ".TO")!;
  let i = ref.dates.length - 1; while (i >= 0 && ref.dates[i] > signal) i--;
  const val = ref.close[i] / colonne(ref, m[2])[i];
  return { ticker: ref.ticker, ma: m[2], date: ref.dates[i], cours: ref.close[i],
    moyenne: colonne(ref, m[2])[i], ratio: val,
    investi: comparer(val, regles.interrupteur!.op, regles.interrupteur!.valeur) };
})();

// FILTRER puis TRIER, exactement comme le moteur.
interface Cand { s: Serie; i: number; mom: number; secteur: string; prix: number; dv50: number; rang: number; }
const elig: Cand[] = [];
for (const s of duo) {
  const i = s.idx.get(signal); if (i === undefined) continue;
  const mom = colonne(s, regles.trier.indicateur)[i]; if (Number.isNaN(mom)) continue;
  let ok = true;
  for (const c of regles.filtrer) if (!comparer(colonne(s, c.indicateur)[i], c.op, c.valeur)) { ok = false; break; }
  if (ok) elig.push({ s, i, mom, secteur: secteurDe(s.ticker), prix: s.close[i], dv50: colonne(s, "dv50")[i], rang: 0 });
}
elig.sort((a, b) => (a.mom === b.mom ? (a.s.ticker < b.s.ticker ? -1 : 1) : b.mom - a.mom));
elig.forEach((e, k) => { e.rang = k + 1; });

// PLAFOND — on descend le classement en sautant les paniers pleins.
const compte = new Map<string, number>();
const retenus: Cand[] = [];
for (const e of elig) {
  if (retenus.length >= regles.trier.selection.n) break;
  const n = compte.get(e.secteur) ?? 0;
  if (n >= regles.plafond!.n) continue;
  compte.set(e.secteur, n + 1); retenus.push(e);
}
const estRetenu = new Set(retenus.map((e) => e.s.ticker));

// Les N premiers de chaque secteur — la vue « candidats » de la collection.
const parSecteur = new Map<string, Cand[]>();
for (const e of elig) {
  const a = parSecteur.get(e.secteur) ?? []; 
  if (a.length < ETAT.regles.candidats_affiches_par_secteur) { a.push(e); parSecteur.set(e.secteur, a); }
}

// ── Portefeuille précédent et ordres ────────────────────────────────────────────
const precedent: string[] = ETAT.cycles.length ? ETAT.cycles[ETAT.cycles.length - 1].detenus ?? [] : [];
const detenus = new Set(precedent);
const sortants = precedent.filter((t) => !estRetenu.has(t));
const reconduits = retenus.filter((e) => detenus.has(e.s.ticker));
const entrants = retenus.filter((e) => !detenus.has(e.s.ticker));

const poche = (ETAT.poche_duo.montant_initial ?? 0) + (ETAT.poche_duo.liquidites ?? 0);
const ligne = marche.investi ? poche / regles.trier.selection.n : 0;

const ordres = retenus.map((e) => {
  const q = Math.floor(ligne / e.prix);
  const limite = Math.ceil(e.prix * (1 + MARGE) * 100) / 100;
  return { ticker: e.s.ticker, secteur: e.secteur, rang: e.rang, momentum: e.mom,
    cloture: e.prix, quantite: q, engage: q * e.prix, limite, plafondOrdre: q * limite,
    action: detenus.has(e.s.ticker) ? "conserver" : "acheter", dv50: e.dv50,
    partVolume: (q * e.prix) / e.dv50 };
});

// ── Sortie ───────────────────────────────────────────────────────────────────────
const eur = (v: number) => v.toLocaleString("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pc = (v: number) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1).replace(".", ",") + " %";

console.log(`\n╔═ CYCLE ${signal} ${"═".repeat(60)}`);
console.log(`║ Signal lu à la clôture du ${signal} · ordre à l'ouverture de la séance suivante`);
console.log(`║ Poche duo ${eur(poche)} $ · ${regles.trier.selection.n} lignes · ${eur(ligne)} $ par ligne`);
console.log(`╠═ INTERRUPTEUR`);
console.log(`║ ${marche.ticker} au ${marche.date} : ${marche.cours.toFixed(2)} $ contre MM${marche.ma.slice(3)} à ${marche.moyenne.toFixed(2)} $`
  + `  →  ${marche.investi ? "INVESTI" : "LIQUIDITÉS — aucun achat ce mois-ci"}`);
if (!marche.investi) { console.log(`╚${"═".repeat(70)}`); process.exit(0); }

console.log(`╠═ ORDRES  (${entrants.length} achat(s), ${reconduits.length} reconduit(s), ${sortants.length} vente(s))`);
console.log(`║`);
console.log(`║ ${"titre".padEnd(10)}${"sect".padEnd(6)}${"rang".padStart(5)}${"momentum".padStart(10)}${"clôture".padStart(11)}${"qté".padStart(6)}${"engagé".padStart(12)}${"limite".padStart(10)}${"action".padStart(12)}`);
console.log(`║ ${"─".repeat(80)}`);
let total = 0;
for (const o of ordres) {
  total += o.engage;
  console.log(`║ ${o.ticker.padEnd(10)}${(o.secteur === "Technology" ? "tech" : "indu").padEnd(6)}${String(o.rang).padStart(5)}`
    + pc(o.momentum).padStart(10) + eur(o.cloture).padStart(11) + String(o.quantite).padStart(6)
    + eur(o.engage).padStart(12) + eur(o.limite).padStart(10) + o.action.padStart(12));
}
console.log(`║ ${"─".repeat(80)}`);
console.log(`║ ${"engagé".padEnd(10)}${eur(total).padStart(49)} $  ·  liquidités résiduelles ${eur(poche - total)} $ (${((poche - total) / poche * 100).toFixed(1)} %)`);
if (sortants.length) console.log(`║ À VENDRE : ${sortants.join(" ")}`);

console.log(`╠═ CANDIDATS EN RÉSERVE  (vus, non retenus)`);
for (const [sec, liste] of parSecteur) {
  const reserve = liste.filter((e) => !estRetenu.has(e.s.ticker));
  console.log(`║ ${sec} : ${reserve.map((e) => `${e.s.ticker} (${pc(e.mom)})`).join(" · ") || "—"}`);
}
const chers = ordres.filter((o) => o.quantite === 0);
if (chers.length) console.log(`╠═ ⚠ INACHETABLES à ${eur(ligne)} $ la ligne : ${chers.map((o) => `${o.ticker} ${eur(o.cloture)} $`).join(" · ")}`);
const gros = ordres.filter((o) => o.partVolume > 0.05);
if (gros.length) console.log(`╠═ ⚠ ORDRE LOURD (> 5 % du volume quotidien) : ${gros.map((o) => `${o.ticker} ${(o.partVolume*100).toFixed(0)} %`).join(" · ")}`);
console.log(`╚${"═".repeat(70)}\n`);

if (values.sortie) {
  writeFileSync(values.sortie, JSON.stringify({ signal, marche, poche, ligne, marge: MARGE,
    ordres, sortants, detenus: retenus.map((e) => e.s.ticker),
    candidats: [...parSecteur].map(([sec, l]) => ({ secteur: sec, titres: l.map((e) => ({
      ticker: e.s.ticker, rang: e.rang, momentum: e.mom, prix: e.prix, retenu: estRetenu.has(e.s.ticker) })) })),
    nEligibles: elig.length }, null, 1));
  console.log(` Cycle écrit dans ${values.sortie}\n`);
}
