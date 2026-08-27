-- Rafraîchissement à 17 h ET (26/08/2026, demande de Jean)
--
-- Avant : cron « 0 22 * * 1-5 », soit 18 h à Toronto l'été et 17 h l'hiver — l'heure
-- locale dérivait d'une heure au changement d'heure, ce que personne n'avait voulu.
-- Après : deux passages (21 h et 22 h UTC) dont un seul travaille, celui qui tombe
-- sur 17 h heure de Toronto. L'heure locale est donc fixe toute l'année.
--
-- Deuxième correctif, indispensable au premier : `backfill_ticker` insérait en
-- « on conflict do nothing ». Une barre écrite trop tôt — donc incomplète — n'était
-- JAMAIS corrigée par la suite. Tant qu'on tournait deux heures après la clôture le
-- risque restait théorique ; à une heure il ne l'est plus. Les barres des 5 derniers
-- jours sont désormais réécrites à chaque passage : une barre partielle se répare
-- toute seule au passage suivant. L'historique ancien, lui, reste intouchable — c'est
-- ce qui protège les coupes de #58 (les ères « penny stock » de Yahoo qu'on a retirées).

create or replace function public.backfill_ticker(p_ticker text, p_years integer default 12)
returns integer language plpgsql as $function$
#variable_conflict use_variable
declare
  v_st int; v_body text; v_j jsonb; v_n int := 0;
  v_p1 bigint; v_p2 bigint; v_first date; v_last date;
begin
  v_p2 := extract(epoch from now())::bigint;
  v_p1 := v_p2 - (p_years::bigint * 31557600);

  begin
    select status, content into v_st, v_body from extensions.http_get(
      'https://query1.finance.yahoo.com/v8/finance/chart/' || p_ticker ||
      '?period1=' || v_p1 || '&period2=' || v_p2 || '&interval=1d');
  exception when others then
    insert into public.backfill_log(ticker,status,rows_added,err) values (p_ticker,-1,0,sqlerrm);
    return -1;
  end;

  if v_st <> 200 then
    insert into public.backfill_log(ticker,status,rows_added,err) values (p_ticker,v_st,0,'http status');
    return -1;
  end if;

  v_j := (v_body::jsonb) -> 'chart' -> 'result' -> 0;
  if v_j is null or v_j -> 'timestamp' is null then
    insert into public.backfill_log(ticker,status,rows_added,err) values (p_ticker,v_st,0,'pas de donnees');
    return 0;
  end if;

  with rows_in as (
    select (to_timestamp((ts.v #>> '{}')::bigint) at time zone 'America/Toronto')::date as r_date,
           (o.v  #>> '{}')::numeric r_open, (h.v #>> '{}')::numeric r_high,
           (lo.v #>> '{}')::numeric r_low, (c.v #>> '{}')::numeric r_close,
           coalesce((vo.v #>> '{}')::numeric, 0)::bigint r_vol
    from jsonb_array_elements(v_j->'timestamp') with ordinality ts(v,k)
    join jsonb_array_elements(v_j->'indicators'->'quote'->0->'open')   with ordinality o(v,k)  using (k)
    join jsonb_array_elements(v_j->'indicators'->'quote'->0->'high')   with ordinality h(v,k)  using (k)
    join jsonb_array_elements(v_j->'indicators'->'quote'->0->'low')    with ordinality lo(v,k) using (k)
    join jsonb_array_elements(v_j->'indicators'->'quote'->0->'close')  with ordinality c(v,k)  using (k)
    join jsonb_array_elements(v_j->'indicators'->'quote'->0->'volume') with ordinality vo(v,k) using (k)
    where c.v is not null and c.v <> 'null'::jsonb and o.v <> 'null'::jsonb
  ),
  ins as (
    insert into public.bars (ticker, interval, bar_date, open, high, low, close, volume)
    select p_ticker, '1d', r_date, r_open, r_high, r_low, r_close, r_vol from rows_in
    on conflict (ticker, interval, bar_date) do update
      set open = excluded.open, high = excluded.high, low = excluded.low,
          close = excluded.close, volume = excluded.volume
      where bars.bar_date >= current_date - 5
    returning bar_date
  )
  select count(*), min(bar_date), max(bar_date) into v_n, v_first, v_last from ins;

  insert into public.backfill_log(ticker,status,rows_added,first_bar,last_bar)
  values (p_ticker, v_st, v_n, v_first, v_last);
  return v_n;
end $function$;

-- Deux créneaux, un seul actif : celui qui tombe sur 17 h à Toronto.
select cron.unschedule('rafraichissement-cours');
select cron.schedule('rafraichissement-cours', '0 21,22 * * 1-5', $cron$
do $$ begin
  if extract(hour from now() at time zone 'America/Toronto') = 17 then
    perform public.refresh_cours(200, 400);
  end if;
end $$;
$cron$);
