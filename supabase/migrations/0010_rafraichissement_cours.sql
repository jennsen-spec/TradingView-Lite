-- Rafraîchissement quotidien des cours (22/08/2026)
-- Remplace l'ancien `backfill-ca` coupé lors du nettoyage « une seule base » (#49).
-- Rotation : 200 titres par jour de bourse, les plus anciennement rafraîchis d'abord
-- → les ~900 titres y passent tous en ~5 jours ouvrables.

create table if not exists public.refresh_state (
  ticker       text primary key,
  last_refresh timestamptz,
  last_bar     date,
  err          text
);

create or replace function public.refresh_cours(p_batch int default 150, p_max_mb int default 480)
returns table(traites int, restants_du_cycle int, taille_mb int, alerte boolean)
language plpgsql as $$
declare r record; v_n int; v_mb int; v_cnt int := 0; v_alerte boolean := false;
begin
  insert into public.refresh_state(ticker)
  select distinct ticker from public.bars
  on conflict (ticker) do nothing;

  select (pg_database_size(current_database())/1024/1024)::int into v_mb;
  if v_mb >= p_max_mb then
    return query select 0, (select count(*)::int from public.refresh_state
                             where last_refresh is null or last_refresh < now() - interval '6 days'),
                        v_mb, true;
    return;
  end if;

  for r in
    select ticker from public.refresh_state
    order by last_refresh nulls first, ticker
    limit p_batch
  loop
    begin
      -- 1 an suffit : comble les trous sans rapatrier tout l'historique.
      -- Coût en espace nul (insertion `on conflict do nothing`).
      v_n := public.backfill_ticker(r.ticker, 1);
      update public.refresh_state
         set last_refresh = now(),
             last_bar = (select max(bar_date) from public.bars b where b.ticker = r.ticker),
             err = case when v_n < 0 then 'echec' else null end
       where ticker = r.ticker;
    exception when others then
      update public.refresh_state set last_refresh = now(), err = sqlerrm where ticker = r.ticker;
    end;
    v_cnt := v_cnt + 1;
    -- Alarme de taille : mesurée entre CHAQUE titre, pas seulement au début.
    select (pg_database_size(current_database())/1024/1024)::int into v_mb;
    if v_mb >= p_max_mb then v_alerte := true; exit; end if;
  end loop;

  return query select v_cnt,
                      (select count(*)::int from public.refresh_state
                        where last_refresh is null or last_refresh < now() - interval '6 days'),
                      v_mb, v_alerte;
end $$;

-- 22h UTC = 18h à Toronto, après la clôture. Jours de bourse seulement.
-- select cron.schedule('rafraichissement-cours', '0 22 * * 1-5', 'select public.refresh_cours(200, 480)');
