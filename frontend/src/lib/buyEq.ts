// BUY EQ (#103) : parts détenues + liquidités → acheter / vendre / conserver, pour revenir à la
// cible 60/10/30 de la poche ETF (#76). Fonction pure, sans état ni réseau.
//
// Cible en dur : ce n'est PAS portefeuille.json (poids dérivés des avoirs, faux) ni
// etat.json.repartition_apports (règle d'apport du duo).

export const CIBLE: { ticker: string; label: string; poids: number }[] = [
  { ticker: "ZEQT.TO", label: "ZEQT", poids: 0.24 },
  { ticker: "VMO.TO", label: "VMO", poids: 0.24 },
  { ticker: "HXS.TO", label: "HXS", poids: 0.12 },
  { ticker: "ZAG.TO", label: "ZAG", poids: 0.1 },
  { ticker: "ZGLD.TO", label: "ZGLD", poids: 0.3 },
];

// Règle « 5/25 » : hors bande si l'écart dépasse le plus petit de 5 points ou 25 % de la cible.
export const tolerance = (poids: number) => Math.min(0.05, 0.25 * poids);

export interface Ligne {
  ticker: string;
  label: string;
  poids: number;
  cours: number;
  parts: number;
  partsApres: number;
  delta: number; // > 0 acheter, < 0 vendre, 0 conserver
  montant: number; // |delta| × cours
  pctAvant: number; // part de la valeur totale (titres + liquidités)
  pctApres: number;
  horsBandeAvant: boolean;
  horsBandeApres: boolean;
}

export interface Resultat {
  lignes: Ligne[];
  total: number; // titres + liquidités, constant avant / après
  liquidites: number;
  cashVentes: number;
  cashAchats: number;
  liquiditesRestantes: number;
  horsBandeAvant: boolean; // au moins un titre hors bande avant opérations
  horsBandeApres: boolean;
}

/**
 * - Complet (achatsSeulement = false) : parts cibles = ⌊total × poids / cours⌋ ; ventes comprises.
 * - Achats seulement : aucune vente, on part des avoirs.
 * Puis, dans les deux cas, le cash restant va une part à la fois au titre le plus loin sous sa
 * cible, tant qu'une part passe. On ne dépense jamais plus que ce qu'on a.
 * Renvoie null si la valeur totale est nulle.
 */
export function rebalancer(
  parts: Record<string, number>,
  liquidites: number,
  cours: Record<string, number>,
  achatsSeulement: boolean,
): Resultat | null {
  const avant = CIBLE.map((c) => parts[c.ticker] ?? 0);
  const prix = CIBLE.map((c) => cours[c.ticker]);
  const total = avant.reduce((s, n, i) => s + n * prix[i], 0) + liquidites;
  if (!(total > 0)) return null;

  // Complet : plancher de la cible, ventes comprises. Achats seulement : on part des avoirs.
  const apres = achatsSeulement
    ? [...avant]
    : CIBLE.map((c, i) => Math.floor((total * c.poids) / prix[i] + 1e-9));
  // Dans les deux cas, le cash restant est placé une part à la fois dans le titre le plus loin
  // sous sa cible, tant qu'une part passe (sinon le plancher sur 5 lignes laisse beaucoup de
  // cash dormir : 250 $ n'en investissaient que 110).
  {
    let cash = total - apres.reduce((s, n, i) => s + n * prix[i], 0);
    for (;;) {
      let meilleur = -1;
      let manque = -Infinity;
      CIBLE.forEach((c, i) => {
        if (prix[i] > cash + 1e-9) return;
        const m = c.poids * total - apres[i] * prix[i];
        if (m > manque) { manque = m; meilleur = i; }
      });
      if (meilleur < 0) break;
      apres[meilleur] += 1;
      cash -= prix[meilleur];
    }
  }

  const lignes: Ligne[] = CIBLE.map((c, i) => {
    const delta = apres[i] - avant[i];
    const pctAvant = (avant[i] * prix[i]) / total;
    const pctApres = (apres[i] * prix[i]) / total;
    const tol = tolerance(c.poids);
    return {
      ticker: c.ticker,
      label: c.label,
      poids: c.poids,
      cours: prix[i],
      parts: avant[i],
      partsApres: apres[i],
      delta,
      montant: Math.abs(delta) * prix[i],
      pctAvant,
      pctApres,
      horsBandeAvant: Math.abs(pctAvant - c.poids) > tol + 1e-9,
      horsBandeApres: Math.abs(pctApres - c.poids) > tol + 1e-9,
    };
  });
  const cashVentes = lignes.reduce((s, l) => s + (l.delta < 0 ? l.montant : 0), 0);
  const cashAchats = lignes.reduce((s, l) => s + (l.delta > 0 ? l.montant : 0), 0);
  return {
    lignes,
    total,
    liquidites,
    cashVentes,
    cashAchats,
    liquiditesRestantes: Math.max(0, liquidites + cashVentes - cashAchats),
    horsBandeAvant: lignes.some((l) => l.horsBandeAvant),
    horsBandeApres: lignes.some((l) => l.horsBandeApres),
  };
}
