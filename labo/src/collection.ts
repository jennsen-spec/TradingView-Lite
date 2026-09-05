// Libellés de la collection « Duo Sec Momentum » — le chaînon qui manquait.
// portefeuille/README.md et le protocole promettaient que le générateur met à jour
// les libellés de la collection à chaque fin de mois ; jusqu'au 27/08/2026 rien ne
// le faisait (les flags de juillet avaient été posés à la main).
//
// Code couleur (source : portefeuille/README.md) :
//   vert   #26a69a  Acheter — entre ce mois-ci
//   bleu   #3f8cff  Conserver — reconduit, aucun ordre
//   rouge  #ef5350  Vendre — sort ce mois-ci
//   orange #ff9800  En réserve — candidat non retenu, 5 premiers par secteur
//   violet #9c27b0  Dérogation de Jean — JAMAIS touché par ce script
//   aucun            Archive — plus candidat ; aucun symbole n'est jamais retiré
//
// PÉRIMÈTRE STRICT (leçon du 28/08 : le rollback UAT avait écrasé la section
// « INTERRUPTEUR » ajoutée par Jean) : ce script ne modifie QUE les sections
// « Industrials » et « Technology » de la collection. Toute autre section — et
// tout ce que Jean y range — est intouchable : symboles, flags et ordre.
//
// Interrupteur coupé : les détenus passent rouges (tout est vendu), aucun vert,
// bleu ni orange — rien n'est « en réserve » d'un achat qui n'aura pas lieu.
//
// Usage : npm run collection [-- --frais --sec]
//   --frais  ignorer le cache local (l'Action tourne toujours à froid)
//   --sec    montrer ce qui changerait sans écrire au cloud

import { parseArgs } from "node:util";
import { calculerCycle } from "./cycleCalc.ts";
import { PROJETS } from "./config.ts";

const { values } = parseArgs({ options: {
  frais: { type: "boolean" }, sec: { type: "boolean" },
} });

const NOM_COLLECTION = "Duo Sec Momentum";
const VERT = "#26a69a", BLEU = "#3f8cff", ROUGE = "#ef5350", ORANGE = "#ff9800", VIOLET = "#9c27b0";
const RESERVE_PAR_SECTEUR = 5;

interface Item { id: string; type: "section" | "symbol"; name?: string; sym?: string; flag?: string }
interface Collection { id: string; name: string; favorite: boolean; items: Item[] }

const { url, cle } = PROJETS.operationnel;
const PREFS = `${url}/functions/v1/tvlite-api/prefs`;
const entetes = { apikey: cle, "Content-Type": "application/json" };

const c = await calculerCycle({ frais: values.frais });

// Ce que chaque symbole du duo doit porter, avec un rang pour l'ordre d'affichage.
const attendu = new Map<string, { flag: string; rang: number; secteur: string }>();
for (const v of c.sortants) attendu.set(v.ticker, { flag: ROUGE, rang: -1, secteur: "" });
if (c.marche.investi) {
  for (const o of c.ordres)
    attendu.set(o.ticker, { flag: o.action === "acheter" ? VERT : BLEU, rang: o.rang, secteur: o.secteur });
  for (const g of c.candidats) {
    let n = 0;
    for (const t of g.titres) {
      if (t.retenu || attendu.has(t.ticker)) continue;
      if (n >= RESERVE_PAR_SECTEUR) break;
      attendu.set(t.ticker, { flag: ORANGE, rang: t.rang, secteur: g.secteur });
      n++;
    }
  }
}
// Le secteur des rouges, pour ranger un sortant ajouté à la collection.
for (const g of c.candidats) for (const t of g.titres)
  if (attendu.get(t.ticker)?.flag === ROUGE) attendu.get(t.ticker)!.secteur = g.secteur;

// ── Lecture du cloud ─────────────────────────────────────────────────────────
const rep = await fetch(`${PREFS}?meta=1&id=${encodeURIComponent("tvlike:collections")}`, { headers: entetes });
if (!rep.ok) throw new Error(`prefs GET : ${rep.status}`);
const lignes = (await rep.json()) as { id: string; value: string }[];
const brut = lignes.find((l) => l.id === "tvlike:collections")?.value;
if (!brut) throw new Error("tvlike:collections absent du cloud — l'app n'a jamais synchronisé ?");
const collections = JSON.parse(brut) as Collection[];
const coll = collections.find((x) => x.name === NOM_COLLECTION);
if (!coll) throw new Error(`Collection « ${NOM_COLLECTION} » introuvable (présentes : ${collections.map((x) => x.name).join(", ")})`);

// ── Mise à jour, section par section ─────────────────────────────────────────
let seq = 0;
const nouvelId = () => `wl-auto-${Date.now().toString(36)}-${(seq++).toString(36)}`;
const changements: string[] = [];
const violets: string[] = [];

// Découpe en sections (l'en-tête + ses symboles), pour réordonner à l'intérieur.
type Bloc = { tete: Item | null; symboles: Item[] };
const blocs: Bloc[] = [];
let courant: Bloc = { tete: null, symboles: [] };
for (const it of coll.items) {
  if (it.type === "section") { if (courant.tete || courant.symboles.length) blocs.push(courant); courant = { tete: it, symboles: [] }; }
  else courant.symboles.push(it);
}
blocs.push(courant);

const SECTIONS_GEREES = new Set(["Industrials", "Technology"]);
const gere = (b: Bloc) => b.tete !== null && SECTIONS_GEREES.has(b.tete.name ?? "");
const present = new Set(blocs.filter(gere).flatMap((b) => b.symboles.map((i) => i.sym!)));
for (const bloc of blocs) {
  if (!gere(bloc)) continue; // les sections de Jean (INTERRUPTEUR, …) : intouchables
  for (const it of bloc.symboles) {
    if (it.flag === VIOLET) { violets.push(it.sym!); continue; } // dérogation : intouchable
    const v = attendu.get(it.sym!);
    const flag = v?.flag;
    if ((it.flag ?? null) !== (flag ?? null)) {
      changements.push(`  ${it.sym}  ${it.flag ?? "—"} → ${flag ?? "— (archive)"}`);
      if (flag) it.flag = flag; else delete it.flag;
    }
  }
}
// Symboles prescrits absents de la collection : ajoutés dans la section de leur secteur.
for (const [sym, v] of attendu) {
  if (present.has(sym)) continue;
  let bloc = blocs.find((b) => b.tete?.name === v.secteur);
  if (!bloc) { bloc = { tete: { id: nouvelId(), type: "section", name: v.secteur || "Duo" }, symboles: [] }; blocs.push(bloc); }
  bloc.symboles.push({ id: nouvelId(), type: "symbol", sym, flag: v.flag });
  changements.push(`  ${sym}  (ajouté) → ${v.flag}`);
}
// Ordre dans chaque section : retenus par rang, dérogations, réserve par rang,
// vendus, puis l'archive dans son ordre existant.
const poids = (it: Item): [number, number] => {
  if (it.flag === VIOLET) return [1, 0];
  const v = attendu.get(it.sym!);
  if (it.flag === VERT || it.flag === BLEU) return [0, v?.rang ?? 99];
  if (it.flag === ORANGE) return [2, v?.rang ?? 99];
  if (it.flag === ROUGE) return [3, 0];
  return [4, 0];
};
for (const bloc of blocs) {
  if (!gere(bloc)) continue;
  const indices = new Map(bloc.symboles.map((it, i) => [it.id, i]));
  bloc.symboles.sort((a, b) => {
    const [ga, ra] = poids(a), [gb, rb] = poids(b);
    return ga !== gb ? ga - gb : ra !== rb ? ra - rb : indices.get(a.id)! - indices.get(b.id)!;
  });
}
coll.items = blocs.flatMap((b) => [...(b.tete ? [b.tete] : []), ...b.symboles]);

// ── Écriture ─────────────────────────────────────────────────────────────────
console.log(`\n Collection « ${NOM_COLLECTION} » — signal ${c.signal}, interrupteur ${c.marche.investi ? "ON (investi)" : "OFF (liquidités)"}`);
if (violets.length) console.log(` Dérogations préservées : ${violets.join(", ")}`);
console.log(changements.length ? ` ${changements.length} libellés modifiés :\n${changements.join("\n")}` : " Aucun changement.");
if (values.sec) {
  console.log("\n --sec : rien n'a été écrit.");
} else if (changements.length) {
  const post = await fetch(PREFS, { method: "POST", headers: entetes,
    body: JSON.stringify({ id: "tvlike:collections", value: JSON.stringify(collections) }) });
  if (!post.ok) throw new Error(`prefs POST : ${post.status}`);
  console.log(" Écrit au cloud. (Un TVLite déjà ouvert doit être rechargé pour le voir.)");
}
