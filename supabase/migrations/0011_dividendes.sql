-- Dividendes et cours ajusté (22/08/2026) — option B du chantier adj_close.
--
-- POURQUOI PAS UNE COLONNE `adj_close` DANS `bars` :
-- la remplir aurait exigé un UPDATE sur 2,9 M de lignes, soit ~420 Mo de versions
-- mortes. À 439 Mo sur un quota de 500, c'était le mur. On stocke donc les
-- ÉVÉNEMENTS (40 378 lignes, 3,4 Mo) et on reconstruit à la volée.
--
-- FIDÉLITÉ VÉRIFIÉE contre l'`adjclose` de Yahoo sur RY.TO (127 événements,
-- 1996 → 2026) : concordance exacte (0,0000 %) sur 126 d'entre eux.
-- Le seul écart (0,7271 % avant avril 2003) vient d'une INCOHÉRENCE DE YAHOO :
-- leur `adjclose` ignore le dividende du 2003-04-21 (0,215 $) qu'ils listent
-- pourtant dans leur propre flux. Notre reconstruction est donc au moins aussi
-- juste que la leur. Négligeable pour du momentum ou du RS.

create table if not exists public.dividends (
  ticker  text not null,
  ex_date date not null,
  amount  numeric not null,
  primary key (ticker, ex_date)
);

create table if not exists public.dividends_state (
  ticker    text primary key,
  loaded_at timestamptz,
  n_events  int,
  err       text
);

-- Cours ajusté des dividendes, reconstruit à la volée.
-- adj(t) = close(t) × Π (1 − montant_i / clôture de la veille de l'ex-date_i)
--          pour tous les dividendes dont l'ex-date est postérieure à t.
create or replace function public.adj_close(p_ticker text, p_date date)
returns numeric language sql stable as $$
  select b.close * exp(coalesce((
    select sum(ln(1 - d.amount / (
      select b2.close from public.bars b2
       where b2.ticker = d.ticker and b2.interval='1d' and b2.bar_date < d.ex_date
       order by b2.bar_date desc limit 1)))
    from public.dividends d
    where d.ticker = p_ticker and d.ex_date > p_date
      and (select b2.close from public.bars b2
            where b2.ticker = d.ticker and b2.interval='1d' and b2.bar_date < d.ex_date
            order by b2.bar_date desc limit 1) is not null
  ), 0))
  from public.bars b
  where b.ticker = p_ticker and b.interval='1d' and b.bar_date = p_date;
$$;

-- Chargement : load_dividends(ticker) pour un titre, load_dividends_run(lot) en rotation.
-- Résultat au 22/08/2026 : 907 titres, 0 erreur, 40 378 événements, 577 titres
-- versant un dividende. Base totale : 443,3 Mo.
