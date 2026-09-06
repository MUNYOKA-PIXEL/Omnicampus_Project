alter table public.lost_found_items
add column if not exists image_url text;

insert into storage.buckets (id, name, public)
values ('lost-found-images', 'lost-found-images', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can view lost found images" on storage.objects;
create policy "Authenticated users can view lost found images"
on storage.objects for select to authenticated
using (bucket_id = 'lost-found-images');

drop policy if exists "Users can upload lost found images" on storage.objects;
create policy "Users can upload lost found images"
on storage.objects for insert to authenticated
with check (bucket_id = 'lost-found-images' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can delete their lost found images" on storage.objects;
create policy "Users can delete their lost found images"
on storage.objects for delete to authenticated
using (bucket_id = 'lost-found-images' and owner_id = auth.uid()::text);