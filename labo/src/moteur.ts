// Le moteur : boucle de rebalancement mensuel, trois emplacements, zéro look-ahead.
//
// Conventions (identiques au protocole de référence, vérifiées contre ta_ca_mom) :
//  - date de rebalancement t = dernière séance du mois (sur l'union des dates de l'univers) ;
//  - le signal est lu sur la CLÔTURE de t ; l'exécution se fait à l'OUVERTURE de la
//    séance suivante DU TITRE (lead(open,1)) — achat après t, vente après t' (mois suivant) ;
//  - un titre sans barre à t' ou sans ouverture suivante est retiré du calcul du mois
//    (même convention que le protocole de référence — voir la critique dans le ticket) ;
//  - frais : 0,35 % aller-retour comptés à l'ENTRÉE d'un titre dans le portefeuille
//    (rotation réelle : un titre conservé d'un mois sur l'autre ne paie rien).
//
// DÉTENTION PLURI-MENSUELLE (detention_mois > 1) :
//  - la SÉLECTION est refaite tous les `detention_mois` mois ; la VALORISATION reste
//    mensuelle. Sans ça, les creux intra-trimestre sortiraient du calcul et la pire
//    baisse paraîtrait plus douce qu'elle ne l'est — on comparerait des courbes qui ne
//    se regardent pas au même rythme ;
//  - entre deux re-sélections les POIDS DÉRIVENT (vraie détention, pas de
//    ré-équipondération cachée) : le rendement du mois est la moyenne des rendements
//    pondérée par la valeur courante de chaque ligne ;
//  - `decalage` fixe le mois de départ du cycle. Avec 3 mois il existe 3 calendriers
//    possibles ; les comparer est le seul moyen de voir si un résultat tient à la
//    méthode ou au hasard de la date de départ.

import { dividendesEntre, type Dividendes, type Serie, type Univers } from "./data.ts";
import { colonne } from "./indicateurs.ts";
import { comparer, type JeuDeRegles, type Selection } from "./regles.ts";
import { grouper, secteurDe } from "./secteurs.ts";
import { serieDePorte } from "./etfSectoriels.ts";

export interface MoisResultat {
  reb: string; // date du signal (clôture)
  next: string; // fin de mois suivante (la vente s'exécute à l'ouverture qui la suit)
  nElig: number;
  nSel: number; // titres sélectionnés ET valorisables (achat + vente disponibles)
  retenus: string[];
  brut: number; // rendement moyen équipondéré, avant frais (0 si mois en cash)
  bench: number; // benchmark apparié : moyenne de l'univers ÉLIGIBLE, même fenêtre
  entrees: number;
  frais: number; // en fraction du portefeuille
  net: number;
  investi: boolean;
  stoppes: number; // titres sortis en cours de mois par le stop
}

export interface Trace {
  lignes: string[];
}

// Une ligne en cours de détention. `valeur` dérive avec le cours (poids réels) ;
// `sortie` est renseignée dès qu'un stop a coupé la ligne — elle reste alors en
// liquidités jusqu'à la re-sélection suivante.
interface Position {
  s: Serie;
  achatPrix: number;
  niveauStop: number; // NaN si aucun stop
  valeur: number;
  sortie: boolean;
  entree: boolean; // vraie le mois où la ligne est ACHETÉE (donc payante en frais et en délai)
}

interface Valorisation {
  achat: { date: string; prix: number };
  vente: { date: string; prix: number };
  stoppe: boolean;
  niveau: number; // niveau de stop retenu (NaN si aucun stop)
  ret: number; // rendement TOTAL (plus-value + dividendes détachés pendant la détention)
}

// Pas de cotation du TSX : un demi-cent sous 0,50 $, un cent au-delà. C'est le plus petit
// écart possible entre le prix acheteur et le prix vendeur — donc le plancher du coût d'un
// aller-retour, jamais facturé nulle part mais bien perdu dans le prix.
function pasDeCotation(prix: number): number {
  return prix < 0.5 ? 0.005 : 0.01;
}

// Coût d'un aller-retour sur une ligne, en fraction de la mise.
function coutEntree(regles: JeuDeRegles, prix: number): number {
  const f = regles.frais_fourchette;
  if (!f) return regles.frais_aller_retour;
  return f.commission + (f.ticks * pasDeCotation(prix)) / prix;
}

// Prix d'exécution effectifs. Sous le modèle « limite », on remplace le prix de
// l'encan par la limite elle-même : achat à clôture(signal) × (1 + marge), vente à
// clôture(fin de mois) × (1 − marge). La DATE d'exécution ne change pas — c'est le
// prix, et lui seul, qu'on rend pessimiste.
// Le benchmark apparié reste sur l'ouverture : il ne représente pas un portefeuille
// qu'on négocie, mais le rendement moyen des titres éligibles. Le pénaliser aussi
// masquerait précisément ce qu'on cherche à mesurer.
//
// ACHAT_DIFFERE — la contrainte de financement. Les ventes partent à l'ouverture ;
// tant que leur produit n'est pas disponible, un achat NOUVEAU ne peut pas partir.
// « cloture » le repousse à la clôture du même jour, « lendemain » à l'ouverture
// suivante. Une ligne RECONDUITE n'est pas vendue, donc pas décalée : c'est pourquoi
// le décalage ne s'applique qu'aux entrées — les mêmes lignes qui paient la fourchette.
// Si la séance du lendemain n'existe pas (dernière barre du titre), on garde le prix
// d'ouverture plutôt que d'écarter la ligne : la retirer changerait la composition du
// mois et les deux hypothèses ne seraient plus comparables.
function prixAchat(
  regles: JeuDeRegles,
  s: Serie,
  reb: string,
  entree: boolean,
): { date: string; prix: number } | null {
  const base = achatSuivant(s, reb);
  if (!base) return null;
  if (regles.execution?.modele === "limite") {
    const i = s.idx.get(reb);
    if (i !== undefined) return { date: base.date, prix: s.close[i] * (1 + regles.execution.marge) };
  }
  const differe = regles.execution?.achat_differe ?? "aucun";
  if (!entree || differe === "aucun") return base;
  const j = s.idx.get(base.date)!;
  if (differe === "cloture") return { date: base.date, prix: s.close[j] };
  return j + 1 < s.dates.length ? { date: s.dates[j + 1], prix: s.open[j + 1] } : base;
}
function prixVenteExec(regles: JeuDeRegles, s: Serie, next: string, base: number): number {
  if (regles.execution?.modele !== "limite" || !regles.execution.vente_penalisee) return base;
  const i = s.idx.get(next);
  return i === undefined ? base : s.close[i] * (1 - regles.execution.marge);
}

function taille(sel: Selection, n: number): number {
  switch (sel.type) {
    case "decile": {
      // ntile(10) de Postgres : les (n mod 10) premiers paquets reçoivent une unité de plus.
      const base = Math.floor(n / 10);
      return base + (sel.rang <= n % 10 ? 1 : 0);
    }
    case "topN":
      return Math.min(sel.n, n);
    case "fraction":
      return Math.max(1, Math.round(n * sel.part));
  }
}

function finsDeMois(univers: Univers): string[] {
  const parMois = new Map<string, string>();
  for (const s of univers.series) {
    for (const d of s.dates) {
      const mois = d.slice(0, 7);
      const courant = parMois.get(mois);
      if (!courant || d > courant) parMois.set(mois, d);
    }
  }
  return [...parMois.values()].sort();
}

// Ouverture de la séance suivant la date `d` pour ce titre (lead(open,1) sur SA série).
function achatSuivant(s: Serie, d: string): { date: string; prix: number } | null {
  const i = s.idx.get(d);
  if (i === undefined || i + 1 >= s.dates.length) return null;
  return { date: s.dates[i + 1], prix: s.open[i + 1] };
}

// Porte d'un secteur : ouverte si l'ETF qui le représente clôture au-dessus de sa
// moyenne à la date de signal. Moyenne non calculable (ETF trop jeune) → ouverte,
// faute de quoi on fermerait un secteur pour une raison qui n'est pas le marché.
function porteOuverte(secteur: string, reb: string, ma: string, refs: Map<string, Serie>): boolean {
  const s = serieDePorte(secteur, refs);
  if (!s) return true;
  let i = s.dates.length - 1;
  while (i >= 0 && s.dates[i] > reb) i--;
  if (i < 0) return true;
  const m = colonne(s, ma)[i];
  return Number.isNaN(m) ? true : s.close[i] > m;
}

function indicateurMarche(
  nom: string,
  refs: Map<string, Serie>,
  eligibles: { s: Serie; i: number }[],
  reb: string,
): number {
  // « <ticker>_pente_sma50_75 » : pente de la MM50 de la référence sur 75 séances.
  const pen = /^([a-z]+)_pente_sma50_75$/.exec(nom);
  if (pen) {
    const ref = refs.get(pen[1].toUpperCase() + ".TO");
    if (!ref) return NaN;
    let i = ref.dates.length - 1;
    while (i >= 0 && ref.dates[i] > reb) i--;
    return i < 0 ? NaN : colonne(ref, "pente_sma50_75")[i];
  }

  // « <ticker>_sous_sma50_depuis » : nb de séances consécutives sous la MM50 de la référence.
  const pers = /^([a-z]+)_sous_sma50_depuis$/.exec(nom);
  if (pers) {
    const ref = refs.get(pers[1].toUpperCase() + ".TO");
    if (!ref) return NaN;
    let i = ref.dates.length - 1;
    while (i >= 0 && ref.dates[i] > reb) i--;
    return i < 0 ? NaN : colonne(ref, "sous_sma50_depuis")[i];
  }

  // « <ticker>_jour_sous_sma<N> » : 1 si la DERNIÈRE séance ≤ signal s'est déroulée
  // entièrement sous la moyenne (ouverture ET clôture dessous), 0 sinon.
  // Demandé par Jean le 26/08 : une clôture isolée sous la moyenne — cassée en
  // séance puis aussitôt rachetée — ne devrait pas suffire à couper.
  const js = /^([a-z]+)_jour_sous_(sma\d+)$/.exec(nom);
  if (js) {
    const ref = refs.get(js[1].toUpperCase() + ".TO");
    if (!ref) return NaN;
    let i = ref.dates.length - 1;
    while (i >= 0 && ref.dates[i] > reb) i--;
    if (i < 0) return NaN;
    const m = colonne(ref, js[2])[i];
    if (Number.isNaN(m)) return NaN;
    return ref.open[i] < m && ref.close[i] < m ? 1 : 0;
  }

  // « <ticker>_mois_sous_sma<N> » et « <ticker>_moisfin_sous_sma<N> » : 1 si la
  // BOUGIE MENSUELLE du mois du signal s'est ouverte ET fermée sous la moyenne.
  // L'ouverture du mois = ouverture de la PREMIÈRE séance du mois civil ; la clôture
  // = clôture de la dernière (= reb). Les deux variantes diffèrent par la valeur de
  // moyenne opposée à l'ouverture : « mois » la lit au jour de l'ouverture (lecture
  // graphique : chaque point contre la moyenne du moment), « moisfin » la lit en fin
  // de mois (une seule valeur de moyenne pour toute la bougie).
  // Demandé par Jean le 26/08 : il avait pensé l'interrupteur en mensuel, pas en
  // journalier — ceci permet de mesurer l'écart entre les deux lectures.
  const ms = /^([a-z]+)_(mois|moisfin)_sous_(sma\d+)$/.exec(nom);
  if (ms) {
    const ref = refs.get(ms[1].toUpperCase() + ".TO");
    if (!ref) return NaN;
    let i = ref.dates.length - 1;
    while (i >= 0 && ref.dates[i] > reb) i--;
    if (i < 0) return NaN;
    const civil = ref.dates[i].slice(0, 7);
    let d = i;
    while (d - 1 >= 0 && ref.dates[d - 1].slice(0, 7) === civil) d--;
    const moy = colonne(ref, ms[3]);
    const mFin = moy[i];
    const mDeb = ms[2] === "moisfin" ? mFin : moy[d];
    if (Number.isNaN(mFin) || Number.isNaN(mDeb)) return NaN;
    return ref.open[d] < mDeb && ref.close[i] < mFin ? 1 : 0;
  }

  // « <ticker>_sur_sma<N> » : cours de la référence rapporté à sa moyenne N jours.
  // > 1 = au-dessus de sa moyenne.
  const m = /^([a-z]+)_sur_(sma\d+)$/.exec(nom);
  if (m) {
    const ref = refs.get(m[1].toUpperCase() + ".TO");
    if (!ref) return NaN;
    // dernière barre de la référence ≤ date de rebalancement (aucune donnée future)
    let i = ref.dates.length - 1;
    while (i >= 0 && ref.dates[i] > reb) i--;
    if (i < 0) return NaN;
    return ref.close[i] / colonne(ref, m[2])[i];
  }
  if (nom === "largeur_sma50") {
    if (eligibles.length === 0) return NaN;
    let dessus = 0;
    for (const { s, i } of eligibles) {
      if (s.close[i] > colonne(s, "sma50")[i]) dessus++;
    }
    return dessus / eligibles.length;
  }
  return NaN;
}

export function lancer(
  univers: Univers,
  regles: JeuDeRegles,
  refs: Map<string, Serie>,
  traceDate?: string,
  dividendes?: Dividendes,
  decalage = 0,
): { mois: MoisResultat[]; trace?: Trace } {
  const fins = finsDeMois(univers);
  const mois: MoisResultat[] = [];
  let trace: Trace | undefined;
  let precedents = new Set<string>(); // titres détenus le mois précédent
  let investiPrecedent = false;
  const detention = Math.max(1, regles.detention_mois);
  let portefeuille: Position[] = []; // lignes en cours (vide hors détention pluri-mensuelle)

  for (let k = 0; k + 1 < fins.length; k++) {
    const reb = fins[k];
    const next = fins[k + 1];
    const estReselection = (k - decalage) % detention === 0 || portefeuille.length === 0;

    // Portes sectorielles, évaluées une fois par mois (mémoïsées sur ce rebalancement).
    const memoPortes = new Map<string, boolean>();
    const ouvertes = (sec: string): boolean => {
      if (!regles.portes_secteur) return true;
      let v = memoPortes.get(sec);
      if (v === undefined) { v = porteOuverte(sec, reb, regles.portes_secteur.ma, refs); memoPortes.set(sec, v); }
      return v;
    };

    // 1) FILTRER — éligibilité titre par titre, à la clôture de reb.
    // `eligiblesBase` ne connaît QUE les filtres du jeu de règles : c'est lui qui sert de
    // benchmark apparié. Comparer la stratégie à un univers déjà purgé de ce qu'elle évite
    // reviendrait à la comparer à elle-même.
    const eligiblesBase: { s: Serie; i: number; cle: number }[] = [];
    for (const s of univers.series) {
      const i = s.idx.get(reb);
      if (i === undefined) continue;
      const cle = colonne(s, regles.trier.indicateur)[i];
      if (Number.isNaN(cle)) continue; // critère de tri indéfini → hors classement
      let ok = true;
      for (const c of regles.filtrer) {
        if (!comparer(colonne(s, c.indicateur)[i], c.op, c.valeur)) {
          ok = false;
          break;
        }
      }
      if (ok) eligiblesBase.push({ s, i, cle });
    }
    if (eligiblesBase.length === 0) continue;

    // Les portes en mode « reallouer » retirent des CANDIDATS, jamais du benchmark.
    const eligibles = regles.portes_secteur?.mode === "reallouer"
      ? eligiblesBase.filter((e) => ouvertes(secteurDe(e.s.ticker)))
      : eligiblesBase;

    // 2) TRIER — classement transversal, sélection.
    const sens = regles.trier.ordre === "desc" ? -1 : 1;
    eligibles.sort((a, b) => (a.cle === b.cle ? (a.s.ticker < b.s.ticker ? -1 : 1) : sens * (a.cle - b.cle)));
    const nSel = taille(regles.trier.selection, eligibles.length);
    const debut = regles.trier.selection.type === "decile"
      ? tailleCumulee(regles.trier.selection.rang, eligibles.length)
      : 0;
    // PLAFOND — on descend le classement en sautant les paniers pleins ; la taille du
    // portefeuille est préservée (la place libérée revient au titre suivant éligible).
    let selection: typeof eligibles;
    if (regles.plafond) {
      const compte = new Map<string, number>();
      selection = [];
      for (let r = debut; r < eligibles.length && selection.length < nSel; r++) {
        const cle = grouper(eligibles[r].s.ticker, regles.plafond.niveau);
        const n = compte.get(cle) ?? 0;
        if (n >= regles.plafond.n) continue;
        compte.set(cle, n + 1);
        selection.push(eligibles[r]);
      }
    } else {
      selection = eligibles.slice(debut, debut + nSel);
    }

    // 3) Valorisation : achat à l'ouverture suivant reb, vente à l'ouverture suivant next.
    // Valorisation d'une ligne. `avecStop` n'est vrai que pour le PORTEFEUILLE :
    // le benchmark apparié reste un achat-conservation du mois, sinon on comparerait
    // la stratégie à elle-même.
    const valorise = (e: { s: Serie; i: number }, avecStop = false): Valorisation | null => {
      const achat = achatSuivant(e.s, reb);
      if (!achat) return null;
      if (!e.s.idx.has(next)) return null; // pas de barre à la fin de mois suivante
      let vente = achatSuivant(e.s, next);
      if (!vente) return null;

      let stoppe = false;
      let niveau = NaN;
      if (avecStop && regles.stop) {
        const sigma = colonne(e.s, "vol20")[e.i]; // σ lue à la CLÔTURE du rebalancement
        if (sigma > 0) {
          niveau = achat.prix * (1 - regles.stop.k * sigma * Math.sqrt(21));
          const iA = e.s.idx.get(achat.date)!;
          const iN = e.s.idx.get(next)!;
          for (let i = iA; i <= iN; i++) {
            if (e.s.close[i] <= niveau) {
              // sortie à l'ouverture SUIVANT la clôture qui perce
              if (i + 1 < e.s.dates.length) {
                vente = { date: e.s.dates[i + 1], prix: e.s.open[i + 1] };
                stoppe = true;
              }
              break;
            }
          }
        }
      }

      const div = dividendes
        ? dividendesEntre(dividendes, e.s, achat.date, vente.date)
        : { somme: 0, ecartes: 0 };
      return { achat, vente, stoppe, niveau, ret: (vente.prix + div.somme) / achat.prix - 1 };
    };

    // Toutes les portes fermées : le mois compte, en liquidités. L'effacer reviendrait
    // à ne pas facturer la stratégie pour les périodes où elle ne joue pas.
    if (eligibles.length === 0) {
      const rets: number[] = [];
      for (const e of eligiblesBase) { const v = valorise(e); if (v) rets.push(v.ret); }
      if (rets.length > 0) {
        mois.push({ reb, next, nElig: eligiblesBase.length, nSel: 0, retenus: [],
          brut: 0, bench: moyenne(rets), entrees: 0, frais: 0, net: 0, investi: false, stoppes: 0 });
        portefeuille = [];
        precedents = new Set();
        investiPrecedent = false;
      }
      continue;
    }

    // 4) PORTEFEUILLE — re-sélection seulement les mois de rebalancement.
    if (estReselection) {
      const nouvelles: Position[] = [];
      for (const e of selection) {
        // Une ligne est une ENTRÉE si elle n'était pas détenue le mois précédent (ou si
        // le portefeuille était en liquidités). Même test que pour les frais : les deux
        // coûts frappent exactement les mêmes lignes.
        const entree = !investiPrecedent || !precedents.has(e.s.ticker);
        const achat = prixAchat(regles, e.s, reb, entree);
        if (!achat) continue;
        let niveauStop = NaN;
        if (regles.stop) {
          const sigma = colonne(e.s, "vol20")[e.i]; // σ lue à la CLÔTURE du signal
          if (sigma > 0) niveauStop = achat.prix * (1 - regles.stop.k * sigma * Math.sqrt(21));
        }
        nouvelles.push({ s: e.s, achatPrix: achat.prix, niveauStop, valeur: 1, sortie: false, entree });
      }
      portefeuille = nouvelles;
    }
    if (portefeuille.length === 0) continue;

    // 5) INTERRUPTEUR — le marché entier, oui/non pour ce mois.
    let investi = true;
    let valeurInterrupteur = NaN;
    if (regles.interrupteur) {
      valeurInterrupteur = indicateurMarche(regles.interrupteur.indicateur, refs, eligibles, reb);
      investi = comparer(valeurInterrupteur, regles.interrupteur.op, regles.interrupteur.valeur);
    }

    // 6) Valorisation du mois, ligne par ligne, POIDS DÉRIVANTS.
    //    Une ligne stoppée — ou passée en liquidités par `cash_sous` — rapporte 0
    //    jusqu'à la re-sélection suivante : elle n'est pas rachetée en cours de route.
    const retenus: { ticker: string; ret: number }[] = [];
    let stoppes = 0;
    let sommeValeur = 0;
    let sommePondere = 0;
    for (const p of portefeuille) {
      const debutMois = prixAchat(regles, p.s, reb, p.entree);
      if (!debutMois || !p.s.idx.has(next)) continue;
      const finBrut = achatSuivant(p.s, next);
      if (!finBrut) continue;
      const finMois = { date: finBrut.date, prix: prixVenteExec(regles, p.s, next, finBrut.prix) };

      // Mode « cash » : la ligne d'un secteur fermé ne rapporte rien ce mois-ci et
      // n'est pas remplacée — le portefeuille est partiellement investi.
      const secteurOuvert = regles.portes_secteur?.mode === "cash" ? ouvertes(secteurDe(p.s.ticker)) : true;
      let ret = 0;
      if (!p.sortie && investi && secteurOuvert) {
        let sortieDate = finMois.date;
        let sortiePrix = finMois.prix;

        // Passage en liquidités si le cours clôture sous sa moyenne (emplacement « cash_sous »).
        // Vérifié sur chaque clôture, sortie à l'ouverture suivante.
        const iA = p.s.idx.get(debutMois.date)!;
        const iN = p.s.idx.get(next)!;
        const colCash = regles.cash_sous ? colonne(p.s, regles.cash_sous) : null;
        for (let i = iA; i <= iN; i++) {
          const percheStop = !Number.isNaN(p.niveauStop) && p.s.close[i] <= p.niveauStop;
          const percheCash = colCash !== null && p.s.close[i] < colCash[i];
          if (percheStop || percheCash) {
            if (i + 1 < p.s.dates.length) {
              sortieDate = p.s.dates[i + 1];
              sortiePrix = p.s.open[i + 1];
              p.sortie = true;
              if (percheStop) stoppes++;
            }
            break;
          }
        }
        const div = dividendes ? dividendesEntre(dividendes, p.s, debutMois.date, sortieDate) : { somme: 0, ecartes: 0 };
        ret = (sortiePrix + div.somme) / debutMois.prix - 1;
      }

      sommeValeur += p.valeur;
      sommePondere += p.valeur * ret;
      p.valeur *= 1 + ret;
      p.entree = false; // le décalage de financement ne se paie qu'une fois, à l'achat
      retenus.push({ ticker: p.s.ticker, ret });
    }
    if (retenus.length === 0 || sommeValeur === 0) continue;

    const retsBench: number[] = [];
    for (const e of eligiblesBase) {
      const v = valorise(e);
      if (v) retsBench.push(v.ret);
    }
    if (retsBench.length === 0) continue;

    const brut = investi ? sommePondere / sommeValeur : 0;
    const bench = moyenne(retsBench);

    // 7) Frais sur la rotation réelle : chaque ENTRÉE paie l'aller-retour complet.
    // Le coût est lu LIGNE PAR LIGNE, au prix d'achat de chacune : sous le modèle
    // « fourchette », deux titres du même mois ne paient pas le même taux.
    const actuels = investi ? new Set(retenus.map((r) => r.ticker)) : new Set<string>();
    let entrees = 0;
    let cout = 0;
    if (investi && estReselection) {
      for (const p of portefeuille) {
        if (!actuels.has(p.s.ticker)) continue;
        if (investiPrecedent && precedents.has(p.s.ticker)) continue;
        entrees++;
        cout += coutEntree(regles, p.achatPrix);
      }
    }
    const frais = investi && retenus.length > 0 ? cout / retenus.length : 0;
    const net = brut - frais;

    mois.push({
      reb,
      next,
      nElig: eligiblesBase.length,
      nSel: retenus.length,
      retenus: investi ? retenus.map((r) => r.ticker) : [],
      brut,
      bench,
      entrees,
      frais,
      net,
      investi,
      stoppes: investi ? stoppes : 0,
    });
    precedents = actuels;
    investiPrecedent = investi;

    if (traceDate === reb) {
      trace = construireTrace(reb, next, regles, eligibles, selection, retenus, valorise, bench, investi, valeurInterrupteur, entrees, frais);
    }
  }
  return { mois, trace };
}

// Position de départ du décile r dans un classement de n titres (ntile Postgres).
function tailleCumulee(rang: number, n: number): number {
  const base = Math.floor(n / 10);
  const reste = n % 10;
  let debut = 0;
  for (let r = 1; r < rang; r++) debut += base + (r <= reste ? 1 : 0);
  return debut;
}

function moyenne(v: number[]): number {
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function construireTrace(
  reb: string,
  next: string,
  regles: JeuDeRegles,
  eligibles: { s: Serie; i: number; cle: number }[],
  selection: { s: Serie; i: number; cle: number }[],
  retenus: { ticker: string; ret: number }[],
  valorise: (e: { s: Serie; i: number }, avecStop?: boolean) => Valorisation | null,
  bench: number,
  investi: boolean,
  valeurInterrupteur: number,
  entrees: number,
  frais: number,
): Trace {
  const l: string[] = [];
  l.push(`TRACE du rebalancement ${reb} (vente après ${next})`);
  l.push(`  1. FILTRER  → ${eligibles.length} titres éligibles (signal lu à la CLÔTURE du ${reb})`);
  l.push(`  2. TRIER    → « ${regles.trier.indicateur} » ${regles.trier.ordre}, sélection ${JSON.stringify(regles.trier.selection)} → ${selection.length} titres`);
  for (const e of selection) {
    const v = valorise(e, true);
    if (v) {
      l.push(
        `     ${e.s.ticker.padEnd(10)} signal=${e.cle.toFixed(4)}  ACHAT ouverture ${v.achat.date} à ${v.achat.prix.toFixed(4)}  ` +
          (Number.isNaN(v.niveau) ? "" : `STOP ${v.niveau.toFixed(4)} `) +
          `VENTE ouverture ${v.vente.date} à ${v.vente.prix.toFixed(4)}${v.stoppe ? " [STOPPÉ]" : ""}  → ${(v.ret * 100).toFixed(2)} %`,
      );
    } else {
      l.push(`     ${e.s.ticker.padEnd(10)} signal=${e.cle.toFixed(4)}  — invalorisable (barre manquante) → retiré du mois`);
    }
  }
  if (regles.interrupteur) {
    l.push(`  3. INTERRUPTEUR → ${regles.interrupteur.indicateur} = ${valeurInterrupteur.toFixed(4)} ${regles.interrupteur.op} ${regles.interrupteur.valeur} → ${investi ? "ON (investi)" : "OFF (cash)"}`);
  } else {
    l.push(`  3. INTERRUPTEUR → aucun (toujours investi)`);
  }
  l.push(`  4. Rendement brut du mois : ${(moyenne(retenus.map((r) => r.ret)) * 100).toFixed(2)} % · benchmark apparié (${"moyenne de l'univers éligible"}) : ${(bench * 100).toFixed(2)} %`);
  l.push(`  5. Rotation : ${entrees} entrée(s) → frais ${(frais * 100).toFixed(3)} % du portefeuille`);
  l.push(`  Aucune donnée postérieure à ${reb} n'entre dans le signal ; l'exécution n'utilise que des ouvertures STRICTEMENT postérieures.`);
  return { lignes: l };
}
