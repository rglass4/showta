-- MLB The Show 26 Team Affinity Tracker schema
-- Run this in Supabase SQL editor.

create extension if not exists "uuid-ossp";

-- Profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Teams
create table if not exists public.teams (
  id bigint generated always as identity primary key,
  abbr text not null unique,
  name text not null,
  created_at timestamptz not null default now()
);

-- Mission targets per team.
create table if not exists public.mission_targets (
  team_id bigint primary key references public.teams(id) on delete cascade,
  pxp_7500 integer not null default 7500,
  pxp_25000 integer not null default 25000,
  pxp_50000 integer not null default 50000,
  pxp_75000 integer not null default 75000,
  pxp_100000 integer not null default 100000,
  season_hits_target integer not null,
  season_hr_target integer not null,
  season_k_target integer not null,
  career_hr_target integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- User editable base progress, used for corrections/snapshot imports.
create table if not exists public.user_base_progress (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id bigint not null references public.teams(id) on delete cascade,
  base_pxp integer not null default 0,
  base_hits integer not null default 0,
  base_hr_season integer not null default 0,
  base_k integer not null default 0,
  base_hr_career integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, team_id)
);

-- Lookup table for game modes and multipliers.
create table if not exists public.game_modes (
  code text primary key,
  label text not null,
  multiplier numeric(4,2) not null
);

-- Lookup table for difficulty and multipliers.
create table if not exists public.difficulties (
  code text primary key,
  label text not null,
  multiplier numeric(4,2) not null
);

-- Game header
create table if not exists public.games (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  played_at date not null default current_date,
  notes text,
  game_mode_code text not null references public.game_modes(code),
  difficulty_code text not null references public.difficulties(code),
  mode_multiplier numeric(4,2) not null,
  difficulty_multiplier numeric(4,2) not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One row per player card instance, including substitutions.
create table if not exists public.game_entries (
  id bigint generated always as identity primary key,
  game_id bigint not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  slot_type text not null check (slot_type in ('batter', 'pitcher')),
  slot_number integer not null,
  stint_number integer not null default 1,
  team_id bigint not null references public.teams(id),

  -- Hitter stats
  plate_appearances integer not null default 0,
  singles integer not null default 0,
  doubles integer not null default 0,
  triples integer not null default 0,
  home_runs integer not null default 0,
  rbi integer not null default 0,
  runs integer not null default 0,
  stolen_bases integer not null default 0,
  walks integer not null default 0,

  -- Pitcher stats
  innings_pitched numeric(4,1) not null default 0,
  pitcher_wins integer not null default 0,
  pitcher_strikeouts integer not null default 0,
  quality_starts integer not null default 0,
  saves integer not null default 0,
  holds integer not null default 0,
  complete_games integer not null default 0,
  shutouts integer not null default 0,

  raw_pxp integer not null default 0,
  final_pxp integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(game_id, slot_type, slot_number, stint_number)
);

create index if not exists idx_games_user_date on public.games(user_id, played_at desc);
create index if not exists idx_entries_game on public.game_entries(game_id);
create index if not exists idx_entries_user_team on public.game_entries(user_id, team_id);

-- Auto-update timestamp helper.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on public.profiles
for each row execute procedure public.set_updated_at();
create trigger trg_targets_updated before update on public.mission_targets
for each row execute procedure public.set_updated_at();
create trigger trg_base_updated before update on public.user_base_progress
for each row execute procedure public.set_updated_at();
create trigger trg_games_updated before update on public.games
for each row execute procedure public.set_updated_at();
create trigger trg_entries_updated before update on public.game_entries
for each row execute procedure public.set_updated_at();

-- Keep user_id on entries aligned with game owner.
create or replace function public.sync_entry_user_id()
returns trigger as $$
declare
  v_user_id uuid;
begin
  select user_id into v_user_id from public.games where id = new.game_id;
  new.user_id = v_user_id;
  return new;
end;
$$ language plpgsql;

create trigger trg_entries_sync_user before insert or update on public.game_entries
for each row execute procedure public.sync_entry_user_id();

-- Auto-create profile row.
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles(id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- Seed lookup values.
insert into public.game_modes (code, label, multiplier) values
  ('diamond_quest', 'Diamond Quest', 1.0),
  ('conquest', 'Conquest', 1.0),
  ('play_vs_cpu', 'Play vs CPU', 1.0),
  ('miniseasons', 'Miniseasons', 1.0),
  ('unranked_coop', 'Unranked Co-op', 1.0),
  ('ranked', 'Ranked', 1.5),
  ('events', 'Events', 1.5),
  ('battle_royale', 'Battle Royale', 1.5),
  ('ranked_coop', 'Ranked Co-Op', 1.5)
on conflict (code) do update set label = excluded.label, multiplier = excluded.multiplier;

insert into public.difficulties (code, label, multiplier) values
  ('rookie', 'Rookie', 1.0),
  ('veteran', 'Veteran', 1.3),
  ('all_star', 'All-Star', 1.8),
  ('hall_of_fame', 'Hall of Fame', 2.3),
  ('legend', 'Legend', 3.0),
  ('goat', 'Goat', 3.5)
on conflict (code) do update set label = excluded.label, multiplier = excluded.multiplier;

-- Team seeds.
insert into public.teams (abbr, name) values
  ('TOR', 'Toronto Blue Jays'),
  ('NYA', 'New York Yankees'),
  ('BOS', 'Boston Red Sox'),
  ('TB', 'Tampa Bay Rays'),
  ('BAL', 'Baltimore Orioles'),
  ('CLE', 'Cleveland Guardians'),
  ('DET', 'Detroit Tigers'),
  ('KC', 'Kansas City Royals'),
  ('MIN', 'Minnesota Twins'),
  ('CHA', 'Chicago White Sox'),
  ('SEA', 'Seattle Mariners'),
  ('HOU', 'Houston Astros'),
  ('TEX', 'Texas Rangers'),
  ('OAK', 'Athletics'),
  ('LAA', 'Los Angeles Angels'),
  ('PHI', 'Philadelphia Phillies'),
  ('NYN', 'New York Mets'),
  ('MIA', 'Miami Marlins'),
  ('ATL', 'Atlanta Braves'),
  ('WAS', 'Washington Nationals'),
  ('MIL', 'Milwaukee Brewers'),
  ('CHN', 'Chicago Cubs'),
  ('CIN', 'Cincinnati Reds'),
  ('STL', 'St. Louis Cardinals'),
  ('PIT', 'Pittsburgh Pirates'),
  ('LAN', 'Los Angeles Dodgers'),
  ('SD', 'San Diego Padres'),
  ('SF', 'San Francisco Giants'),
  ('ARI', 'Arizona Diamondbacks'),
  ('COL', 'Colorado Rockies')
on conflict (abbr) do nothing;

-- RLS
alter table public.profiles enable row level security;
alter table public.user_base_progress enable row level security;
alter table public.games enable row level security;
alter table public.game_entries enable row level security;

-- Read-only for shared lookup tables.
alter table public.teams enable row level security;
alter table public.mission_targets enable row level security;
alter table public.game_modes enable row level security;
alter table public.difficulties enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "base_select_own" on public.user_base_progress
for select using (auth.uid() = user_id);
create policy "base_insert_own" on public.user_base_progress
for insert with check (auth.uid() = user_id);
create policy "base_update_own" on public.user_base_progress
for update using (auth.uid() = user_id);
create policy "base_delete_own" on public.user_base_progress
for delete using (auth.uid() = user_id);

create policy "games_select_own" on public.games
for select using (auth.uid() = user_id);
create policy "games_insert_own" on public.games
for insert with check (auth.uid() = user_id);
create policy "games_update_own" on public.games
for update using (auth.uid() = user_id);
create policy "games_delete_own" on public.games
for delete using (auth.uid() = user_id);

create policy "entries_select_own" on public.game_entries
for select using (auth.uid() = user_id);
create policy "entries_insert_own" on public.game_entries
for insert with check (auth.uid() = user_id);
create policy "entries_update_own" on public.game_entries
for update using (auth.uid() = user_id);
create policy "entries_delete_own" on public.game_entries
for delete using (auth.uid() = user_id);

create policy "teams_read_all" on public.teams
for select using (true);
create policy "targets_read_all" on public.mission_targets
for select using (true);
create policy "modes_read_all" on public.game_modes
for select using (true);
create policy "difficulties_read_all" on public.difficulties
for select using (true);

-- Progress view (base + game logs)
create or replace view public.v_user_team_progress as
select
  u.user_id,
  t.id as team_id,
  t.abbr,
  t.name,
  coalesce(u.base_pxp, 0) + coalesce(g.sum_pxp, 0) as total_pxp,
  coalesce(u.base_hits, 0) + coalesce(g.sum_hits, 0) as total_hits,
  coalesce(u.base_hr_season, 0) + coalesce(g.sum_hr, 0) as total_hr_season,
  coalesce(u.base_k, 0) + coalesce(g.sum_k, 0) as total_k,
  coalesce(u.base_hr_career, 0) + coalesce(g.sum_hr, 0) as total_hr_career,
  mt.pxp_7500,
  mt.pxp_25000,
  mt.pxp_50000,
  mt.pxp_75000,
  mt.pxp_100000,
  mt.season_hits_target,
  mt.season_hr_target,
  mt.season_k_target,
  mt.career_hr_target
from public.teams t
join public.mission_targets mt on mt.team_id = t.id
left join public.user_base_progress u on u.team_id = t.id and u.user_id = auth.uid()
left join (
  select
    ge.user_id,
    ge.team_id,
    sum(ge.final_pxp)::integer as sum_pxp,
    sum(ge.singles + ge.doubles + ge.triples + ge.home_runs)::integer as sum_hits,
    sum(ge.home_runs)::integer as sum_hr,
    sum(ge.pitcher_strikeouts)::integer as sum_k
  from public.game_entries ge
  group by ge.user_id, ge.team_id
) g on g.team_id = t.id and g.user_id = auth.uid();

grant select on public.v_user_team_progress to authenticated;
