create type public.app_role as enum ('superadmin', 'libadmin', 'medadmin', 'clubadmin', 'student');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  student_id text unique,
  avatar_url text,
  course text,
  year_of_study integer,
  email text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'student',
  unique (user_id, role)
);

create table public.books (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  author text not null,
  category text not null,
  cover_url text,
  copies integer not null default 1 check (copies >= 0),
  available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.book_loans (
  id uuid primary key default gen_random_uuid(),
  book_id uuid not null references public.books(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  issue_date date not null default current_date,
  due_date date not null,
  returned_at timestamptz,
  fine_amount numeric(10, 2) default 0 check (fine_amount >= 0),
  status text not null default 'active' check (status in ('active', 'returned', 'overdue')),
  created_at timestamptz not null default now()
);

create table public.book_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  author text,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now()
);

create table public.clubs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  icon text,
  dues text,
  meeting_day text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_memberships (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique (club_id, user_id)
);

create table public.club_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.clubs(id) on delete cascade,
  title text not null,
  description text,
  date date not null,
  time time,
  location text,
  created_at timestamptz not null default now()
);

create table public.event_rsvps (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.club_events(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  specialty text not null,
  languages text,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete restrict,
  date date not null,
  time time not null,
  reason text,
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medications (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null,
  price text not null,
  available boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.lost_found_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_name text not null,
  type text not null,
  description text,
  location text,
  date_reported date not null default current_date,
  status text not null default 'open' check (status in ('open', 'claimed', 'resolved')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.resources (
  id uuid primary key default gen_random_uuid(),
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  title text not null,
  category text not null default 'general',
  file_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  department text not null,
  credits integer not null check (credits > 0),
  created_at timestamptz not null default now()
);

create table public.ai_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

create or replace function public.is_any_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role in ('superadmin', 'libadmin', 'medadmin', 'clubadmin')
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, student_id, phone, email)
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'phone',
    new.email
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.books enable row level security;
alter table public.book_loans enable row level security;
alter table public.book_requests enable row level security;
alter table public.clubs enable row level security;
alter table public.club_memberships enable row level security;
alter table public.club_events enable row level security;
alter table public.event_rsvps enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.medications enable row level security;
alter table public.lost_found_items enable row level security;
alter table public.resources enable row level security;
alter table public.courses enable row level security;
alter table public.ai_audit_logs enable row level security;

create policy "Users can view their profile" on public.profiles for select to authenticated using (id = auth.uid() or public.is_any_admin(auth.uid()));
create policy "Users can update their profile" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Authenticated users can view roles" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_any_admin(auth.uid()));
create policy "Superadmins can manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'superadmin'));

create policy "Authenticated users can view books" on public.books for select to authenticated using (true);
create policy "Library admins can manage books" on public.books for all to authenticated using (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'));
create policy "Users can view their loans" on public.book_loans for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'));
create policy "Library admins can manage loans" on public.book_loans for all to authenticated using (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'));
create policy "Users can manage their book requests" on public.book_requests for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Library admins can review book requests" on public.book_requests for select to authenticated using (public.has_role(auth.uid(), 'libadmin') or public.has_role(auth.uid(), 'superadmin'));

create policy "Authenticated users can view clubs" on public.clubs for select to authenticated using (true);
create policy "Club admins can manage clubs" on public.clubs for all to authenticated using (public.has_role(auth.uid(), 'clubadmin') or public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'clubadmin') or public.has_role(auth.uid(), 'superadmin'));
create policy "Authenticated users can view events" on public.club_events for select to authenticated using (true);
create policy "Club admins can manage events" on public.club_events for all to authenticated using (public.has_role(auth.uid(), 'clubadmin') or public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'clubadmin') or public.has_role(auth.uid(), 'superadmin'));
create policy "Users can manage their memberships" on public.club_memberships for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Users can manage their RSVPs" on public.event_rsvps for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "Authenticated users can view doctors" on public.doctors for select to authenticated using (true);
create policy "Medical admins can manage doctors" on public.doctors for all to authenticated using (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin'));
create policy "Authenticated users can view medications" on public.medications for select to authenticated using (true);
create policy "Medical admins can manage medications" on public.medications for all to authenticated using (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin'));
create policy "Users can manage their appointments" on public.appointments for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Medical admins can manage appointments" on public.appointments for all to authenticated using (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin')) with check (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin'));

create policy "Authenticated users can view lost and found" on public.lost_found_items for select to authenticated using (true);
create policy "Users can manage their lost and found reports" on public.lost_found_items for insert to authenticated with check (user_id = auth.uid());
create policy "Users can update their lost and found reports" on public.lost_found_items for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Authenticated users can view resources" on public.resources for select to authenticated using (true);
create policy "Admins can manage resources" on public.resources for all to authenticated using (public.is_any_admin(auth.uid())) with check (public.is_any_admin(auth.uid()));
create policy "Authenticated users can view courses" on public.courses for select to authenticated using (true);
create policy "Admins can manage courses" on public.courses for all to authenticated using (public.is_any_admin(auth.uid())) with check (public.is_any_admin(auth.uid()));
create policy "Users can create their audit logs" on public.ai_audit_logs for insert to authenticated with check (user_id = auth.uid() or user_id is null);
create policy "Admins can view audit logs" on public.ai_audit_logs for select to authenticated using (public.is_any_admin(auth.uid()));

create index book_loans_user_id_idx on public.book_loans(user_id);
create index appointments_user_id_idx on public.appointments(user_id);
create index club_memberships_user_id_idx on public.club_memberships(user_id);
create index lost_found_items_status_idx on public.lost_found_items(status);
