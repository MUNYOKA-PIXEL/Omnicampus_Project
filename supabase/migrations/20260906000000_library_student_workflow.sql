create or replace function public.borrow_book(book_id_input uuid)
returns public.book_loans
language plpgsql
security definer
set search_path = public
as $$
declare
  book public.books;
  loan public.book_loans;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to borrow a book';
  end if;

  if exists (
    select 1
    from public.book_loans
    where book_id = book_id_input
      and user_id = auth.uid()
      and returned_at is null
      and status in ('active', 'overdue')
  ) then
    raise exception 'You already have an active loan for this book';
  end if;

  update public.books
  set copies = copies - 1,
      available = copies - 1 > 0,
      updated_at = now()
  where id = book_id_input
    and copies > 0
  returning * into strict book;

  insert into public.book_loans (book_id, user_id, issue_date, due_date, status)
  values (book_id_input, auth.uid(), current_date, current_date + 14, 'active')
  returning * into loan;

  return loan;
exception
  when no_data_found then
    raise exception 'This book is currently unavailable';
end;
$$;

revoke all on function public.borrow_book(uuid) from public;
grant execute on function public.borrow_book(uuid) to authenticated;

create or replace function public.return_book(loan_id_input uuid)
returns public.book_loans
language plpgsql
security definer
set search_path = public
as $$
declare
  loan public.book_loans;
begin
  if not public.has_role(auth.uid(), 'libadmin')
     and not public.has_role(auth.uid(), 'superadmin') then
    raise exception 'Only library administrators can process returns';
  end if;

  update public.book_loans
  set returned_at = now(),
      status = 'returned'
  where id = loan_id_input
    and returned_at is null
  returning * into strict loan;

  update public.books
  set copies = copies + 1,
      available = true,
      updated_at = now()
  where id = loan.book_id;

  return loan;
exception
  when no_data_found then
    raise exception 'This loan is already returned or does not exist';
end;
$$;

revoke all on function public.return_book(uuid) from public;
grant execute on function public.return_book(uuid) to authenticated;

drop policy if exists "Users can manage their book requests" on public.book_requests;
drop policy if exists "Users can view their book requests" on public.book_requests;
drop policy if exists "Users can create their book requests" on public.book_requests;
drop policy if exists "Library admins can review book requests" on public.book_requests;
drop policy if exists "Library admins can update book requests" on public.book_requests;

create policy "Users can view their book requests"
on public.book_requests for select to authenticated
using (user_id = auth.uid());

create policy "Users can create their book requests"
on public.book_requests for insert to authenticated
with check (user_id = auth.uid());

create policy "Library admins can review book requests"
on public.book_requests for select to authenticated
using (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'));

create policy "Library admins can update book requests"
on public.book_requests for update to authenticated
using (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'))
with check (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'));

drop policy if exists "Club admins can view all memberships" on public.club_memberships;
create policy "Club admins can view all memberships"
on public.club_memberships for select to authenticated
using (public.has_role(auth.uid(), 'clubadmin') or public.has_role(auth.uid(), 'superadmin'));

drop policy if exists "Club admins can view all RSVPs" on public.event_rsvps;
create policy "Club admins can view all RSVPs"
on public.event_rsvps for select to authenticated
using (public.has_role(auth.uid(), 'clubadmin') or public.has_role(auth.uid(), 'superadmin'));