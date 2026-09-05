// Registre d'instruments (#98, épopée #97).
//
// Un instrument TVLite porte son nom, sa catégorie, son fournisseur et le ticker de ce
// fournisseur — comme `TVC:GOLD` chez TradingView est un nom au-dessus d'un flux, pas une
// redirection. Yahoo est le fournisseur par défaut : tout symbole ABSENT du registre lui est
// transmis inchangé, donc les 907 titres et les synthétiques ne bougent pas.
//
// Même patron que les synthétiques (`portfolios.ts`) : le registre est résolu au bord du client,
// dans `api.ts`. Les fournisseurs qui exigent un serveur (FRED, multpl) viendront avec leur route.

import type { SymbolHit } from "./api";

export type ProviderId = "yahoo"; // fred · multpl : enfants suivants de #97

export interface Instrument {
  symbol: string;   // symbole TVLite — celui qu'on affiche partout
  name: string;
  provider: ProviderId;
  ticker: string;   // ticker chez le fournisseur
  category: string; // clé d'onglet de la recherche
  type: string;     // libellé FR
  exchange: string; // bourse / source lisible
  country: string;  // clé de COUNTRY_META (filtre par pays)
  mots: string;     // termes de recherche, français inclus
}

// Tickers vérifiés chez Yahoo le 05/09/2026.
const CATALOGUE: Instrument[] = [
  // --- Indices ---
  { symbol: "SPX", name: "S&P 500", provider: "yahoo", ticker: "^GSPC", category: "indice",
    type: "Indice", exchange: "S&P Dow Jones", country: "USA",
    mots: "sp500 s&p 500 spx indice americain etats-unis" },
  { symbol: "CAC40", name: "CAC 40", provider: "yahoo", ticker: "^FCHI", category: "indice",
    type: "Indice", exchange: "Euronext Paris", country: "France",
    mots: "cac 40 cac40 france paris indice francais" },
  { symbol: "TSX", name: "S&P/TSX Composite", provider: "yahoo", ticker: "^GSPTSE", category: "indice",
    type: "Indice", exchange: "Toronto", country: "Canada",
    mots: "tsx toronto composite canada indice canadien" },
  { symbol: "VIX", name: "Indice de volatilité du S&P 500", provider: "yahoo", ticker: "^VIX",
    category: "indice", type: "Indice", exchange: "Cboe", country: "USA",
    mots: "vix volatilite peur panique indice de la peur" },
  { symbol: "XWD", name: "iShares MSCI World Index ETF", provider: "yahoo", ticker: "XWD.TO",
    category: "fonds", type: "ETF", exchange: "Toronto", country: "Canada",
    mots: "xwd msci monde world mondial" },

  // --- Contrats à terme ---
  { symbol: "GOLD", name: "Or — contrat à terme", provider: "yahoo", ticker: "GC=F",
    category: "future", type: "Contrat à terme", exchange: "COMEX", country: "USA",
    mots: "or gold once metal precieux aurum" },
  { symbol: "SILVER", name: "Argent — contrat à terme", provider: "yahoo", ticker: "SI=F",
    category: "future", type: "Contrat à terme", exchange: "COMEX", country: "USA",
    mots: "argent silver metal precieux" },
  { symbol: "USOIL", name: "Pétrole brut WTI — contrat à terme", provider: "yahoo", ticker: "CL=F",
    category: "future", type: "Contrat à terme", exchange: "NYMEX", country: "USA",
    mots: "petrole pétrole brut wti crude oil baril energie" },
  { symbol: "BRENT", name: "Pétrole Brent — contrat à terme", provider: "yahoo", ticker: "BZ=F",
    category: "future", type: "Contrat à terme", exchange: "NYMEX", country: "USA",
    mots: "petrole pétrole brent crude oil baril mer du nord energie" },

  // --- Forex ---
  { symbol: "USDCAD", name: "Dollar US / Dollar canadien", provider: "yahoo", ticker: "CAD=X",
    category: "devise", type: "Devise", exchange: "Forex", country: "Forex",
    mots: "usdcad usd cad dollar americain canadien huard taux de change" },
  { symbol: "CADEUR", name: "Dollar canadien / Euro", provider: "yahoo", ticker: "CADEUR=X",
    category: "devise", type: "Devise", exchange: "Forex", country: "Forex",
    mots: "cadeur cad eur dollar canadien euro huard taux de change" },
  { symbol: "EURCAD", name: "Euro / Dollar canadien", provider: "yahoo", ticker: "EURCAD=X",
    category: "devise", type: "Devise", exchange: "Forex", country: "Forex",
    mots: "eurcad eur cad euro dollar canadien taux de change" },
  { symbol: "EURUSD", name: "Euro / Dollar US", provider: "yahoo", ticker: "EURUSD=X",
    category: "devise", type: "Devise", exchange: "Forex", country: "Forex",
    mots: "eurusd eur usd euro dollar americain taux de change" },
];

const PAR_SYMBOLE = new Map(CATALOGUE.map((i) => [i.symbol, i]));
const TICKERS = new Set(CATALOGUE.map((i) => i.ticker.toUpperCase()));

export function getInstrument(sym: string): Instrument | null {
  return PAR_SYMBOLE.get(sym.trim().toUpperCase()) ?? null;
}

// Ticker à interroger chez le fournisseur. Neutre hors registre : `AAPL` reste `AAPL`.
export function resolveTicker(sym: string): string {
  return getInstrument(sym)?.ticker ?? sym;
}

// Un résultat Yahoo qui est le sous-jacent d'une entrée du registre fait doublon
// (chercher « gold » renverrait GOLD *et* GC=F) — on ne garde que l'entrée du registre.
export function isTickerDuRegistre(sym: string): boolean {
  return TICKERS.has(sym.trim().toUpperCase());
}

// Entrées du registre correspondant à la recherche — injectées en tête, comme `syntheticHits`.
export function instrumentHits(query: string): SymbolHit[] {
  const q = query.trim().toLowerCase();
  const enHit = (i: Instrument): SymbolHit => ({
    symbol: i.symbol, name: i.name, exchange: i.exchange, country: i.country,
    type: i.type, category: i.category, source: `${i.provider} · ${i.ticker}`,
  });
  if (!q) return [];
  return CATALOGUE
    .filter((i) => `${i.symbol} ${i.name} ${i.mots}`.toLowerCase().includes(q))
    .map(enHit);
}
