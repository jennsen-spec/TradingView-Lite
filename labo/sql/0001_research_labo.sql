-- #50 Labo de mesure — schéma `research` (résultats) + RPC d'accès pour le CLI.
-- Additif uniquement : ne touche aucune table existante.
-- Appliqué au projet opérationnel (cucshrxmtwwizzzqthcj) le 2026-08-21.
--
-- Les tables sont minuscules (quelques Ko par jeu de règles). Le RPC refuse
-- d'écrire au-delà de 5 000 mesures — garde-fou de quota (base à ~334 Mo / 500).

create schema if not exists research;

create table if not exists research.rule_sets (
  id bigint generated always as identity primary key,
  nom text not null,
  version int not null,
  spec jsonb not null,
  created_at timestamptz not null default now(),
  unique (nom, version)
);

create table if not exists research.measurements (
  id bigint generated always as identity primary key,
  rule_set_id bigint not null references research.rule_sets (id),
  univers text not null check (univers in ('research', 'market')),
  periode text not null check (periode in ('selection', 'validation', 'total')),
  moteur text not null,
  metrics jsonb not null,
  run_at timestamptz not null default now(),
  unique (rule_set_id, univers, periode)
);

-- Journal des cartouches de validation : chaque regard sur 2016-2026 est un geste
-- explicite, journalisé et décompté.
create table if not exists research.validation_log (
  id bigint generated always as identity primary key,
  nom text not null,
  version int not null,
  note text,
  viewed_at timestamptz not null default now()
);

-- ————— RPC (SECURITY DEFINER : le schéma research n'est pas exposé à PostgREST) —————

-- (Une fonction labo_tickers a existé puis a été retirée : le count sur 1,6 M de
--  lignes dépassait le statement_timeout du rôle anon. Le CLI lit bars_coverage.)

create or replace function public.labo_save_run(
  p_nom text,
  p_version int,
  p_spec jsonb,
  p_univers text,
  p_moteur text,
  p_selection jsonb,
  p_validation jsonb,
  p_total jsonb
) returns jsonb
language plpgsql security definer
set search_path = research, public
as $$
declare
  v_id bigint;
  v_spec jsonb;
begin
  if coalesce(length(p_selection::text), 0) + coalesce(length(p_validation::text), 0)
     + coalesce(length(p_total::text), 0) > 300000 then
    raise exception 'garde-fou : métriques trop volumineuses';
  end if;
  if (select count(*) from research.measurements) >= 5000 then
    raise exception 'garde-fou : plus de 5000 mesures — faire le ménage avant d''écrire';
  end if;

  select id, spec into v_id, v_spec from research.rule_sets where nom = p_nom and version = p_version;
  if v_id is null then
    insert into research.rule_sets (nom, version, spec) values (p_nom, p_version, p_spec)
    returning id into v_id;
  elsif v_spec is distinct from p_spec then
    raise exception 'le jeu « % » v% existe déjà avec une spec différente — incrémente la version', p_nom, p_version;
  end if;

  insert into research.measurements (rule_set_id, univers, periode, moteur, metrics)
  values (v_id, p_univers, 'selection', p_moteur, p_selection),
         (v_id, p_univers, 'validation', p_moteur, p_validation),
         (v_id, p_univers, 'total', p_moteur, p_total)
  on conflict (rule_set_id, univers, periode)
  do update set metrics = excluded.metrics, moteur = excluded.moteur, run_at = now();

  return public.labo_compteurs(p_nom);
end
$$;

create or replace function public.labo_cartouche(p_nom text, p_version int, p_note text)
returns int
language plpgsql security definer
set search_path = research, public
as $$
declare v_n int;
begin
  if (select count(*) from research.validation_log) >= 10000 then
    raise exception 'garde-fou : journal de validation plein';
  end if;
  insert into research.validation_log (nom, version, note) values (p_nom, p_version, p_note);
  select count(*) into v_n from research.validation_log where nom = p_nom;
  return v_n;
end
$$;

create or replace function public.labo_compteurs(p_nom text)
returns jsonb
language sql stable security definer
set search_path = research, public
as $$
  select jsonb_build_object(
    'jeux', (select count(distinct nom) from research.rule_sets),
    'variantes', (select count(*) from research.rule_sets),
    'cartouches_total', (select count(*) from research.validation_log),
    'cartouches_jeu', (select count(*) from research.validation_log where nom = p_nom)
  )
$$;

grant execute on function public.labo_save_run(text, int, jsonb, text, text, jsonb, jsonb, jsonb) to anon, authenticated;
grant execute on function public.labo_cartouche(text, int, text) to anon, authenticated;
grant execute on function public.labo_compteurs(text) to anon, authenticated;
