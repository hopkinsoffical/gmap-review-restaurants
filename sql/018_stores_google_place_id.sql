-- Google Places resource id (e.g. ChIJ…) for this store row; optional.
alter table public.stores
  add column if not exists google_place_id text;

create index if not exists stores_google_place_id_idx
  on public.stores (google_place_id)
  where google_place_id is not null and trim(google_place_id) <> '';
