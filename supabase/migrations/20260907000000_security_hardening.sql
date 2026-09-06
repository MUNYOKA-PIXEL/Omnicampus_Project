-- Restrict appointment lifecycle changes and enforce booking invariants.
drop policy if exists "Users can manage their appointments" on public.appointments;
drop policy if exists "Medical admins can manage appointments" on public.appointments;

create policy "Users can view their appointments"
on public.appointments for select to authenticated
using (user_id = auth.uid() or public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin'));

create policy "Users can create pending appointments"
on public.appointments for insert to authenticated
with check (user_id = auth.uid() and status = 'pending');

create policy "Users can cancel their appointments"
on public.appointments for update to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid() and status = 'cancelled');

create policy "Medical admins can manage appointments"
on public.appointments for all to authenticated
using (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin'))
with check (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin'));

create or replace function public.validate_appointment_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.date < current_date then
      raise exception 'Appointments must be booked for today or a future date';
    end if;

    if not exists (select 1 from public.doctors where id = new.doctor_id and available = true) then
      raise exception 'The selected doctor is not currently available';
    end if;

    if exists (
      select 1 from public.appointments
      where doctor_id = new.doctor_id
        and date = new.date
        and time = new.time
        and status in ('pending', 'confirmed')
    ) then
      raise exception 'That doctor already has an appointment at this time';
    end if;
  elsif tg_op = 'UPDATE'
    and not (public.has_role(auth.uid(), 'medadmin') or public.has_role(auth.uid(), 'superadmin')) then
    if new.user_id <> old.user_id
       or new.doctor_id <> old.doctor_id
       or new.date <> old.date
       or new.time <> old.time
       or new.reason is distinct from old.reason
       or new.status <> 'cancelled' then
      raise exception 'Students may only cancel their own appointments';
    end if;
  end if;

  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists validate_appointment_change on public.appointments;
create trigger validate_appointment_change
before insert or update on public.appointments
for each row execute procedure public.validate_appointment_change();

-- Preserve academic registration metadata when email confirmation delays profile creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, full_name, student_id, phone, email, academic_level, course, year_of_study
  )
  values (
    new.id,
    new.raw_user_meta_data ->> 'full_name',
    new.raw_user_meta_data ->> 'student_id',
    new.raw_user_meta_data ->> 'phone',
    new.email,
    new.raw_user_meta_data ->> 'academic_level',
    new.raw_user_meta_data ->> 'course',
    case
      when new.raw_user_meta_data ->> 'year_of_study' ~ '^[0-9]+$'
        then (new.raw_user_meta_data ->> 'year_of_study')::integer
      else null
    end
  )
  on conflict (id) do update set
    full_name = excluded.full_name,
    student_id = excluded.student_id,
    phone = excluded.phone,
    email = excluded.email,
    academic_level = excluded.academic_level,
    course = excluded.course,
    year_of_study = excluded.year_of_study;

  insert into public.user_roles (user_id, role)
  values (new.id, 'student')
  on conflict (user_id, role) do nothing;

  return new;
end;
$$;

create index if not exists appointments_doctor_slot_idx
on public.appointments(doctor_id, date, time)
where status in ('pending', 'confirmed');
