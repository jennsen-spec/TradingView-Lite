// Le rapport mensuel — une page qui dit quoi faire, puis rend des comptes.
//
//   npm run rapport                          dernier signal disponible
//   npm run rapport -- --signal 2026-08-31
//   npm run rapport -- --sortie chemin.html
//   npm run rapport -- --preavis             + la section « pré-rapport » (#96)
//   npm run rapport -- --preavis --preavis-signal 2026-08-27    (répétition générale)
//
// PRÉ-RAPPORT (#96) — la veille de la fin du mois, la page porte EN TÊTE une section
// qui répond à « qu'est-ce qu'on ferait si le mois se terminait aujourd'hui ? ». Le
// rapport du mois précédent reste dessous, intact : la page est régénérée en entier à
// chaque passage, la section est donc un mode de génération, pas une greffe. Elle
// disparaît d'elle-même au passage suivant sans `--preavis`.
//
// Ordre des sections, et c'est délibéré : on lit d'abord CE QU'IL FAUT FAIRE,
// une main sur le carnet d'ordres. Les comptes viennent après. Le journal réel
// passe avant celui du backtest : c'est l'argent de Jean qui compte, la
// référence historique n'est là que pour se comparer.

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync } from "node:fs";
import { calculerCycle, RACINE, type Cycle } from "./cycleCalc.ts";
import { construireJournal } from "./journal.ts";

const { values } = parseArgs({ options: {
  signal: { type: "string" }, sortie: { type: "string" }, marge: { type: "string" },
  frais: { type: "boolean" }, enregistrer: { type: "boolean" },
  preavis: { type: "boolean" }, "preavis-signal": { type: "string" },
} });

const TVLITE = "https://jennsen-spec.github.io/TradingView-Lite/";
const marge = values.marge ? Number(values.marge) : undefined;
const c = await calculerCycle({ signal: values.signal, marge, frais: values.frais });
// `--enregistrer` inscrit un cycle dans l'état ; le pré-rapport ne décide rien et ne
// doit RIEN y inscrire. Les combiner écrirait un cycle daté du mauvais jour dans
// l'historique, et le mois suivant partirait d'un portefeuille faux.
if (values.preavis && values.enregistrer) {
  console.error(" --preavis et --enregistrer sont incompatibles : un pré-rapport n'inscrit aucun cycle (#96).");
  process.exit(1);
}
// Le cycle provisoire du pré-rapport. `frais: false` : le premier appel vient de
// rafraîchir le cache, un second téléchargement ne servirait qu'à perdre deux minutes.
let p = values.preavis
  ? await calculerCycle({ signal: values["preavis-signal"], marge, provisoire: true })
  : null;
// Le mois vient de se terminer : la « répétition » dirait mot pour mot ce que le
// rapport dit déjà. On retire la section plutôt que de publier un doublon — et le
// marqueur reste intact, donc l'Action ne verra rien à publier.
if (p && p.signal <= c.signal) {
  console.log(` Pré-rapport sans objet : la clôture du ${p.signal} est déjà couverte par le signal du ${c.signal}.`);
  p = null;
}
// Aucune hypothèse n'est forcée ici : elle est déclarée dans le jeu de règles
// (`execution.achat_differe`) et le rapport AFFICHE celle qu'il a appliquée. Forcer
// la valeur ici masquerait un jeu de règles qui dirait autre chose.
const j = await construireJournal({ jeu: c.etat.regles.jeu as string });
const etat = c.etat as any;

// #61 — test de conformité moteur ↔ rapport. Deux implémentations de la même
// stratégie : le moteur du backtest (journal) et le calcul du cycle (rapport).
// On rejoue le rapport sur le dernier mois investi que le moteur connaît et on
// exige la même sélection. Un écart = un rapport faux quelque part → on ne
// publie PAS (échec du processus, même mécanique que le garde-fou de fraîcheur).
let conformite = "conformité moteur : non vérifiable (aucun mois investi au journal)";
if (j.moteurDernier) {
  const verif = await calculerCycle({ signal: j.moteurDernier.reb });
  const a = j.moteurDernier.retenus, b = [...verif.detenus].sort();
  const identiques = a.length === b.length && a.every((t, i) => t === b[i]);
  if (!identiques || !verif.marche.investi) {
    console.error(` CONFORMITÉ MOTEUR ↔ RAPPORT : ÉCHEC sur ${j.moteurDernier.reb}`);
    console.error(`   moteur  (${a.length}) : ${a.join(", ")}`);
    console.error(`   rapport (${b.length}) : ${b.join(", ")}`);
    if (!verif.marche.investi) console.error(`   et le rapport lit l'interrupteur COUPÉ là où le moteur était investi.`);
    console.error(` Rien ne doit être publié tant que l'écart n'est pas expliqué (#61).`);
    process.exit(1);
  }
  conformite = `conformité moteur : OK — mois vérifié ${j.moteurDernier.reb}`;
  console.log(` ${conformite}`);
}

// #60 — l'inventaire de l'univers, si un passage récent existe (l'Action le lance
// juste avant). Des manquants du duo → encart d'alerte visible dans le rapport ;
// un fichier absent ou vieux → rien, le rapport reste ce qu'il était.
let inventaire: { date: string; manquantsDuo: { ticker: string; nom: string; dv: number }[]; radies: string[] } | null = null;
try {
  const inv = JSON.parse(readFileSync(new URL("../.cache/inventaire.json", import.meta.url).pathname, "utf8"));
  const age = (Date.now() - new Date(inv.date + "T00:00:00Z").getTime()) / 86400000;
  if (age <= 40) inventaire = inv;
} catch { /* pas d'inventaire : pas d'alerte */ }
const blocInventaire = inventaire && inventaire.manquantsDuo.length > 0
  ? `<div style="max-width:1120px;margin:18px auto 0;padding:14px 20px;border:2px solid #B4402E;border-radius:10px;font-family:inherit">
      <b>⚠ Inventaire du ${inventaire.date} : ${inventaire.manquantsDuo.length} titre(s) du duo cotés mais absents de la base.</b>
      Le classement de ce rapport ne les voit pas.
      ${inventaire.manquantsDuo.map((m) => `<span class="mono">${m.ticker}</span> (${(m.dv / 1e6).toFixed(1).replace(".", ",")}&nbsp;M$/j)`).join(" · ")}
      — procédure d'ajout : en-tête de <span class="mono">labo/src/inventaire.ts</span>.</div>`
  : "";
if (inventaire?.manquantsDuo.length) console.log(` ⚠ inventaire : ${inventaire.manquantsDuo.length} manquant(s) du duo — alerte au rapport`);

const r = (x: number, n: number) => Number(x.toFixed(n));
const donnees = {
  barres: j.barres.map((b) => [b.mois, b.reb, b.next, b.investi ? 1 : 0, b.n, r(b.avant, 2), r(b.apres, 2), r(b.net, 6), r(b.frais, 2)]),
  positions: j.positions.map((p) => [p.ticker, p.secteur === "Technology" ? "T" : "I", p.sigAchat, p.achatDate,
    r(p.achatPrix, 4), p.sigVente, p.venteDate, r(p.ventePrix, 4), p.nMois, r(p.mise, 2), r(p.ajustements, 2),
    r(p.resultat, 2), r(p.pctPrix, 6), r(p.frais, 2)]),
  lignes: j.lignes.map((l) => [l.mois, l.ticker, l.secteur === "Technology" ? "T" : "I", l.achatDate, r(l.achatPrix, 4),
    l.venteDate, r(l.ventePrix, 4), r(l.ret, 6), r(l.mise, 2), r(l.frais, 2), r(l.resultat, 2), l.entree ? 1 : 0, r(l.div, 4)]),
  capital: j.capital, soldeFinal: r(j.soldeFinal, 2), depuis: j.depuis, jusqua: j.jusqua,
};

const eur = (v: number, d = 2) => v.toLocaleString("fr-CA", { minimumFractionDigits: d, maximumFractionDigits: d });
const pc = (v: number, d = 1) => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(d).replace(".", ",") + "\u00A0%";
const jour = (s: string) => s.slice(8, 10) + "/" + s.slice(5, 7) + "/" + s.slice(0, 4);
const MOIS = ["janvier","février","mars","avril","mai","juin","juillet","août","septembre","octobre","novembre","décembre"];
const moisLong = (s: string) => MOIS[+s.slice(5, 7) - 1] + " " + s.slice(0, 4);
// La séance d'exécution vient des données, jamais d'un calcul de calendrier.
const quand = c.execution ? `le ${jour(c.execution)}` : "à la prochaine séance";

const achats = c.ordres.filter((o) => o.action === "acheter");
const reconduits = c.ordres.filter((o) => o.action === "conserver");
const enCours = etat.cycles.length > 0;

// ── Le tableau « À faire » ────────────────────────────────────────────────────
// Un seul tableau, trié par rang, la colonne Action portant vendre / acheter /
// conserver. Les sortants n'ont plus de rang utile : ils tombent naturellement en bas.
// Le même rendu sert au rapport et au pré-rapport — s'ils divergeaient, l'un des deux
// mentirait.
const TIRET = `<span class="min">—</span>`;
const signe = (v: number) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
const argent = (v: number, d = 0) => `${v >= 0 ? "+" : "−"}${eur(Math.abs(v), d)}&nbsp;$`;

interface Rangee {
  ticker: string; secteur: string; action: "vendre" | "acheter" | "conserver";
  rang: number | null; momentum: number | null; cloture: number | null;
  quantite: number | null; prix: string; montant: number | null; coutMax: string;
  entree: number | null; gain: number | null; pctGain: number | null;
}
const rangees = (cy: Cycle): Rangee[] => [
  ...cy.ordres.map((o): Rangee => ({
    ticker: o.ticker, secteur: o.secteur, action: o.action, rang: o.rang,
    momentum: o.momentum, cloture: o.cloture,
    // Sur une ligne gardée, la quantité est celle qu'on DÉTIENT : dans un tableau qui
    // affiche aussi des quantités vendues et un résultat, le nombre doit désigner
    // partout des actions en main.
    quantite: o.action === "conserver" ? (o.detenu ?? o.quantite) : o.quantite,
    prix: o.action === "acheter" ? `${eur(o.limite)}&nbsp;$` : TIRET,
    montant: o.montant,
    coutMax: o.action === "acheter" ? `${eur(o.plafondOrdre, 0)}&nbsp;$` : TIRET,
    entree: o.entree, gain: o.gain, pctGain: o.pctGain,
  })),
  ...cy.sortants.map((v): Rangee => ({
    ticker: v.ticker, secteur: v.secteur, action: "vendre", rang: v.rang,
    momentum: v.momentum, cloture: v.cloture, quantite: v.detenu,
    // Une vente part AU MARCHÉ : la stratégie n'a ni stop ni prix objectif, elle sort
    // au rebalancement. Afficher une limite inventerait une règle qui n'existe pas.
    prix: `<span class="marche">au marché</span>`,
    montant: v.produit, coutMax: TIRET, entree: v.entree, gain: v.gain, pctGain: v.pctGain,
  })),
].sort((a, b) => (a.rang ?? 1e9) - (b.rang ?? 1e9));

const cellResultat = (gain: number | null, pct: number | null) =>
  gain === null ? TIRET
    : `<span class="${signe(gain)}">${argent(gain)}</span>`
      + (pct === null ? "" : `<br><span class="pct ${signe(gain)}">${pc(pct)}</span>`);

const ligneOrdre = (r: Rangee) => `<tr>
  <td class="g"><i class="puce ${r.secteur === "Technology" ? "T" : "I"}"></i><span class="tick">${r.ticker}</span></td>
  <td class="g"><span class="badge ${r.action}">${r.action}</span></td>
  <td class="num">${r.rang ?? TIRET}</td>
  <td class="num ${r.momentum === null ? "" : signe(r.momentum)}">${r.momentum === null ? TIRET : pc(r.momentum)}</td>
  <td class="num">${r.cloture === null ? TIRET : `${eur(r.cloture)}&nbsp;$`}${
    r.entree === null ? "" : `<br><span class="achete">acheté ${eur(r.entree)}&nbsp;$</span>`}</td>
  <td class="num qte">${r.quantite ?? TIRET}</td>
  <td class="num fort">${r.prix}</td>
  <td class="num">${r.montant === null ? TIRET : `${eur(r.montant, 0)}&nbsp;$`}</td>
  <td class="num min">${r.coutMax}</td>
  <td class="num res">${cellResultat(r.gain, r.pctGain)}</td></tr>`;

// Pied décomposé : une ligne par groupe présent, puis le total. Les pourcentages sont
// rapportés au COÛT D'ENTRÉE du groupe, jamais au montant affiché — sinon ils ne
// voudraient rien dire. Le total ne paraît que s'il y a plus d'un groupe, sans quoi il
// répéterait la ligne du dessus (cas d'un premier mois : que des achats).
const coutEntree = (xs: { detenu: number | null; entree: number | null; gain: number | null }[]) =>
  xs.filter((x) => x.gain !== null && x.detenu !== null && x.entree !== null)
    .reduce((a, x) => a + x.detenu! * x.entree!, 0);

const piedTableau = (cy: Cycle) => {
  const ligne = (lib: string, quoi: string, n: number, montant: number, cmax: string,
                 gain: number | null, pct: number | null, total = false) =>
    `<tr${total ? ` class="total"` : ""}><td class="g" colspan="7">${lib}<span class="quoi">${quoi}</span>`
    + `${n ? `<span class="quoi">${n} ligne${n > 1 ? "s" : ""}</span>` : ""}</td>`
    + `<td class="num">${eur(montant, 0)}&nbsp;$</td><td class="num min">${cmax}</td>`
    + `<td class="num res">${cellResultat(gain, pct)}</td></tr>`;
  const nA = cy.ordres.filter((o) => o.action === "acheter").length;
  const gardes = cy.ordres.filter((o) => o.action === "conserver");
  const g: string[] = [];
  if (cy.sortants.length)
    g.push(ligne("Ventes", "produit estimé", cy.sortants.length, cy.produit, TIRET, cy.gainRealise, cy.pctRealise));
  if (nA) g.push(ligne("Achats", "engagé", nA, cy.engage, `${eur(cy.coutMax, 0)}&nbsp;$`, null, null));
  if (gardes.length)
    g.push(ligne("Conservations", "valeur des lignes", gardes.length, cy.conserve, TIRET, cy.gainLatent, cy.pctLatent));
  if (g.length > 1) {
    const gain = cy.gainRealise === null && cy.gainLatent === null
      ? null : (cy.gainRealise ?? 0) + (cy.gainLatent ?? 0);
    const cout = coutEntree([...cy.sortants, ...gardes]);
    g.push(ligne("Portefeuille après les ordres", "hors ventes", 0, cy.engage + cy.conserve,
      `${eur(cy.coutMax, 0)}&nbsp;$`, gain, gain !== null && cout > 0 ? gain / cout : null, true));
  }
  return g.join("");
};

const TETE_ORDRES = `<thead><tr><th class="g">Titre</th><th class="g">Action</th><th>Rang</th>`
  + `<th>Momentum</th><th>Dernière clôture</th><th>Quantité</th><th>Prix</th><th>Montant</th>`
  + `<th>Coût max</th><th>Résultat</th></tr></thead>`;

const tableauOrdres = (cy: Cycle) => `<div class="cadre"><table>
    ${TETE_ORDRES}
    <tbody>${rangees(cy).map(ligneOrdre).join("")}</tbody>
    <tfoot>${piedTableau(cy)}</tfoot>
  </table></div>`;

// L'interrupteur et les candidats se disent au mot près dans le rapport et dans le
// pré-rapport : un seul rendu pour les deux, sinon l'un des deux finirait par mentir.
const blocInterrupteur = (cy: Cycle, titre: string, oui: string, non: string) =>
  `<div class="interrupteur ${cy.marche.investi ? "on" : "off"}">
    <b>${titre}</b>
    <span>${cy.marche.seance
      ? `${cy.marche.ticker} ouvre à <span class="mono">${eur(cy.marche.ouverture)}&nbsp;$</span> et clôture à <span class="mono">${eur(cy.marche.cours)}&nbsp;$</span>, contre sa MM${cy.marche.ma.slice(3)} à <span class="mono">${eur(cy.marche.moyenne)}&nbsp;$</span> — il faut les DEUX sous la moyenne pour couper`
      : `${cy.marche.ticker} clôture à <span class="mono">${eur(cy.marche.cours)}&nbsp;$</span> contre sa MM${cy.marche.ma.slice(3)} à <span class="mono">${eur(cy.marche.moyenne)}&nbsp;$</span>`}
    → <strong>${cy.marche.investi ? oui : non}</strong></span>
  </div>`;

const tableauxCandidats = (cy: Cycle) => cy.candidats.map((g) => `
  <h3>${g.secteur === "Technology" ? "Technology" : "Industrials"}</h3>
  <div class="cadre"><table>
    <thead><tr><th class="g">Titre</th><th class="g">État</th><th>Rang</th><th>Momentum</th><th>Cours</th><th>Volume $ / jour</th></tr></thead>
    <tbody>${g.titres.map((t) => `<tr class="${t.retenu ? "" : "reserve"}">
      <td class="g"><i class="puce ${t.secteur === "Technology" ? "T" : "I"}"></i><span class="tick">${t.ticker}</span></td>
      <td class="g"><span class="badge ${t.retenu ? "acheter" : "reserve"}">${t.retenu ? "retenu" : "réserve"}</span></td>
      <td class="num">${t.rang}</td><td class="num ${signe(t.momentum)}">${pc(t.momentum)}</td>
      <td class="num">${eur(t.cloture)}&nbsp;$</td><td class="num min">${eur(t.dv50 / 1000, 0)}&nbsp;k$</td></tr>`).join("")}</tbody>
  </table></div>`).join("");

const LEGENDE_CANDIDATS = `<div class="legende"><span><i class="badge acheter">retenu</i> la règle l'achète</span><span><i class="badge reserve">réserve</i> vu, écarté par le plafond ou le rang</span></div>`;

// Les mêmes alertes servent aux deux tableaux.
const alertes = (cy: Cycle) =>
  (cy.alertes.inachetables.length ? `<div class="alerte"><strong>Inachetable à ${eur(cy.ligne, 0)} $ la ligne :</strong> ${cy.alertes.inachetables.map((o) => `${o.ticker} à ${eur(o.cloture)} $ l'action`).join(" · ")}. Une action entière coûte plus cher que la ligne entière.</div>` : "")
  + (cy.alertes.lourds.length ? `<div class="alerte"><strong>Ordre lourd :</strong> ${cy.alertes.lourds.map((o) => `${o.ticker} pèse ${(o.partVolume * 100).toFixed(0)} % d'une journée de volume`).join(" · ")}. L'encan d'ouverture ne représente qu'une fraction de la journée — attends-toi à décaler le prix.</div>` : "");

// PRÉ-RAPPORT (#96) — placé au-dessus de l'en-tête, comme l'encart d'inventaire :
// c'est l'information actionnable du soir, le rapport du mois reste entier dessous.
// Les marqueurs de distinction sont sur le CONTENANT (bandeau ambre plein, pastille
// « provisoire », encadré, titres en italique ambre) ; à l'intérieur, tout se lit
// exactement comme le rapport — mêmes colonnes, mêmes badges, mêmes conventions.
const blocPreavis = (cy: Cycle | null) => cy === null ? "" : `
<section class="preavis">
  <div class="bandeau">
    <span class="etiq">Pré-rapport · répétition à J−1</span>
    <span class="chip">provisoire</span>
  </div>
  <div class="dedans">
    <h2>Si le mois se terminait aujourd'hui&nbsp;— <span class="mono">${jour(cy.signal)}</span></h2>
    <p class="chapo">Ce que la règle prescrirait si la clôture du ${jour(cy.signal)} était la fin du mois. <strong>Ce n'est pas le signal du mois</strong>&nbsp;: le vrai rapport paraît le dernier jour du mois, et cette section disparaîtra alors. Rien n'est enregistré, aucun ordre n'est à passer aujourd'hui.</p>
    ${blocInterrupteur(cy, "Interrupteur provisoire", "on investirait", "liquidités — on n'achèterait rien")}
    ${cy.marche.investi ? `
    <h2>À faire à la prochaine séance</h2>
    <p class="chapo">Prix limite à <strong>+${(cy.marge * 100).toFixed(0)}&nbsp;%</strong> de la clôture du ${jour(cy.signal)} ; les ventes partent <strong>au marché</strong>. Les quantités bougeront encore d'ici la fin du mois.</p>
    ${tableauOrdres(cy)}
    <p style="font-size:.88rem;color:var(--ink-2)">« Montant » vaut la somme engagée pour un achat, le produit estimé pour une vente, la valeur de la ligne pour une conservation ; le total exclut donc les ventes et donne le portefeuille après les ordres.${
      cy.sourceEntree === null ? "" : ` « Résultat » est calculé sur ${cy.sourceEntree === "execute" ? "tes <strong>prix d'exécution réels</strong>" : "les prix <strong>prescrits</strong> (aucune exécution rapportée)"}, hors dividendes.`}</p>
    ${alertes(cy)}
    <h2>Les candidats</h2>
    <p class="chapo">Les ${etat.regles.candidats_affiches_par_secteur} premiers de chaque secteur au ${jour(cy.signal)}, classés par momentum décroissant. Le plafond de ${cy.regles.plafond.n} par secteur retient les premiers.</p>
    ${tableauxCandidats(cy)}
    ${LEGENDE_CANDIDATS}
    ` : `<div class="vide"><b>Rien à acheter si le mois finissait ce soir.</b>${cy.marche.ticker} a passé la séance entière sous sa moyenne ${cy.marche.ma.slice(3)} jours : la stratégie serait en liquidités, les positions détenues vendues.</div>`}
    <p class="pied">Calculé le ${new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })} sur la clôture du ${jour(cy.signal)} · jeu de règles <span class="mono">${etat.regles.jeu}</span> · aucun cycle n'est inscrit dans <span class="mono">etat.json</span> · le rapport du mois, ci-dessous, reste celui du <strong>${jour(c.signal)}</strong>.</p>
  </div>
</section>`;

const html = `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Rapport duo ${moisLong(c.signal)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Source+Sans+3:wght@300;400;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
:root{
  --paper:#FCFCFD; --surface:#FFFFFF; --surface-2:#F4F6F9;
  --ink:#14161B; --ink-2:#565C69; --ink-3:#858C99;
  --rule:#E2E5EB; --rule-fort:#C6CBD5;
  --accent:#2B4A8B; --accent-doux:#EAEFF8; --accent-bord:#B9C8E4;
  --gain:#0B6E4F; --perte:#B02418; --attente:#8A5A00; --attente-doux:#FBF1DC;
}
@media (prefers-color-scheme: dark){ :root:not([data-theme="light"]){
  --paper:#101216; --surface:#161920; --surface-2:#1C2028;
  --ink:#E9EBF0; --ink-2:#98A0AE; --ink-3:#6C7482;
  --rule:#262A33; --rule-fort:#3A404C;
  --accent:#8AAAEC; --accent-doux:#1A2231; --accent-bord:#2E3D57;
  --gain:#4FC58C; --perte:#FF8272; --attente:#E0B060; --attente-doux:#2A2113; } }
:root[data-theme="dark"]{
  --paper:#101216; --surface:#161920; --surface-2:#1C2028;
  --ink:#E9EBF0; --ink-2:#98A0AE; --ink-3:#6C7482;
  --rule:#262A33; --rule-fort:#3A404C;
  --accent:#8AAAEC; --accent-doux:#1A2231; --accent-bord:#2E3D57;
  --gain:#4FC58C; --perte:#FF8272; --attente:#E0B060; --attente-doux:#2A2113; }
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font-family:"Source Sans 3","Helvetica Neue",Arial,sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
.env{max-width:1180px;margin:0 auto;padding:0 24px 96px}
@media (max-width:640px){.env{padding:0 14px 64px}}
header.tete{padding:34px 0 26px;border-bottom:2px solid var(--ink);display:flex;flex-direction:column;gap:12px}
.barre{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}
.oeil{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent);font-weight:500}
a.bouton{display:inline-flex;align-items:center;gap:8px;background:var(--accent);color:var(--paper);text-decoration:none;font-weight:600;font-size:.9rem;padding:9px 16px;border-radius:4px;border:1px solid var(--accent)}
a.bouton:hover{filter:brightness(1.1)}
h1{font-family:Newsreader,Georgia,serif;font-weight:500;font-size:clamp(1.9rem,5vw,3rem);line-height:1.05;margin:0;letter-spacing:-.015em;text-wrap:balance}
.sous{color:var(--ink-2);margin:0;max-width:64ch}
.interrupteur{display:flex;align-items:center;gap:14px;padding:14px 18px;border-radius:4px;border:1px solid;flex-wrap:wrap;font-size:.95rem;margin-top:4px}
.interrupteur.on{background:var(--accent-doux);border-color:var(--accent-bord)}
.interrupteur.off{background:var(--attente-doux);border-color:var(--attente)}
.interrupteur b{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase}
.interrupteur.on b{color:var(--accent)} .interrupteur.off b{color:var(--attente)}
.chiffres{display:grid;grid-template-columns:repeat(auto-fit,minmax(158px,1fr));gap:1px;background:var(--rule);border-bottom:1px solid var(--rule)}
.chiffre{padding:22px 14px;background:var(--paper);display:flex;flex-direction:column;align-items:flex-start}
.chiffre .etiq{display:block;font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink-3);margin-bottom:7px}
.chiffre .val{display:block;font-family:"IBM Plex Mono",monospace;font-weight:600;font-size:clamp(1.15rem,2.6vw,1.45rem);font-variant-numeric:tabular-nums;letter-spacing:-.02em}
.chiffre .note{display:block;font-size:.82rem;color:var(--ink-2);margin-top:4px}
section{padding:40px 0 8px;border-bottom:1px solid var(--rule)}
section:last-of-type{border-bottom:0}
h2{font-family:Newsreader,Georgia,serif;font-weight:600;font-size:clamp(1.35rem,3vw,1.8rem);margin:0 0 6px;letter-spacing:-.01em;text-wrap:balance}
h3{font-family:Newsreader,Georgia,serif;font-weight:600;font-size:1.1rem;margin:28px 0 8px}
.chapo{color:var(--ink-2);max-width:66ch;margin:0 0 20px}
p{max-width:68ch}
code,.mono{font-family:"IBM Plex Mono",monospace;font-size:.9em;font-variant-numeric:tabular-nums}
.cadre{overflow-x:auto;border:1px solid var(--rule);border-radius:4px;background:var(--surface);margin:16px 0}
table{border-collapse:collapse;width:100%;font-size:.87rem}
th,td{padding:7px 10px;text-align:right;white-space:nowrap;border-bottom:1px solid var(--rule)}
th{position:sticky;top:0;z-index:2;background:var(--surface-2);color:var(--ink-2);font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;font-weight:500;border-bottom:1px solid var(--rule-fort);user-select:none}
th.triable{cursor:pointer} th.triable:hover{color:var(--accent)}
th.actif{color:var(--accent)} th.actif::after{content:" ▾";font-size:8px} th.actif.asc::after{content:" ▴"}
td.g,th.g{text-align:left}
td.num{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
td.qte{font-weight:600;font-size:1.05em;background:var(--accent-doux)}
td.fort{font-weight:600}
td.min{color:var(--ink-3)}
tbody tr:hover td{background:var(--surface-2)}
tbody tr:last-child td{border-bottom:0}
tfoot td{border-top:2px solid var(--rule-fort);border-bottom:0;font-weight:600;background:var(--surface-2)}
.pos{color:var(--gain)} .neg{color:var(--perte)} .att{color:var(--attente)}
.tick{font-weight:600;font-family:"IBM Plex Mono",monospace}
.puce{display:inline-block;width:7px;height:7px;border-radius:50%;margin-right:7px;vertical-align:1px}
.puce.I{background:var(--accent)} .puce.T{background:var(--attente)}
.badge{display:inline-block;font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.07em;text-transform:uppercase;padding:1px 6px;border-radius:2px;border:1px solid currentColor;font-weight:500}
.badge.acheter{color:var(--gain)} .badge.conserver{color:var(--accent)} .badge.reserve{color:var(--attente)} .badge.recond{color:var(--ink-3)} .badge.neuf{color:var(--accent)} .badge.cash{color:var(--attente)}
tr.reserve td{color:var(--ink-2)}
tr.ligne-cash td{color:var(--ink-3);font-style:italic}
.vide{border:1px dashed var(--rule-fort);border-radius:4px;padding:26px 22px;color:var(--ink-2);background:var(--surface);margin:16px 0}
.vide b{color:var(--ink);display:block;margin-bottom:6px;font-family:Newsreader,Georgia,serif;font-size:1.05rem}
.encadre{background:var(--accent-doux);border:1px solid var(--accent-bord);border-radius:4px;padding:16px 20px;margin:18px 0}
.encadre p{margin:0 0 8px;max-width:70ch} .encadre p:last-child{margin:0}
.alerte{background:var(--attente-doux);border:1px solid var(--attente);border-radius:4px;padding:14px 18px;margin:16px 0;font-size:.92rem}
.onglets{display:flex;border:1px solid var(--rule-fort);border-radius:4px;overflow:hidden;width:fit-content;max-width:100%;flex-wrap:wrap;margin:20px 0 12px}
.onglets button{font-family:"Source Sans 3",sans-serif;font-size:.88rem;font-weight:600;padding:8px 16px;background:var(--surface);color:var(--ink-2);border:0;border-right:1px solid var(--rule-fort);cursor:pointer}
.onglets button:last-child{border-right:0}
.onglets button[aria-selected="true"]{background:var(--accent);color:var(--paper)}
.onglets .n{font-family:"IBM Plex Mono",monospace;font-weight:400;font-size:.78em;opacity:.75;margin-left:6px}
.pagi{display:flex;gap:8px;align-items:center;justify-content:flex-end;margin:12px 0 0;font-size:.85rem;color:var(--ink-2);flex-wrap:wrap}
.pagi button{font-family:"IBM Plex Mono",monospace;font-size:.85rem;padding:5px 12px;cursor:pointer;background:var(--surface);color:var(--ink);border:1px solid var(--rule-fort);border-radius:3px}
.pagi button:disabled{opacity:.4;cursor:default}
.pagi span{font-family:"IBM Plex Mono",monospace;font-variant-numeric:tabular-nums}
.legende{display:flex;gap:18px;flex-wrap:wrap;font-size:.83rem;color:var(--ink-2);margin:14px 0 0}
.legende span{display:flex;align-items:center;gap:6px}
ul.notes{max-width:70ch;padding-left:20px;color:var(--ink-2)} ul.notes li{margin-bottom:9px} ul.notes b{color:var(--ink)}
footer{padding:32px 0 0;color:var(--ink-3);font-size:.85rem;border-top:1px solid var(--rule);margin-top:38px}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
/* Colonne Résultat et lignes de vente (#96). */
.badge.vendre{color:var(--perte)}
.marche{color:var(--ink-3);font-style:italic}
.achete{font-family:"IBM Plex Mono",monospace;font-size:9.5px;color:var(--ink-3)}
td.res{font-weight:600;line-height:1.25}
td.res .pct{font-size:.82em;font-weight:400}
/* Pied décomposé : un trait fort ouvre le pied, des traits fins séparent les groupes,
   la ligne de total se détache. */
tfoot tr + tr td{border-top:1px solid var(--rule)}
tfoot tr.total td{border-top:1px solid var(--rule-fort)}
tfoot .quoi{font-family:"IBM Plex Mono",monospace;font-size:9.5px;letter-spacing:.09em;
  text-transform:uppercase;font-weight:400;color:var(--ink-3);margin-left:12px}
/* Pré-rapport (#96) — encadré ambre, bandeau plein, titres italiques : les marqueurs
   sont sur le CONTENANT ; à l'intérieur, tout se lit comme le rapport. */
.preavis{border:2px solid var(--attente);border-radius:8px;margin:24px 0 8px;overflow:hidden;background:var(--surface);
  padding:0;border-bottom:2px solid var(--attente)} /* annule le padding et le filet des <section> : le bandeau colle au cadre */
.preavis .bandeau{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;
  background:var(--attente);color:var(--paper);padding:8px 20px}
.preavis .bandeau .etiq{font-family:"IBM Plex Mono",monospace;font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:600}
.preavis .bandeau .chip{font-family:"IBM Plex Mono",monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;
  border:1px solid currentColor;border-radius:2px;padding:1px 8px}
.preavis .dedans{padding:6px 20px 20px;background:linear-gradient(var(--attente-doux),var(--surface) 180px)}
@media (max-width:640px){.preavis .dedans{padding:6px 12px 16px}.preavis .bandeau{padding:8px 12px}}
.preavis h2{font-style:italic;color:var(--attente);margin-top:26px}
.preavis h2:first-of-type{margin-top:18px}
.preavis th{background:var(--attente-doux);color:var(--attente);border-bottom-color:var(--attente)}
.preavis .cadre{border-color:var(--rule-fort)}
.preavis td.qte{background:transparent;color:var(--attente)}
.preavis .interrupteur{margin:16px 0 4px}
.preavis .pied{max-width:none;margin:26px 0 0;padding-top:12px;border-top:1px solid var(--rule);color:var(--ink-3);font-size:.82rem}
</style>

<div class="env">

${blocInventaire}
${blocPreavis(p)}
<header class="tete">
  <div class="barre">
    <span class="oeil">TVLite · Rapport mensuel · duo industrie-techno</span>
    <a class="bouton" href="${TVLITE}" target="_blank" rel="noopener">Ouvrir TVLite&nbsp;→</a>
  </div>
  <h1>Signal du ${jour(c.signal)}</h1>
  <p class="sous">Lu à la clôture du ${jour(c.signal)}. Les ordres passent à l'ouverture de la séance suivante, <strong>${quand}</strong>.</p>
  ${blocInterrupteur(c, "Interrupteur", "on investit ce mois-ci", "liquidités — aucun achat ce mois-ci")}
</header>

<div class="chiffres">
  <div class="chiffre"><span class="etiq">Poche duo</span><span class="val">${eur(c.poche, 0)}&nbsp;$</span><span class="note">${c.regles.trier.selection.n} lignes de ${eur(c.ligne, 0)}&nbsp;$</span></div>
  <div class="chiffre"><span class="etiq">À engager</span><span class="val" style="color:var(--accent)">${eur(c.engage, 0)}&nbsp;$</span><span class="note">${achats.length} achat${achats.length > 1 ? "s" : ""}, ${reconduits.length} reconduit${reconduits.length > 1 ? "s" : ""}</span></div>
  <div class="chiffre"><span class="etiq">Liquidités après</span><span class="val">${eur(c.residuel, 0)}&nbsp;$</span><span class="note">${(c.residuel / c.poche * 100).toFixed(1).replace(".", ",")}&nbsp;% de la poche</span></div>
  <div class="chiffre"><span class="etiq">À vendre</span><span class="val">${c.sortants.length}</span><span class="note">${c.sortants.map((v) => v.ticker).join(" ") || "rien ne sort"}</span></div>
  <div class="chiffre"><span class="etiq">Univers</span><span class="val">${c.nEligibles}</span><span class="note">titres éligibles ce mois-ci</span></div>
</div>

<section>
  <h2>À faire ${c.marche.investi ? quand : "ce mois-ci"}</h2>
  ${c.marche.investi ? `
  <p class="chapo">Prix limite calculé à <strong>+${(c.marge * 100).toFixed(0)}&nbsp;%</strong> de la dernière clôture ; les ventes partent <strong>au marché</strong>. Dans un encan d'ouverture, une limite au-dessus du cours d'ouverture s'exécute <em>au cours d'ouverture</em> — la marge sert à entrer dans l'encan, pas à payer plus cher.</p>
  ${tableauOrdres(c)}
  <p style="font-size:.88rem;color:var(--ink-2)">« Montant » vaut la somme engagée pour un achat, le produit estimé pour une vente, la valeur de la ligne pour une conservation ; il suppose une exécution à la dernière clôture, quand « coût max » suppose une exécution au prix limite. Le prix réel sera celui de l'encan d'ouverture, entre les deux le plus souvent — <strong>ni l'un ni l'autre n'est une certitude</strong>.${
    c.sourceEntree === null ? "" : ` « Résultat » est calculé sur ${c.sourceEntree === "execute" ? "tes <strong>prix d'exécution réels</strong>" : "les prix <strong>prescrits</strong> (aucune exécution rapportée)"}, hors dividendes.`}</p>
  ${alertes(c)}
  ` : `<div class="vide"><b>Rien à acheter.</b>${c.marche.ticker} a passé la séance entière sous sa moyenne ${c.marche.ma.slice(3)} jours : la stratégie reste en liquidités jusqu'au prochain signal. Les positions détenues sont vendues, le produit ne va nulle part — il attend.</div>`}
</section>

${c.marche.investi ? `
<section>
  <h2>Les candidats</h2>
  <p class="chapo">Les ${etat.regles.candidats_affiches_par_secteur} premiers de chaque secteur, classés par momentum décroissant. Le plafond de ${c.regles.plafond.n} par secteur retient les premiers ; les suivants sont là pour que tu voies ce que la règle a écarté — et pour que tu puisses déroger en connaissance de cause.</p>
  ${tableauxCandidats(c)}
  ${LEGENDE_CANDIDATS}
</section>` : ""}

<section>
  <h2>Journal de mon investissement</h2>
  ${enCours ? "" : `<div class="vide"><b>Le premier cycle réel n'a pas encore eu lieu.</b>
  Cette section se remplira à partir du moment où tu auras passé tes premiers ordres : prix obtenus, quantités réelles, et l'écart entre ce que les règles disaient et ce que tu as fait. Tant qu'elle est vide, il n'y a rien à raconter — et c'est plus honnête que de la remplir avec du backtest.</div>`}
</section>

<section>
  <h2>Journal du backtest</h2>
  <p class="chapo">La référence historique, sur ${donnees.barres.length} mois — de ${moisLong(j.depuis + "-01")} à ${moisLong(j.jusqua + "-01")}. Même jeu de règles, ${eur(j.capital, 0)}&nbsp;$ au départ. Ce n'est pas ton argent : c'est ce que la stratégie aurait fait, pour que tu aies un repère quand un mois se passe mal. Hypothèse d'exécution&nbsp;: <strong>${
  j.differe === "cloture" ? "vendre d'abord" : j.differe === "lendemain" ? "achat au lendemain" : "même encan"
}</strong>${
  j.differe === "cloture" ? " — ventes à l'ouverture, achats nouveaux à la clôture de la même séance, comme dans tous les documents du dossier."
  : j.differe === "lendemain" ? " — les achats nouveaux attendent l'ouverture suivante."
  : " — ventes et achats dans le même encan d'ouverture. <b>Attention</b>&nbsp;: ce n'est pas l'hypothèse des documents du dossier."
}</p>
  <div class="chiffres" style="border-top:1px solid var(--rule)">
    <div class="chiffre"><span class="etiq">Départ</span><span class="val">${eur(j.capital, 0)}&nbsp;$</span><span class="note">${moisLong(j.depuis + "-01")}</span></div>
    <div class="chiffre"><span class="etiq">Arrivée</span><span class="val" style="color:var(--accent)">${eur(j.soldeFinal, 0)}&nbsp;$</span><span class="note">×${(j.soldeFinal / j.capital).toFixed(1).replace(".", ",")}</span></div>
    <div class="chiffre"><span class="etiq">Positions</span><span class="val">${j.positions.length}</span><span class="note">${j.positions.filter((p) => p.resultat > 0).length} gagnantes</span></div>
    <div class="chiffre"><span class="etiq">Mois investis</span><span class="val">${j.barres.filter((b) => b.investi).length}/${j.barres.length}</span><span class="note">${j.barres.filter((b) => !b.investi).length} en liquidités</span></div>
  </div>
  <div class="onglets" role="tablist">
    <button role="tab" data-vue="pos" aria-selected="true">Positions<span class="n">${j.positions.length}</span></button>
    <button role="tab" data-vue="mois" aria-selected="false">Mois par mois<span class="n">${j.barres.length}</span></button>
    <button role="tab" data-vue="lig" aria-selected="false">Ligne par ligne<span class="n">${j.lignes.length}</span></button>
  </div>
  <div class="cadre"><table id="tj"></table></div>
  <div class="pagi"><span id="info"></span>
    <button id="prem">‹‹</button><button id="prec">‹</button><button id="suiv">›</button><button id="dern">››</button></div>
</section>

<section>
  <h2>Comment lire ce rapport</h2>
  <ul class="notes">
    <li><b>Le signal se lit à la clôture, l'ordre passe à l'ouverture suivante.</b> Il y a une nuit entre les deux, parfois un week-end. Le prix que tu paieras n'est pas celui affiché ici — cet écart est compté dans tous les résultats du backtest, il n'est pas caché.</li>
    <li><b>Les quantités viennent de la dernière clôture connue</b>, parce que l'ouverture de demain n'existe pas encore. Si un titre ouvre nettement plus haut, tu achèteras un peu moins que la ligne visée. C'est sans conséquence : les dix lignes sont redimensionnées chaque mois de toute façon.</li>
    <li><b>Il n'y a ni stop ni objectif.</b> La stratégie ne sort pas sur un niveau de prix, elle sort au rebalancement suivant. Un stop a été mesuré et rejeté : il rendait la pire baisse plus profonde, pas moins.</li>
    <li><b>Tu peux déroger.</b> Les candidats en réserve sont là pour ça. Dis-le par écrit avec le motif, et il sera consigné — y compris les substitutions que tu envisages sans les faire. C'est comme ça qu'on saura un jour si tes lectures techniques valent la peine, sans qu'elles t'aient coûté un dollar.</li>
    <li><b>Le journal du backtest égale le moteur au centime</b> — écart maximal mesuré ${(j.ecartMax * 100).toExponential(1)} % sur ${donnees.barres.length} mois. Si ce nombre grimpe un jour, c'est que les deux modèles ont divergé et qu'il ne faut plus croire le journal.</li>
  </ul>
</section>

<footer>
  Généré le ${new Date().toLocaleDateString("fr-CA", { year: "numeric", month: "long", day: "numeric" })} ·
  jeu de règles <span class="mono">${etat.regles.jeu}</span> ·
  univers Industrials + Technology ·
  frais : commission 0 $ + fourchette de 2 pas de cotation ·
  ${conformite} ·
  ${inventaire ? `inventaire de l'univers du ${inventaire.date}${inventaire.manquantsDuo.length ? "" : " : complet"}` : "inventaire : aucun passage récent"} ·
  données Yahoo Finance via Supabase
</footer>
</div>

<script type="application/json" id="d">${JSON.stringify(donnees)}</script>
<script>
(function(){
const D=JSON.parse(document.getElementById("d").textContent);
const cad=(v,d)=>v.toLocaleString("fr-CA",{minimumFractionDigits:d===undefined?0:d,maximumFractionDigits:d===undefined?0:d});
const pct=(v,d)=>(v>=0?"+":"\\u2212")+Math.abs(v*100).toFixed(d===undefined?1:d).replace(".",",")+"\\u00A0%";
const px=v=>v.toLocaleString("fr-CA",{minimumFractionDigits:2,maximumFractionDigits:2});
const sgn=v=>v>0?"pos":v<0?"neg":"";
const jr=s=>s.slice(8,10)+"/"+s.slice(5,7)+"/"+s.slice(0,4);
const M=["janv","févr","mars","avr","mai","juin","juil","août","sept","oct","nov","déc"];
const mf=s=>M[+s.slice(5,7)-1]+" "+s.slice(0,4);
const solde=new Map(D.barres.map(b=>[b[2],b[6]]));
const dat=(sig,exe)=>'<span class="mono">'+jr(exe)+'</span><br><span class="mono" style="font-size:9.5px;color:var(--ink-3)">signal '+jr(sig).slice(0,5)+'</span>';
const V={
 pos:{l:D.positions,def:3,cols:[
  {t:"Titre",g:1,v:r=>'<i class="puce '+r[1]+'"></i><span class="tick">'+r[0]+'</span>',k:r=>r[0]},
  {t:"Acheté",v:r=>dat(r[2],r[3]),k:r=>r[3]},
  {t:"Prix",v:r=>px(r[4])+"\\u00A0$",k:r=>r[4]},
  {t:"Vendu",v:r=>dat(r[5],r[6]),k:r=>r[6]},
  {t:"Prix",v:r=>px(r[7])+"\\u00A0$",k:r=>r[7]},
  {t:"Mois",v:r=>r[8],k:r=>r[8]},
  {t:"Mise",v:r=>cad(r[9])+"\\u00A0$",k:r=>r[9]},
  {t:"Ajust.",v:r=>r[10]===0?'<span style="color:var(--ink-3)">—</span>':(r[10]>0?"+":"\\u2212")+cad(Math.abs(r[10]))+"\\u00A0$",k:r=>r[10]},
  {t:"Résultat",v:r=>'<span class="'+sgn(r[11])+'">'+(r[11]>=0?"+":"\\u2212")+cad(Math.abs(r[11]))+"\\u00A0$</span>",k:r=>r[11]},
  {t:"% du cours",v:r=>'<span class="'+sgn(r[12])+'">'+pct(r[12])+"</span>",k:r=>r[12]},
  {t:"Portefeuille",v:r=>cad(solde.get(r[5])??0)+"\\u00A0$",k:r=>solde.get(r[5])??0}]},
 mois:{l:D.barres,def:0,cls:r=>r[3]===0?"ligne-cash":"",cols:[
  {t:"Mois",g:1,v:r=>'<span class="tick">'+mf(r[0]+"-01")+"</span>",k:r=>r[0]},
  {t:"Signal",v:r=>jr(r[1]),k:r=>r[1]},
  {t:"État",g:1,v:r=>r[3]===1?r[4]+" lignes":'<i class="badge cash">liquidités</i>',k:r=>r[4]},
  {t:"Solde avant",v:r=>cad(r[5])+"\\u00A0$",k:r=>r[5]},
  {t:"Résultat",v:r=>{const x=r[6]-r[5];return '<span class="'+sgn(x)+'">'+(x>=0?"+":"\\u2212")+cad(Math.abs(x))+"\\u00A0$</span>";},k:r=>r[6]-r[5]},
  {t:"Rendement",v:r=>'<span class="'+sgn(r[7])+'">'+pct(r[7],2)+"</span>",k:r=>r[7]},
  {t:"Frais",v:r=>r[8]===0?'<span style="color:var(--ink-3)">—</span>':cad(r[8],2)+"\\u00A0$",k:r=>r[8]},
  {t:"Solde après",v:r=>cad(r[6])+"\\u00A0$",k:r=>r[6]}]},
 lig:{l:D.lignes,def:0,cols:[
  {t:"Mois",g:1,v:r=>'<span class="tick">'+mf(r[0]+"-01")+"</span>",k:r=>r[0]},
  {t:"Titre",g:1,v:r=>'<i class="puce '+r[2]+'"></i><span class="tick">'+r[1]+'</span>',k:r=>r[1]},
  {t:"",g:1,v:r=>r[11]?'<i class="badge neuf">neuf</i>':'<i class="badge recond">reconduit</i>',k:r=>r[11]},
  {t:"Acheté",v:r=>jr(r[3]),k:r=>r[3]},{t:"Prix",v:r=>px(r[4])+"\\u00A0$",k:r=>r[4]},
  {t:"Vendu",v:r=>jr(r[5]),k:r=>r[5]},{t:"Prix",v:r=>px(r[6])+"\\u00A0$",k:r=>r[6]},
  {t:"Mise",v:r=>cad(r[8])+"\\u00A0$",k:r=>r[8]},
  {t:"Frais",v:r=>r[9]?cad(r[9],2)+"\\u00A0$":'<span style="color:var(--ink-3)">—</span>',k:r=>r[9]},
  {t:"Résultat",v:r=>'<span class="'+sgn(r[10])+'">'+(r[10]>=0?"+":"\\u2212")+cad(Math.abs(r[10]))+"\\u00A0$</span>",k:r=>r[10]},
  {t:"% du cours",v:r=>'<span class="'+sgn(r[7])+'">'+pct(r[7])+"</span>",k:r=>r[7]}]}};
let vue="pos",col=null,asc=false,page=0;const PP=100;
const el=i=>document.getElementById(i);
function rendre(){
 const v=V[vue];const ic=col===null?v.def:col;const k=v.cols[ic].k;
 const r=v.l.slice().sort((a,b)=>{const x=k(a),y=k(b);return x===y?0:(x<y?-1:1)*(asc?1:-1);});
 const np=Math.max(1,Math.ceil(r.length/PP));if(page>=np)page=np-1;
 const d0=page*PP,tr=r.slice(d0,d0+PP);
 let h="<thead><tr>";v.cols.forEach((c,i)=>{h+='<th class="triable '+(c.g?"g":"")+' '+(i===ic?"actif "+(asc?"asc":""):"")+'" data-c="'+i+'">'+c.t+"</th>";});
 h+="</tr></thead><tbody>";
 for(const x of tr)h+='<tr class="'+(v.cls?v.cls(x):"")+'">'+v.cols.map(c=>'<td class="'+(c.g?"g":"num")+'">'+c.v(x)+"</td>").join("")+"</tr>";
 el("tj").innerHTML=h+"</tbody>";
 el("tj").querySelectorAll("th").forEach(th=>th.addEventListener("click",()=>{const i=+th.dataset.c;if(i===ic)asc=!asc;else{col=i;asc=false;}page=0;rendre();}));
 el("info").textContent=cad(d0+1)+"–"+cad(Math.min(d0+PP,r.length))+" sur "+cad(r.length)+" · page "+(page+1)+"/"+np;
 el("prem").disabled=el("prec").disabled=page===0;el("suiv").disabled=el("dern").disabled=page>=np-1;
}
document.querySelectorAll(".onglets button").forEach(b=>b.addEventListener("click",()=>{
 document.querySelectorAll(".onglets button").forEach(x=>x.setAttribute("aria-selected","false"));
 b.setAttribute("aria-selected","true");vue=b.dataset.vue;col=null;asc=false;page=0;rendre();}));
el("prem").addEventListener("click",()=>{page=0;rendre();});
el("prec").addEventListener("click",()=>{page--;rendre();});
el("suiv").addEventListener("click",()=>{page++;rendre();});
el("dern").addEventListener("click",()=>{page=1e9;rendre();});
rendre();
})();
</script>`;

// frontend/public/ est copié tel quel dans le build : le rapport est donc servi
// par le même déploiement GitHub Pages que TVLite, à /rapport.html — c'est
// l'adresse vers laquelle pointe le bouton de l'en-tête.
const sortie = values.sortie ?? RACINE + "frontend/public/rapport.html";
writeFileSync(sortie, html);
// Marqueurs du dernier publié : l'Action s'en sert pour ne committer que lorsque le
// signal CHANGE. Sans eux elle committerait tous les jours, la date de génération
// suffisant à faire varier le fichier. Le pré-rapport a le SIEN : `dernier-signal.txt`
// veut dire « dernière fin de mois publiée » et ne doit pas bouger pour une répétition.
// `--sortie` = répétition générale : on écrit la page demandée et RIEN d'autre. Sans
// ça, un essai à la main poserait le marqueur du jour et l'Action croirait le soir venu
// que le pré-rapport est déjà publié — elle se tairait.
const publication = values.sortie === undefined;
if (publication) {
  if (p) writeFileSync(RACINE + "portefeuille/dernier-preavis.txt", p.signal + "\n");
  else writeFileSync(RACINE + "portefeuille/dernier-signal.txt", c.signal + "\n");
}
// Métadonnée servie à côté du rapport (#90) : TVLite la lit pour allumer la pastille
// « nouveau rapport ». On expose la DATE DE SIGNAL, pas la date de génération : le site
// est redéployé à chaque commit, la pastille clignoterait sinon à chaque déploiement.
// `preavis` prend le pas côté client quand il est là : une répétition allume la
// pastille elle aussi, et le rapport du lendemain la rallume avec sa propre date.
if (publication) writeFileSync(
  RACINE + "frontend/public/rapport-meta.json",
  JSON.stringify(p ? { signal: c.signal, preavis: p.signal } : { signal: c.signal }) + "\n"
);

// --enregistrer : inscrire le cycle dans l'état. Réservé à la publication (l'Action) ;
// un `npm run rapport` lancé à la main ne touche à rien.
//
// `detenus` porte ce que les règles PRESCRIVENT. C'est ce qui sert de portefeuille
// précédent au mois suivant — sans quoi le rapport de septembre croirait qu'il
// part de zéro et remettrait tout à l'achat. Quand Jean rapporte ses exécutions
// réelles, `execute` est renseigné et prend le pas : c'est lui qui décide, pas la
// prescription.
if (values.enregistrer) {
  const e = JSON.parse(readFileSync(RACINE + "portefeuille/etat.json", "utf8"));
  const dejaLa = e.cycles.findIndex((x: { signal: string }) => x.signal === c.signal);
  const cycle = {
    signal: c.signal, execution: c.execution, publie: new Date().toISOString().slice(0, 10),
    investi: c.marche.investi, poche: Number(c.poche.toFixed(2)), ligne: Number(c.ligne.toFixed(2)),
    detenus: c.detenus, sortants: c.sortants,
    prescrit: c.ordres.map((o) => ({ ticker: o.ticker, action: o.action, quantite: o.quantite,
      cloture: Number(o.cloture.toFixed(4)), limite: o.limite, momentum: Number(o.momentum.toFixed(4)) })),
    execute: null,
  };
  if (dejaLa >= 0) e.cycles[dejaLa] = cycle; else e.cycles.push(cycle);
  e.maj = new Date().toISOString().slice(0, 10);
  writeFileSync(RACINE + "portefeuille/etat.json", JSON.stringify(e, null, 2) + "\n");
  console.log(` Cycle ${c.signal} inscrit dans portefeuille/etat.json`);
}
console.log(`\n Rapport du ${c.signal} → ${sortie}`);
console.log(` ${(html.length / 1024).toFixed(0)} Ko · ${c.ordres.length} ordres · ${c.sortants.length} vente(s) · ${j.positions.length} positions de backtest · interrupteur ${c.marche.investi ? "ON" : "OFF"}`);
if (p) console.log(` + pré-rapport du ${p.signal} : ${p.ordres.filter((o) => o.action === "acheter").length} achat(s), ${p.ordres.length - p.ordres.filter((o) => o.action === "acheter").length} reconduit(s), ${p.sortants.length} vente(s) · interrupteur ${p.marche.investi ? "ON" : "OFF"}`);
console.log("");
