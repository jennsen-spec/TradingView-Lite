// Notifications de publication du rapport (#92).
// Web Push n'existe sur iPhone que pour une app INSTALLÉE sur l'écran d'accueil (iOS 16.4+),
// et la permission doit être demandée depuis un geste de Jean — d'où l'entrée dans le menu ⋯.

// Fonction Edge dédiée (séparée de tvlite-api : une panne des notifications ne doit
// pas pouvoir emporter les graphiques et les cours).
const API = "https://cucshrxmtwwizzzqthcj.supabase.co/functions/v1/tvlite-push";
const APIKEY = "sb_publishable_mbSe0WzTCQixT5Do_WILRg_U2F6DgTE";
const VAPID_PUBLIC = "BOAuBDN-f3IY-MkGWn9MVMxs05BWcsNNK6X68b67fZaSJgsCpvFQp-A-R5gNzZtUIMWF4d2xZRkzZZnR3broLag";

export type EtatPush = "indisponible" | "refusee" | "inactive" | "active";

const b64ToU8 = (b64: string): Uint8Array => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const supporte = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Enregistre le worker de notification. Sans gestionnaire `fetch` : rien n'est mis en cache. */
export async function enregistrerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!supporte()) return null;
  try {
    return await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL,
    });
  } catch {
    return null;
  }
}

export async function etatPush(): Promise<EtatPush> {
  if (!supporte()) return "indisponible";
  if (Notification.permission === "denied") return "refusee";
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "active" : "inactive";
}

/** Demande la permission puis abonne l'appareil. À appeler depuis un geste utilisateur. */
export async function activerPush(): Promise<EtatPush> {
  if (!supporte()) return "indisponible";
  if ((await Notification.requestPermission()) !== "granted") return "refusee";
  const reg = (await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL))
    ?? (await enregistrerWorker());
  if (!reg) return "indisponible";
  const sub = (await reg.pushManager.getSubscription())
    ?? (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: b64ToU8(VAPID_PUBLIC) as BufferSource,
    }));
  await fetch(`${API}/subscribe`, {
    method: "POST",
    headers: { apikey: APIKEY, "Content-Type": "application/json" },
    body: JSON.stringify(sub.toJSON()),
  });
  return "active";
}

export async function desactiverPush(): Promise<EtatPush> {
  const reg = await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL);
  const sub = await reg?.pushManager.getSubscription();
  if (sub) {
    await fetch(`${API}/unsubscribe`, {
      method: "POST",
      headers: { apikey: APIKEY, "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    }).catch(() => { /* on désabonne localement quoi qu'il arrive */ });
    await sub.unsubscribe();
  }
  return "inactive";
}

/** Éteint la pastille d'icône et ferme les bannières restantes (rapport consulté). */
export async function eteindreNotifications(): Promise<void> {
  try { await (navigator as Navigator & { clearAppBadge?: () => Promise<void> }).clearAppBadge?.(); } catch { /* non supporté */ }
  try {
    const reg = await navigator.serviceWorker?.getRegistration(import.meta.env.BASE_URL);
    for (const n of (await reg?.getNotifications({ tag: "rapport" })) ?? []) n.close();
  } catch { /* non supporté */ }
}
