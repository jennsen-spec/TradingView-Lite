// Secteurs GICS par titre, récupérés chez Yahoo (quoteSummary → assetProfile).
//
// LIMITE À CONNAÎTRE : Yahoo renvoie le secteur ACTUEL, pas historique. Une société
// reclassée depuis porte son étiquette d'aujourd'hui sur tout son passé. Le biais est
// léger mais réel — il n'invente pas de performance, il déplace des titres d'un panier
// à l'autre. À garder en tête avant de conclure quoi que ce soit de sectoriel.
//
// Rien n'est écrit dans Supabase : le cache local suffit au labo.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { REPERTOIRE_CACHE } from "./config.ts";

const UA = { "User-Agent": "Mozilla/5.0" }; // Yahoo bloque les requêtes sans UA.
const CHEMIN = () => join(REPERTOIRE_CACHE, "secteurs.json");

export interface Secteur {
  secteur: string;
  industrie: string;
}
export type Secteurs = Map<string, Secteur>;

let courants: Secteurs | null = null;

export function definirSecteurs(s: Secteurs | null): void {
  courants = s;
}
export function secteurDe(ticker: string): string {
  return courants?.get(ticker)?.secteur ?? "Inconnu";
}
export function industrieDe(ticker: string): string {
  return courants?.get(ticker)?.industrie || secteurDe(ticker);
}
// Clé de regroupement pour le plafond de concentration.
export function grouper(ticker: string, niveau: "secteur" | "industrie"): string {
  return niveau === "industrie" ? industrieDe(ticker) : secteurDe(ticker);
}

async function attendre(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

// Cookie + crumb : même mécanique que backend/src/yahoo.js.
async function crumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    const r1 = await fetch("https://fc.yahoo.com/", { headers: UA });
    const cookie = (r1.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).filter(Boolean).join("; ");
    const r2 = await fetch("https://query1.finance.yahoo.com/v1/test/getcrumb", { headers: { ...UA, cookie } });
    const c = (await r2.text()).trim();
    if (!c || c.length > 40 || c.includes("<")) return null;
    return { crumb: c, cookie };
  } catch {
    return null;
  }
}

async function unTicker(t: string, c: { crumb: string; cookie: string }): Promise<Secteur | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(t)}` +
    `?modules=assetProfile&crumb=${encodeURIComponent(c.crumb)}`;
  for (let essai = 0; essai < 3; essai++) {
    try {
      const rep = await fetch(url, { headers: { ...UA, cookie: c.cookie } });
      if (rep.status === 429 || rep.status >= 500) {
        await attendre(800 * (essai + 1) ** 2);
        continue;
      }
      if (!rep.ok) return null;
      const j = (await rep.json()) as any;
      const p = j?.quoteSummary?.result?.[0]?.assetProfile;
      if (!p?.sector) return null;
      return { secteur: String(p.sector), industrie: String(p.industry ?? "") };
    } catch {
      await attendre(800 * (essai + 1) ** 2);
    }
  }
  return null;
}

export async function chargerSecteurs(tickers: string[], sansCache = false): Promise<Secteurs> {
  const m: Secteurs = new Map();
  if (!sansCache && existsSync(CHEMIN())) {
    const brut = JSON.parse(readFileSync(CHEMIN(), "utf8")) as Record<string, Secteur>;
    for (const [t, s] of Object.entries(brut)) m.set(t, s);
    const manquants = tickers.filter((t) => !m.has(t));
    if (manquants.length === 0) return m;
    process.stderr.write(`  secteurs : ${m.size} en cache, ${manquants.length} à récupérer\n`);
    tickers = manquants;
  }

  const c = await crumb();
  if (!c) throw new Error("crumb Yahoo indisponible");

  // Concurrence volontairement basse : Yahoo répond 429 très vite au-delà.
  const FILES = 4;
  let i = 0;
  let faits = 0;
  let echecs = 0;
  await Promise.all(
    Array.from({ length: FILES }, async () => {
      while (i < tickers.length) {
        const t = tickers[i++];
        const s = await unTicker(t, c);
        if (s) m.set(t, s);
        else echecs++;
        if (++faits % 50 === 0) process.stderr.write(`  secteurs : ${faits}/${tickers.length} (${echecs} sans réponse)\n`);
        await attendre(120);
      }
    }),
  );

  mkdirSync(REPERTOIRE_CACHE, { recursive: true });
  writeFileSync(CHEMIN(), JSON.stringify(Object.fromEntries(m), null, 0));
  process.stderr.write(`  secteurs : ${m.size} titres classés, ${echecs} sans réponse\n`);
  return m;
}
