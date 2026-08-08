-- BRIDGE Worklog — Supabase schema.
-- Run in the Supabase SQL editor after creating a project.
-- Mirrors lib/types.ts. All tables are per-user with Row Level Security.

-- profiles (1 row per auth user)
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  profession text default '',
  role text default '',
  purpose text default '',
  created_at timestamptz not null default now()
);

create table if not exists public.work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  date date not null,
  title text default '',
  did text default '',
  problem text default '',
  devised text default '',
  decision text default '',
  people text default '',
  result text default '',
  learning text default '',
  next_action text default '',
  memo text default '',
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quick_memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  content text not null default '',
  tags text[] not null default '{}',
  converted_to_log_id uuid references public.work_logs (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default '',
  related_log_id uuid references public.work_logs (id) on delete set null,
  due_date date,
  status text not null default 'todo' check (status in ('todo','doing','done','hold')),
  memo text default '',
  done_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reflections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  period_type text not null check (period_type in ('week','month')),
  start_date date not null,
  end_date date not null,
  content jsonb not null default '{}',
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.career_outputs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  output_type text not null,
  source_log_ids uuid[] not null default '{}',
  content text not null default '',
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

-- Row Level Security: each user can only see/modify their own rows.
do $$
declare t text;
begin
  foreach t in array array['profiles','work_logs','quick_memos','tasks','reflections','career_outputs']
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- profiles policy keys on id; the rest key on user_id.
create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

do $$
declare t text;
begin
  foreach t in array array['work_logs','quick_memos','tasks','reflections','career_outputs']
  loop
    execute format(
      'create policy "own rows" on public.%I for all using (auth.uid() = user_id) with check (auth.uid() = user_id);',
      t
    );
  end loop;
end $$;
