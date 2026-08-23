// ETF sectoriels — récupérés directement chez Yahoo, car la base TVLite ne contient
// que XFN parmi eux. Rien n'est écrit dans Supabase : cache local uniquement.
//
// Ils servent d'INTERRUPTEURS PAR SECTEUR : un secteur dont l'ETF clôture sous sa
// moyenne est fermé, ses titres sortent du classement (ou passent en liquidités selon
// la variante). C'est la version fine de l'interrupteur global.
//
// Contrainte de couverture : seuls cinq secteurs ont un ETF remontant à 2003. Les
// autres — industrie en tête, pourtant saturée 69 % du temps — sont rattachés à
// l'indice large XIU faute de mieux. C'est une approximation, pas un choix.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPERTOIRE_CACHE } from "./config.ts";
import type { Serie } from "./data.ts";

const UA = { "User-Agent": "Mozilla/5.0" };
const CHEMIN = () => join(REPERTOIRE_CACHE, "etf-secteurs.ndjson");

// secteur Yahoo → ETF qui le représente. `null` = pas d'ETF assez ancien → XIU.
export const PORTE_SECTEUR: Record<string, string> = {
  "Basic Materials": "XGD.TO",
  "Energy": "XEG.TO",
  "Financial Services": "XFN.TO",
  "Technology": "XIT.TO",
  "Real Estate": "XRE.TO",
};
export const PORTE_DEFAUT = "XIU.TO"; // secteurs sans ETF ancien : industrie, santé, conso…

export const TICKERS_ETF = [...new Set([...Object.values(PORTE_SECTEUR), "XMA.TO"])];

let portes: Map<string, Serie> | null = null;
export function definirPortes(m: Map<string, Serie> | null): void { portes = m; }

// Série qui garde un secteur donné (son ETF, ou l'indice large à défaut).
export function serieDePorte(secteur: string, refs: Map<string, Serie>): Serie | null {
  const t = PORTE_SECTEUR[secteur] ?? PORTE_DEFAUT;
  return portes?.get(t) ?? refs.get(t) ?? null;
}
export function tickerDePorte(secteur: string): string {
  return PORTE_SECTEUR[secteur] ?? PORTE_DEFAUT;
}

interface Brut { ticker: string; dates: string[]; open: number[]; close: number[]; volume: number[] }

function enSerie(l: Brut): Serie {
  const idx = new Map<string, number>();
  l.dates.forEach((d, i) => idx.set(d, i));
  return {
    ticker: l.ticker, dates: l.dates,
    open: Float64Array.from(l.open), close: Float64Array.from(l.close),
    volume: Float64Array.from(l.volume), idx, memo: new Map(),
  };
}

async function telecharger(t: string): Promise<Brut | null> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(t)}` +
    `?period1=0&period2=${Math.floor(Date.now() / 1000)}&interval=1d`;
  const r = await fetch(url, { headers: UA });
  if (!r.ok) return null;
  const j = (await r.json()) as any;
  const res = j?.chart?.result?.[0];
  const q = res?.indicators?.quote?.[0];
  if (!res?.timestamp || !q) return null;
  const l: Brut = { ticker: t, dates: [], open: [], close: [], volume: [] };
  for (let i = 0; i < res.timestamp.length; i++) {
    const o = q.open?.[i], c = q.close?.[i];
    if (!(o > 0) || !(c > 0)) continue;
    l.dates.push(new Date(res.timestamp[i] * 1000).toISOString().slice(0, 10));
    l.open.push(o); l.close.push(c); l.volume.push(q.volume?.[i] ?? 0);
  }
  return l.dates.length > 0 ? l : null;
}

export async function chargerEtfSectoriels(sansCache = false): Promise<Map<string, Serie>> {
  const m = new Map<string, Serie>();
  if (!sansCache && existsSync(CHEMIN())) {
    for (const ligne of readFileSync(CHEMIN(), "utf8").split("\n").filter((x) => x.length > 0)) {
      const s = enSerie(JSON.parse(ligne) as Brut);
      m.set(s.ticker, s);
    }
    if (TICKERS_ETF.every((t) => m.has(t))) return m;
  }
  const lignes: Brut[] = [];
  for (const t of TICKERS_ETF) {
    const l = await telecharger(t);
    if (l) { lignes.push(l); m.set(t, enSerie(l)); process.stderr.write(`  ETF ${t} : ${l.dates.length} barres depuis ${l.dates[0]}\n`); }
    else process.stderr.write(`  ETF ${t} : INDISPONIBLE\n`);
    await new Promise((r) => setTimeout(r, 150));
  }
  mkdirSync(REPERTOIRE_CACHE, { recursive: true });
  writeFileSync(CHEMIN(), lignes.map((l) => JSON.stringify(l)).join("\n") + "\n");
  return m;
}
