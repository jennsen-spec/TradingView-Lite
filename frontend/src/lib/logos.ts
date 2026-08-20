// Logo d'un symbole : URL d'un fournisseur (par ticker) + fallback monogramme (géré par SymbolLogo).
// Fournisseur volontairement isolé ici pour être facilement remplaçable si la couverture déçoit.
export function logoUrl(symbol: string): string {
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol.toUpperCase())}.png`;
}

// Couleur stable dérivée du ticker (monogramme), issue de la palette de la maquette.
const MONO_COLORS = [
  "#185FA5", "#0F6E56", "#993C1D", "#534AB7", "#854F0B",
  "#72243E", "#0C447C", "#3B6D11", "#633806", "#4B1528",
];
export function monoColor(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return MONO_COLORS[h % MONO_COLORS.length];
}

// Initiale affichée dans le monogramme (base du ticker, sans suffixe de bourse).
export function monoText(symbol: string): string {
  const base = symbol.replace(/[.^-].*$/, "");
  return (base.slice(0, 1) || symbol.slice(0, 1) || "?").toUpperCase();
}
