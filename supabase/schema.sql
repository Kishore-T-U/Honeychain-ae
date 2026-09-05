-- ============================================================
-- HoneyChain-AE — starter schema
-- Run this once in: Supabase dashboard -> SQL Editor -> New query
-- ============================================================

-- 1. Roles -----------------------------------------------------
create type public.user_role as enum (
  'beekeeper',
  'fpo_collector',
  'buyer_processor',
  'government',
  'consumer'
);

-- 2. Profiles ----------------------------------------------------
-- One row per auth user, holding which role they get in the app.
-- Created automatically by the trigger below whenever someone signs up.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  role public.user_role not null default 'consumer',
  organization text, -- e.g. FPO name, buyer company, hive apiary id
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can read their own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row on signup. Role defaults to 'consumer';
-- change it afterwards from the Supabase table editor while testing,
-- or build an admin screen for it later.
create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, new.raw_user_meta_data ->> 'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. Domain tables (stubs matching the HoneyChain-AE evidence model) ---
-- These are intentionally minimal so the dashboards have real data to
-- read/write against. Extend freely as the schema in the design doc
-- (HarvestTrust-Lite, Claim Engine, TAAC, etc.) gets implemented.

create table public.hive_evidence (
  id uuid primary key default gen_random_uuid(),
  apiary_id text not null,
  beekeeper_id uuid references public.profiles (id),
  temperature_c numeric,
  humidity_pct numeric,
  acoustic_risk_score numeric, -- 0-1, output of the ML disease-risk model
  sensor_ok boolean not null default true,
  recorded_at timestamptz not null default now()
);

create table public.harvest_events (
  id uuid primary key default gen_random_uuid(),
  apiary_id text not null,
  container_id text not null,
  measured_mass_kg numeric not null,
  operator_id uuid references public.profiles (id),
  fpo_collector_id uuid references public.profiles (id),
  recorded_at timestamptz not null default now()
);

create table public.claims (
  id uuid primary key default gen_random_uuid(),
  harvest_event_id uuid references public.harvest_events (id),
  claim_type text not null, -- e.g. 'origin', 'purity', 'no-blend'
  status text not null default 'pending', -- pending | supported | rejected
  evidence_summary text,
  reviewed_by uuid references public.profiles (id), -- buyer/government reviewer
  created_at timestamptz not null default now()
);

alter table public.hive_evidence enable row level security;
alter table public.harvest_events enable row level security;
alter table public.claims enable row level security;

-- Simple starting policies: any signed-in user can read; only the
-- owning beekeeper/collector can write their own rows. Tighten these
-- per-role once the real access rules are finalized.
create policy "Signed-in users can read hive evidence"
  on public.hive_evidence for select
  using (auth.role() = 'authenticated');

create policy "Beekeepers manage their own hive evidence"
  on public.hive_evidence for insert
  with check (auth.uid() = beekeeper_id);

create policy "Signed-in users can read harvest events"
  on public.harvest_events for select
  using (auth.role() = 'authenticated');

create policy "Signed-in users can read claims"
  on public.claims for select
  using (auth.role() = 'authenticated');
