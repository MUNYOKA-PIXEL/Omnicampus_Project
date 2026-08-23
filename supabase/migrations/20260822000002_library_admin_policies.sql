create policy "Library admins can update book requests"
on public.book_requests
for update
to authenticated
using (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'))
with check (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'));
