-- CraftToolkit Supabase schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  username text not null,
  username_lower text generated always as (lower(username)) stored,
  password_hash text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint username_format check (username ~ '^[A-Za-z0-9_]{3,20}$'),
  constraint profiles_username_lower_unique unique (username_lower)
);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on public.sessions(user_id);
create index if not exists sessions_expiry_idx on public.sessions(expires_at);

create table if not exists public.templates (
  id text primary key,
  title text not null,
  description text not null,
  category text not null,
  dependencies text[] not null default '{}',
  versions text[] not null default '{}',
  code text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.saved_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 100),
  filename text not null check (filename ~ '^[A-Za-z0-9_-]{1,80}\.sk$'),
  code text not null check (char_length(code) <= 100000),
  source text not null default 'user' check (source in ('template','ai','user')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists saved_scripts_user_created_idx on public.saved_scripts(user_id, created_at desc);

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark','light')),
  updated_at timestamptz not null default now()
);

-- All tables use Worker service-role access only. Keep service role secret in Cloudflare.
-- RLS enabled as defense-in-depth. No anon/authenticated policies are intentionally defined.
alter table public.profiles enable row level security;
alter table public.sessions enable row level security;
alter table public.templates enable row level security;
alter table public.saved_scripts enable row level security;
alter table public.user_preferences enable row level security;

-- Starter template data is seeded by the Worker in this version; no public table access.
