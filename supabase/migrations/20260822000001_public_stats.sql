create or replace function public.get_public_stats()
returns table (
  books_available bigint,
  active_clubs bigint,
  items_recovered bigint,
  registered_students bigint
)
language sql
security definer
set search_path = public
as $$
  select
    (select count(*) from public.books where available = true),
    (select count(*) from public.clubs),
    (select count(*) from public.lost_found_items where status in ('claimed', 'resolved')),
    (select count(*) from public.profiles);
$$;

grant execute on function public.get_public_stats() to anon, authenticated;
