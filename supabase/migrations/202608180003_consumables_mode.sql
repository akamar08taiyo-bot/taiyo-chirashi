-- Consumables mode is stored inside flyers.editor_state JSONB so existing flyer rows remain compatible.
-- Only the searchable/admin category master needs one additional row.
insert into public.categories(organization_id,name,slug,sort_order)
select null,'消耗品','consumables',70
where not exists (
  select 1 from public.categories where organization_id is null and slug='consumables'
);
