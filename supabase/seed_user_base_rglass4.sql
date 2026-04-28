-- Seed base values for user rglass4@gmail.com from spreadsheet rows 3, 5, 10, 11.
-- Row mapping used:
--   row 11 -> base_pxp
--   row 3  -> base_hits
--   row 5  -> base_hr_season
--   row 10 -> base_k
--   row 5  -> base_hr_career (same row requested)
--
-- Safe to re-run: uses upsert on (user_id, team_id).

with target_user as (
  select id as user_id
  from auth.users
  where email = 'rglass4@gmail.com'
  limit 1
), src as (
  select * from (values
    ('TOR',28243,105,31,188,31),
    ('NYA',31436,171,35,77,35),
    ('BOS',31422,133,33,141,33),
    ('TB',25072,159,29,158,29),
    ('BAL',32012,171,61,130,61),
    ('CLE',31575,157,54,59,54),
    ('DET',35339,136,36,126,36),
    ('KC',28079,137,34,43,34),
    ('MIN',14570,107,24,49,24),
    ('CHA',11097,68,24,84,24),
    ('SEA',50490,188,70,164,70),
    ('HOU',71344,225,92,326,92),
    ('TEX',26673,182,64,74,64),
    ('OAK',25660,145,61,174,61),
    ('LAA',57545,240,62,54,62),
    ('PHI',29496,140,34,158,34),
    ('NYN',56375,227,107,72,107),
    ('MIA',19741,82,32,128,32),
    ('ATL',17685,108,36,71,36),
    ('WAS',29835,206,62,75,62),
    ('MIL',26796,103,32,144,32),
    ('CHN',22919,138,45,54,45),
    ('CIN',13680,78,30,93,30),
    ('STL',44569,221,71,90,71),
    ('PIT',33243,123,33,249,33),
    ('LAN',100000,242,138,225,138),
    ('SD',31907,133,29,257,29),
    ('SF',13515,91,16,64,16),
    ('ARI',59307,206,89,258,89),
    ('COL',39030,219,82,109,82)
  ) as t(abbr, base_pxp, base_hits, base_hr_season, base_k, base_hr_career)
)
insert into public.user_base_progress (
  user_id,
  team_id,
  base_pxp,
  base_hits,
  base_hr_season,
  base_k,
  base_hr_career
)
select
  u.user_id,
  teams.id,
  src.base_pxp,
  src.base_hits,
  src.base_hr_season,
  src.base_k,
  src.base_hr_career
from src
join public.teams on teams.abbr = src.abbr
cross join target_user u
on conflict (user_id, team_id) do update set
  base_pxp = excluded.base_pxp,
  base_hits = excluded.base_hits,
  base_hr_season = excluded.base_hr_season,
  base_k = excluded.base_k,
  base_hr_career = excluded.base_hr_career,
  updated_at = now();
