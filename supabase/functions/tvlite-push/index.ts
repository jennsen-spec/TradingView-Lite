// TVLite — notifications de publication du rapport (#92).
//
// Fonction SÉPARÉE de `tvlite-api` à dessein : celle-ci sert les graphiques, les cours
// et les préférences. Y greffer les routes push aurait fait porter à tout l'app le
// risque d'un déploiement raté. Ici, une panne n'affecte que les notifications.
//
// Routes (POST) :
//   /subscribe    — enregistre l'abonnement de cet appareil (ouvert, clé publishable)
//   /unsubscribe  — le retire
//   /send         — envoie à tous les abonnés ; réservé au cycle mensuel (PUSH_SEND_SECRET)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const supabase = SUPABASE_URL && SERVICE_KEY ? createClient(SUPABASE_URL, SERVICE_KEY) : null;

// `sub` VAPID = l'URL de l'app, pas un courriel : elle identifie l'émetteur auprès du
// service de poussée d'Apple, inutile d'y exposer une adresse personnelle.
const VAPID_SUBJECT = "https://jennsen-spec.github.io/TradingView-Lite/";
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") ?? "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") ?? "";

const cors: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-push-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

interface Abonnement { endpoint: string; p256dh: string; auth: string }

/** Envoie une notification à un abonnement. Renvoie le code HTTP du service de poussée. */
async function envoyer(sub: Abonnement, charge: string): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 500;
  try {
    const webpush = (await import("npm:web-push@3.6.7")).default;
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    const res = await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      charge,
      { TTL: 12 * 3600 },
    );
    return res.statusCode ?? 201;
  } catch (e) {
    // web-push lève sur 4xx/5xx en portant le code : c'est lui qui distingue un
    // abonnement expiré (410) d'une panne passagère.
    return (e as { statusCode?: number }).statusCode ?? 500;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "POST requis" }, 405);
  if (!supabase) return json({ error: "base indisponible" }, 503);

  const url = new URL(req.url);
  const body = await req.json().catch(() => null) as Record<string, unknown> | null;

  try {
    if (url.pathname.endsWith("/subscribe")) {
      const ep = body?.endpoint;
      const k = body?.keys as { p256dh?: string; auth?: string } | undefined;
      if (!ep || !k?.p256dh || !k?.auth) return json({ error: "abonnement incomplet" }, 400);
      await supabase.from("tvlite_push_subs").upsert(
        { endpoint: String(ep), p256dh: String(k.p256dh), auth: String(k.auth) },
        { onConflict: "endpoint" },
      );
      return json({ ok: true });
    }

    if (url.pathname.endsWith("/unsubscribe")) {
      if (!body?.endpoint) return json({ error: "endpoint requis" }, 400);
      await supabase.from("tvlite_push_subs").delete().eq("endpoint", String(body.endpoint));
      return json({ ok: true });
    }

    if (url.pathname.endsWith("/send")) {
      const secret = Deno.env.get("PUSH_SEND_SECRET") ?? "";
      if (!secret || req.headers.get("x-push-secret") !== secret) return json({ error: "non autorisé" }, 401);

      const { data: subs } = await supabase.from("tvlite_push_subs").select("endpoint,p256dh,auth");
      const charge = JSON.stringify({
        titre: (body?.titre as string) ?? "TVLite — nouveau rapport",
        // La notification s'affiche sur l'écran verrouillé : on s'en tient à la date.
        corps: (body?.corps as string) ?? "Le rapport mensuel est publié.",
        signal: (body?.signal as string) ?? null,
      });

      let envoyees = 0, expirees = 0, echecs = 0;
      for (const s of (subs ?? []) as Abonnement[]) {
        const code = await envoyer(s, charge);
        if (code === 404 || code === 410) {
          // Abonnement mort (app désinstallée, permission révoquée) → on le retire,
          // sinon la table se remplit d'abonnements fantômes.
          await supabase.from("tvlite_push_subs").delete().eq("endpoint", s.endpoint);
          expirees++;
        } else if (code >= 200 && code < 300) envoyees++;
        else echecs++;
      }
      return json({ ok: true, envoyees, expirees, echecs, total: subs?.length ?? 0 });
    }

    return json({ error: "route inconnue" }, 404);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
