-- Keep uploaded profile and lost-and-found media behind authenticated storage policies.
update storage.buckets
set public = false
where id in ('profile-avatars', 'lost-found-images');
