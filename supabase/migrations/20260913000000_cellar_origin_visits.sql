-- Cellar-origin tastings (#294): a bottle opened at home is not a winery visit.
-- cellarService.openBottle used to write place_type = 'winery' whenever the lot
-- carried a winery_id, so opening a bottle on the couch inflated "wineries
-- visited". Clear place_type on every visit that was created by an open-bottle
-- event, identified through cellar_consumptions.wine_id. Idempotent: rows that
-- are already null are not matched.
update public.visits v
   set place_type = null
  from public.wines w
  join public.cellar_consumptions c on c.wine_id = w.id
 where w.visit_id = v.id
   and v.place_type = 'winery';
