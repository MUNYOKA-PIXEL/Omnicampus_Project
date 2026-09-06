drop policy if exists "Users can update their lost and found reports" on public.lost_found_items;

create policy "Owners and superadmins can update lost and found reports"
on public.lost_found_items for update to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'superadmin'))
with check (user_id = auth.uid() or public.has_role(auth.uid(), 'superadmin'));