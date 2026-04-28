-- Seed mission leader targets sourced from provided sheet screenshot.
-- You can rerun this safely.

with src as (
  select * from (values
    ('TOR',215,54,292,336),
    ('NYA',238,62,257,659),
    ('BOS',240,54,313,521),
    ('TB',198,46,252,261),
    ('BAL',257,53,232,431),
    ('CLE',233,52,348,337),
    ('DET',248,58,308,399),
    ('KC',230,48,244,317),
    ('MIN',239,49,313,559),
    ('CHA',224,49,274,448),
    ('SEA',262,60,308,417),
    ('HOU',225,47,326,449),
    ('TEX',221,57,301,372),
    ('OAK',253,58,349,363),
    ('LAA',240,47,383,404),
    ('PHI',254,58,319,548),
    ('NYN',227,53,289,264),
    ('MIA',221,59,253,267),
    ('ATL',237,54,417,733),
    ('WAS',206,46,305,284),
    ('MIL',219,50,264,352),
    ('CHN',229,66,314,545),
    ('CIN',230,52,274,389),
    ('STL',250,70,274,475),
    ('PIT',237,54,326,475),
    ('LAN',241,54,382,389),
    ('SD',220,50,257,167),
    ('SF',254,73,345,646),
    ('ARI',206,57,372,224),
    ('COL',219,49,230,369)
  ) as t(abbr, season_hits_target, season_hr_target, season_k_target, career_hr_target)
)
insert into public.mission_targets (
  team_id,
  season_hits_target,
  season_hr_target,
  season_k_target,
  career_hr_target
)
select
  teams.id,
  src.season_hits_target,
  src.season_hr_target,
  src.season_k_target,
  src.career_hr_target
from src
join public.teams on teams.abbr = src.abbr
on conflict (team_id) do update set
  season_hits_target = excluded.season_hits_target,
  season_hr_target = excluded.season_hr_target,
  season_k_target = excluded.season_k_target,
  career_hr_target = excluded.career_hr_target,
  updated_at = now();
