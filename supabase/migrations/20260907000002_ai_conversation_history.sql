create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  messages jsonb not null default '[]'::jsonb check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index ai_conversations_user_updated_idx
  on public.ai_conversations (user_id, updated_at desc);

alter table public.ai_conversations enable row level security;

create policy "Users can view their own AI conversations"
  on public.ai_conversations for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create their own AI conversations"
  on public.ai_conversations for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "Users can update their own AI conversations"
  on public.ai_conversations for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users can delete their own AI conversations"
  on public.ai_conversations for delete to authenticated
  using (user_id = (select auth.uid()));

grant select, insert, update, delete on public.ai_conversations to authenticated;

create or replace function public.touch_ai_conversation_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger touch_ai_conversation_updated_at_before_update
  before update on public.ai_conversations
  for each row execute function public.touch_ai_conversation_updated_at();

create or replace function public.prune_ai_conversations()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(new.user_id::text, 0));

  delete from public.ai_conversations
  where id in (
    select id
    from public.ai_conversations
    where user_id = new.user_id
    order by updated_at desc, id desc
    offset 50
  );
  return new;
end;
$$;

revoke all on function public.prune_ai_conversations() from public, anon, authenticated;

create trigger prune_ai_conversations_after_write
  after insert or update on public.ai_conversations
  for each row execute function public.prune_ai_conversations();
