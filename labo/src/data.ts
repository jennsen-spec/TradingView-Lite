// Chargement des barres des deux univers + cache local NDJSON (labo/.cache/).

import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PROJETS, REPERTOIRE_CACHE, TICKERS_REFERENCE } from "./config.ts";
import { enParallele, getJson, paginerParDate } from "./rest.ts";

export interface Serie {
  ticker: string;
  dates: string[]; // ISO, croissant
  open: Float64Array;
  haut: Float64Array; // plus-haut de séance — nécessaire aux pivots (structure, S/R)
  bas: Float64Array;  // plus-bas de séance
  close: Float64Array;
  volume: Float64Array;
  idx: Map<string, number>;
  memo: Map<string, Float64Array>; // colonnes d'indicateurs mémoïsées
}

export interface Univers {
  nom: "research" | "market";
  series: Serie[];
}

interface LigneBrute {
  ticker: string;
  dates: string[];
  open: number[];
  haut?: number[];
  bas?: number[];
  close: number[];
  volume: number[];
}

function enSerie(l: LigneBrute): Serie {
  const idx = new Map<string, number>();
  l.dates.forEach((d, i) => idx.set(d, i));
  return {
    ticker: l.ticker,
    dates: l.dates,
    open: Float64Array.from(l.open),
    // Caches d'avant l'ajout des mèches : on retombe sur la clôture, faute de mieux.
    haut: Float64Array.from(l.haut ?? l.close),
    bas: Float64Array.from(l.bas ?? l.close),
    close: Float64Array.from(l.close),
    volume: Float64Array.from(l.volume),
    idx,
    memo: new Map(),
  };
}

function cheminCache(nom: string): string {
  return join(REPERTOIRE_CACHE, `${nom}.ndjson`);
}

function lireCache(nom: string): Serie[] | null {
  const chemin = cheminCache(nom);
  if (!existsSync(chemin)) return null;
  const lignes = readFileSync(chemin, "utf8").split("\n").filter((l) => l.length > 0);
  return lignes.map((l) => enSerie(JSON.parse(l) as LigneBrute));
}

function ecrireCache(nom: string, series: LigneBrute[]): void {
  mkdirSync(REPERTOIRE_CACHE, { recursive: true });
  writeFileSync(cheminCache(nom), series.map((s) => JSON.stringify(s)).join("\n") + "\n");
}

function versLigne(ticker: string, barres: Record<string, unknown>[]): LigneBrute {
  const l: LigneBrute = { ticker, dates: [], open: [], haut: [], bas: [], close: [], volume: [] };
  for (const b of barres) {
    const o = Number(b.open);
    const c = Number(b.close);
    if (!(o > 0) || !(c > 0)) continue; // barre invalide → ignorée (comptée nulle part)
    const h = Number(b.high);
    const bs = Number(b.low);
    l.dates.push(String(b.bar_date));
    l.open.push(o);
    l.haut!.push(h > 0 ? h : Math.max(o, c));
    l.bas!.push(bs > 0 ? bs : Math.min(o, c));
    l.close.push(c);
    l.volume.push(Number(b.volume) || 0);
  }
  return l;
}

// Univers RESEARCH : les 106 titres CA de Swing Mastery (prix ajustés dividendes+splits).
export async function chargerResearch(sansCache = false): Promise<Univers> {
  if (!sansCache) {
    const c = lireCache("research");
    if (c) return { nom: "research", series: c };
  }
  const { url, cle } = PROJETS.research;
  const instruments = (await getJson(
    `${url}/rest/v1/instruments?select=id,ticker&market=eq.CA&order=ticker.asc`,
    cle,
  )) as { id: number; ticker: string }[];
  process.stderr.write(`  research: ${instruments.length} instruments, téléchargement des barres…\n`);
  let faits = 0;
  const lignes = await enParallele(instruments, 12, async (ins) => {
    // Cast float8 : les colonnes `real` perdent des décimales dans la sérialisation JSON sinon.
    const barres = await paginerParDate(url, cle, "bars", `instrument_id=eq.${ins.id}`, "bar_date,open::float8,high::float8,low::float8,close::float8,volume");
    faits++;
    if (faits % 20 === 0) process.stderr.write(`  research: ${faits}/${instruments.length}\n`);
    return versLigne(ins.ticker, barres);
  });
  ecrireCache("research", lignes);
  return { nom: "research", series: lignes.map(enSerie) };
}

// Univers MARKET : pan-canadien du projet opérationnel (close Yahoo, splits oui, dividendes non).
// Liste des tickers = bars_coverage (les ETF de référence XIU/XWD/XIC/XSP/VFV… n'y sont pas,
// on écarte en plus les deux références par sécurité). Les séries de moins de 253 barres ne
// peuvent jamais être éligibles (momentum incalculable) : écartées au chargement.
export async function chargerMarket(sansCache = false): Promise<Univers> {
  if (!sansCache) {
    const c = lireCache("market");
    if (c) return { nom: "market", series: c };
  }
  const { url, cle } = PROJETS.operationnel;
  const couverture = await paginerParDate(url, cle, "bars_coverage", "interval=eq.1d", "ticker", "ticker");
  const exclus = new Set<string>(TICKERS_REFERENCE);
  const tickers = couverture.map((l) => String(l.ticker)).filter((t) => !exclus.has(t));
  process.stderr.write(`  market: ${tickers.length} tickers, téléchargement…\n`);
  let faits = 0;
  const lignes = await enParallele(tickers, 16, async (ticker) => {
    const filtre = `ticker=eq.${encodeURIComponent(ticker)}&interval=eq.1d`;
    const barres = await paginerParDate(url, cle, "bars", filtre, "bar_date,open,high,low,close,volume");
    faits++;
    if (faits % 200 === 0) process.stderr.write(`  market: ${faits}/${tickers.length}\n`);
    return versLigne(ticker, barres);
  });
  const gardees = lignes.filter((l) => l.dates.length >= 253);
  process.stderr.write(`  market: ${gardees.length} séries gardées (≥253 barres) sur ${lignes.length}\n`);
  ecrireCache("market", gardees);
  return { nom: "market", series: gardees.map(enSerie) };
}

// Références absolues (XIU.TO, XWD.TO) depuis le projet opérationnel.
export async function chargerReferences(sansCache = false): Promise<Map<string, Serie>> {
  const refs = new Map<string, Serie>();
  if (!sansCache) {
    const c = lireCache("references");
    if (c) {
      for (const s of c) refs.set(s.ticker, s);
      return refs;
    }
  }
  const { url, cle } = PROJETS.operationnel;
  const lignes: LigneBrute[] = [];
  for (const ticker of TICKERS_REFERENCE) {
    const filtre = `ticker=eq.${encodeURIComponent(ticker)}&interval=eq.1d`;
    const barres = await paginerParDate(url, cle, "bars", filtre, "bar_date,open,high,low,close,volume");
    lignes.push(versLigne(ticker, barres));
  }
  ecrireCache("references", lignes);
  for (const l of lignes) refs.set(l.ticker, enSerie(l));
  return refs;
}

// ── Dividendes (projet opérationnel) ────────────────────────────────────────
// Les prix de `bars` sont ajustés des DIVISIONS mais pas des dividendes ; la table
// `dividends` porte les montants BRUTS et historiques. On reconstitue le rendement
// total en ajoutant les dividendes détachés pendant la détention.
//
// Limite connue (signalée aussi par l'analyse du 22/08) : montants non ajustés des
// divisions face à des prix qui le sont → sur un titre ayant divisé APRÈS le
// détachement, le rendement est surestimé. Les événements dépassant PLAFOND_RENDEMENT
// du cours sont écartés comme incohérents, et leur nombre est rapporté.

export const PLAFOND_RENDEMENT = 0.25;

export interface Dividende {
  date: string;
  montant: number;
}

export type Dividendes = Map<string, Dividende[]>; // ticker → événements triés par date

export async function chargerDividendes(sansCache = false): Promise<Dividendes> {
  const chemin = join(REPERTOIRE_CACHE, "dividends.ndjson");
  if (!sansCache && existsSync(chemin)) {
    const m: Dividendes = new Map();
    for (const l of readFileSync(chemin, "utf8").split("\n").filter((x) => x.length > 0)) {
      const o = JSON.parse(l) as { ticker: string; evenements: Dividende[] };
      m.set(o.ticker, o.evenements);
    }
    return m;
  }
  const { url, cle } = PROJETS.operationnel;
  const lignes = await paginerParDate(url, cle, "dividends", "", "ticker,ex_date,amount", "ex_date");
  const m: Dividendes = new Map();
  for (const l of lignes) {
    const montant = Number(l.amount);
    if (!(montant > 0)) continue;
    const t = String(l.ticker);
    if (!m.has(t)) m.set(t, []);
    m.get(t)!.push({ date: String(l.ex_date), montant });
  }
  for (const ev of m.values()) ev.sort((a, b) => (a.date < b.date ? -1 : 1));
  mkdirSync(REPERTOIRE_CACHE, { recursive: true });
  writeFileSync(
    chemin,
    [...m.entries()].map(([ticker, evenements]) => JSON.stringify({ ticker, evenements })).join("\n") + "\n",
  );
  return m;
}

// Somme des dividendes détachés dans ]apres, jusqua] — on possède le titre à partir
// de l'ouverture du lendemain de l'achat, donc un détachement le jour même ne revient pas.
export function dividendesEntre(
  divs: Dividendes,
  serie: Serie,
  apres: string,
  jusqua: string,
): { somme: number; ecartes: number } {
  const ev = divs.get(serie.ticker);
  if (!ev) return { somme: 0, ecartes: 0 };
  let somme = 0;
  let ecartes = 0;
  for (const d of ev) {
    if (d.date <= apres) continue;
    if (d.date > jusqua) break;
    const i = serie.idx.get(d.date);
    const cours = i === undefined ? NaN : serie.close[i];
    if (cours > 0 && d.montant / cours > PLAFOND_RENDEMENT) {
      ecartes++;
      continue;
    }
    somme += d.montant;
  }
  return { somme, ecartes };
}
