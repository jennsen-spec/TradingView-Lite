// Synchronisation cloud des préférences (Supabase, app mono-utilisateur).
// Une ligne par clé localStorage. On hydrate localStorage depuis le cloud AU DÉMARRAGE
// (avant le montage React), puis on miroir chaque sauvegarde vers le cloud (débounce).
// Les composants continuent de lire/écrire localStorage de façon synchrone, sans changement.

const PREFS_URL = "https://cucshrxmtwwizzzqthcj.supabase.co/functions/v1/tvlite-api/prefs";
const PREFS_KEY = "sb_publishable_mbSe0WzTCQixT5Do_WILRg_U2F6DgTE"; // clé publishable (publique)
const headers = { apikey: PREFS_KEY, "Content-Type": "application/json" };

// Seules les clés TVLite sont synchronisées.
const isSynced = (k: string) => k.startsWith("tvlike:");

// Démarrage : récupère les prefs du cloud → localStorage. Échec/hors-ligne = on garde le local.
export async function hydrateFromCloud(timeoutMs = 2500): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(PREFS_URL, { headers, signal: ctrl.signal });
    clearTimeout(t);
    if (!res.ok) return;
    const prefs = (await res.json()) as Record<string, string>;
    for (const [k, v] of Object.entries(prefs)) {
      if (isSynced(k) && typeof v === "string") {
        try { localStorage.setItem(k, v); } catch { /* quota */ }
      }
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
  timers[key] = setTimeout(() => {
    const value = localStorage.getItem(key);
    if (value == null) return;
    fetch(PREFS_URL, { method: "POST", headers, body: JSON.stringify({ id: key, value }) }).catch(() => {});
  }, 800);
}
