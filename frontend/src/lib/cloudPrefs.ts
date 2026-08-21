// Synchronisation cloud des préférences (Supabase, app mono-utilisateur).
// Une ligne par clé localStorage. On hydrate localStorage depuis le cloud AU DÉMARRAGE
// (avant le montage React), puis on miroir chaque sauvegarde vers le cloud (débounce).
// Les composants continuent de lire/écrire localStorage de façon synchrone, sans changement.
//
// #48 — Réconciliation. Trois fuites corrigées :
//   1. `updated_at` était stocké mais jamais lu → aucune notion de « qui est le plus récent ».
//   2. Les effets de montage (`useEffect(() => save(x), [x])`) repoussaient l'état initial
//      vers le cloud à chaque démarrage : une écriture serveur était écrasée par un simple
//      rechargement, ou par un onglet resté ouvert avec un état périmé.
//   3. Les tableaux (collections, dessins) étaient remplacés en bloc → une entrée créée
//      côté serveur disparaissait. On fusionne désormais par `id`.

const PREFS_URL = "https://cucshrxmtwwizzzqthcj.supabase.co/functions/v1/tvlite-api/prefs";
const PREFS_KEY = "sb_publishable_mbSe0WzTCQixT5Do_WILRg_U2F6DgTE"; // clé publishable (publique)
const headers = { apikey: PREFS_KEY, "Content-Type": "application/json" };

// Seules les clés TVLite sont synchronisées.
const isSynced = (k: string) => k.startsWith("tvlike:");

// Clés dont la valeur est un tableau d'objets `{id}` → fusionnables entrée par entrée.
const isMergeable = (k: string) => k === "tvlike:collections" || k.startsWith("tvlike:drawings:");

// Méta locales. Préfixe volontairement HORS `tvlike:` → jamais synchronisées vers le cloud.
const TS_KEY = "tvlite__sync_ts";     // { clé: horodatage de la dernière écriture locale }
const SEEN_KEY = "tvlite__sync_seen"; // { clé: [ids déjà vus] } → distingue « créé ailleurs » de « supprimé ici »

type Remote = { id: string; value: string; updated_at?: string };

const readMap = (k: string): Record<string, string> => {
  try { const r = JSON.parse(localStorage.getItem(k) || "{}"); return r && typeof r === "object" ? r : {}; } catch { return {}; }
};
const writeMap = (k: string, m: unknown) => { try { localStorage.setItem(k, JSON.stringify(m)); } catch { /* quota */ } };

const readSeen = (): Record<string, string[]> => {
  try { const r = JSON.parse(localStorage.getItem(SEEN_KEY) || "{}"); return r && typeof r === "object" ? r : {}; } catch { return {}; }
};

// Valeur telle qu'on l'a reçue du cloud au démarrage → sert à ne PAS repousser un état inchangé.
const hydrated: Record<string, string> = {};

const idsOf = (json: string): string[] => {
  try { const a = JSON.parse(json); return Array.isArray(a) ? a.map((e) => e?.id).filter((x): x is string => typeof x === "string") : []; } catch { return []; }
};

// Marque une clé comme écrite localement à `iso`, et mémorise les `id` présents.
function stamp(key: string, value: string, iso: string) {
  const ts = readMap(TS_KEY); ts[key] = iso; writeMap(TS_KEY, ts);
  if (isMergeable(key)) { const seen = readSeen(); seen[key] = idsOf(value); writeMap(SEEN_KEY, seen); }
}

// Fusion par `id`. `base` est prioritaire ; on n'ajoute de `extra` que les entrées
// dont l'`id` n'a JAMAIS été vu localement — donc créées ailleurs, et non supprimées ici.
// C'est ce qui permet à une suppression volontaire de tenir (sinon l'entrée ressusciterait).
function mergeById(base: string, extra: string, seenIds: string[]): string {
  try {
    const b = JSON.parse(base), e = JSON.parse(extra);
    if (!Array.isArray(b) || !Array.isArray(e)) return base;
    const known = new Set(b.map((x) => x?.id));
    const seen = new Set(seenIds);
    const added = e.filter((x) => x && typeof x.id === "string" && !known.has(x.id) && !seen.has(x.id));
    return added.length ? JSON.stringify([...b, ...added]) : base;
  } catch {
    return base;
  }
}

async function fetchPrefs(signal?: AbortSignal, id?: string): Promise<Remote[]> {
  const url = `${PREFS_URL}?meta=1${id ? `&id=${encodeURIComponent(id)}` : ""}`;
  const res = await fetch(url, { headers, signal });
  if (!res.ok) return [];
  const body = await res.json();
  if (Array.isArray(body)) return body as Remote[];
  // Repli : ancienne forme {id: value} (fonction pas encore déployée) → pas d'horodatage.
  return Object.entries(body ?? {}).map(([k, v]) => ({ id: k, value: String(v) }));
}

// Démarrage : réconcilie cloud ↔ local. Échec/hors-ligne = on garde le local.
export async function hydrateFromCloud(timeoutMs = 2500): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const rows = await fetchPrefs(ctrl.signal);
    clearTimeout(t);

    const ts = readMap(TS_KEY);
    const seen = readSeen();

    for (const row of rows) {
      if (!isSynced(row.id) || typeof row.value !== "string") continue;
      const local = localStorage.getItem(row.id);

      // Rien en local → on adopte.
      if (local == null) {
        localStorage.setItem(row.id, row.value);
        stamp(row.id, row.value, row.updated_at ?? new Date().toISOString());
        hydrated[row.id] = row.value;
        continue;
      }

      // Le local a-t-il été écrit après la version distante ?
      const localTs = ts[row.id];
      const localIsNewer = !!localTs && !!row.updated_at && localTs > row.updated_at;

      // Le distant est plus récent → il gagne, mais on ne perd pas les entrées locales :
      // pour les clés fusionnables, on repart du distant et on y remet le local inconnu de lui.
      // Le local est plus récent → il gagne, mais on récupère quand même les entrées
      // créées ailleurs (c'est le cas du pipeline mensuel qui écrit pendant qu'un onglet est ouvert).
      const next = isMergeable(row.id)
        ? (localIsNewer
            ? mergeById(local, row.value, seen[row.id] ?? [])
            : mergeById(row.value, local, []))
        : (localIsNewer ? local : row.value);

      if (next !== local) localStorage.setItem(row.id, next);
      stamp(row.id, next, localIsNewer ? (localTs as string) : (row.updated_at ?? new Date().toISOString()));
      hydrated[row.id] = next;
    }
  } catch {
    /* timeout / hors-ligne → on garde le localStorage local */
  }
}

// Miroir d'une clé vers le cloud (débounce 800 ms par clé).
const timers: Record<string, ReturnType<typeof setTimeout>> = {};
export function syncToCloud(key: string): void {
  if (!isSynced(key)) return;
  clearTimeout(timers[key]);
  timers[key] = setTimeout(async () => {
    const value = localStorage.getItem(key);
    if (value == null) return;

    // Rien n'a changé depuis l'hydratation → ne pas repousser (c'est l'effet de montage
    // qui écrasait les écritures serveur). Voir fuite n°2 en tête de fichier.
    if (hydrated[key] === value) return;

    let out = value;
    try {
      // Fusionnable : on relit la version distante juste avant d'écrire, pour ne pas
      // effacer ce qu'un autre onglet — ou le pipeline — vient d'y créer.
      if (isMergeable(key)) {
        const [remote] = await fetchPrefs(undefined, key);
        if (remote?.value) {
          const merged = mergeById(out, remote.value, readSeen()[key] ?? []);
          if (merged !== out) { out = merged; localStorage.setItem(key, out); }
        }
      }
      await fetch(PREFS_URL, { method: "POST", headers, body: JSON.stringify({ id: key, value: out }) });
      hydrated[key] = out;
      stamp(key, out, new Date().toISOString());
    } catch {
      /* hors-ligne : le local fait foi, on repoussera à la prochaine écriture */
    }
  }, 800);
}
