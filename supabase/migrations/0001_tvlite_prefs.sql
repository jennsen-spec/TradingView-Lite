-- Préférences TVLite (mono-utilisateur) synchronisées dans le cloud : indicateurs,
-- collections, thème, dessins, etc. `id` = clé localStorage ; `value` = valeur brute (opaque).
-- Appliquée sur le projet Supabase partagé cucshrxmtwwizzzqthcj.
create table if not exists public.tvlite_prefs (
  id         text primary key,
  value      text not null,
  updated_at timestamptz not null default now()
);
alter table public.tvlite_prefs enable row level security;
-- Lecture publique (app perso) ; écritures via service role (Edge Function tvlite-api).
create policy "tvlite_prefs read" on public.tvlite_prefs for select using (true);
