insert into storage.buckets (id, name, public)
values ('profile-avatars', 'profile-avatars', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can view profile avatars" on storage.objects;
create policy "Authenticated users can view profile avatars"
on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars');

drop policy if exists "Users can upload profile avatars" on storage.objects;
create policy "Users can upload profile avatars"
on storage.objects for insert to authenticated
with check (bucket_id = 'profile-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Users can update profile avatars" on storage.objects;
create policy "Users can update profile avatars"
on storage.objects for update to authenticated
using (bucket_id = 'profile-avatars' and owner_id = auth.uid()::text)
with check (bucket_id = 'profile-avatars' and owner_id = auth.uid()::text);