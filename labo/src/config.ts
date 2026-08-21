// Labo de mesure (#50) — configuration.
// Les deux clés ci-dessous sont des clés *publishable* (déjà publiques : celle de
// l'opérationnel est dans frontend/.env.production commité). Lecture seule via RLS.

export const PROJETS = {
  // Projet RECHERCHE (Swing Mastery) : 106 titres CA, 2004→2026, prix ajustés dividendes+splits.
  research: {
    url: "https://bsmcshezaofompkrmqii.supabase.co",
    cle: "sb_publishable_XLDE-4aLIEBc3w2bGAQWJw_ZVnXcJgx",
  },
  // Projet OPÉRATIONNEL (TVLite) : pan-canadien, close Yahoo ajusté splits, PAS dividendes.
  operationnel: {
    url: "https://cucshrxmtwwizzzqthcj.supabase.co",
    cle: "sb_publishable_mbSe0WzTCQixT5Do_WILRg_U2F6DgTE",
  },
} as const;

// Découpage sélection / validation. La validation est MASQUÉE par défaut (cartouche).
export const FIN_SELECTION = "2015-12-31";

export const VERSION_MOTEUR = "0.1.0";

export const REPERTOIRE_CACHE = new URL("../.cache/", import.meta.url).pathname;
export const REPERTOIRE_RULESETS = new URL("../rulesets/", import.meta.url).pathname;
export const REPERTOIRE_FIXTURES = new URL("../fixtures/", import.meta.url).pathname;

// Tickers de référence absolue (chargés depuis le projet opérationnel).
export const TICKERS_REFERENCE = ["XIU.TO", "XWD.TO"] as const;
