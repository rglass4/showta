const { supabaseUrl, supabaseAnonKey } = window.APP_CONFIG || {};
if (!supabaseUrl || !supabaseAnonKey) {
  alert('Missing config.js. Copy config.example.js to config.js and set Supabase values.');
  throw new Error('Missing config');
}

const sb = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

const HITTER_WEIGHTS = { plate_appearances: 40, singles: 10, doubles: 15, triples: 30, home_runs: 40, rbi: 10, runs: 10, stolen_bases: 20, walks: 10 };
const PITCHER_WEIGHTS = { innings_pitched: 40, pitcher_wins: 20, pitcher_strikeouts: 10, quality_starts: 10, saves: 50, holds: 50, complete_games: 25, shutouts: 25 };

let teams = [];
let modes = [];
let difficulties = [];
let progressRows = [];
let entryRows = [];

const $ = (q) => document.querySelector(q);

let authUiRequestId = 0;

function setDashboardTitle(session) {
  const title = $('#dashboard-title');
  if (!title) return;
  const email = session?.user?.email;
  title.textContent = email ? `${email} Dashboard` : 'Dashboard';
}


function logDebug(event, payload = {}) {
  const ts = new Date().toISOString();
  const line = `[${ts}] ${event} ${JSON.stringify(payload)}`;
  const logEl = $('#debug-log');
  if (logEl) {
    logEl.textContent += `${line}\n`;
    logEl.scrollTop = logEl.scrollHeight;
  }
  console.debug('[TeamAffinity]', event, payload);
}

function setAuthMessage(message, isError = false) {
  const el = $('#auth-message');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('error', Boolean(message) && isError);
}


function showTab(id) {
  document.querySelectorAll('.tab').forEach((el) => el.classList.add('hidden'));
  $(`#${id}-tab`).classList.remove('hidden');
}

function rounding(num) { return Math.round(num); }

function defaultEntry(slotType, slotNumber, stintNumber = 1) {
  return {
    slot_type: slotType, slot_number: slotNumber, stint_number: stintNumber,
    team_id: teams[0]?.id ?? null,
    plate_appearances: 0, singles: 0, doubles: 0, triples: 0, home_runs: 0, rbi: 0, runs: 0, stolen_bases: 0, walks: 0,
    innings_pitched: 0, pitcher_wins: 0, pitcher_strikeouts: 0, quality_starts: 0, saves: 0, holds: 0, complete_games: 0, shutouts: 0,
    raw_pxp: 0, final_pxp: 0
  };
}

function calcRawPxp(row) {
  const hitter = Object.entries(HITTER_WEIGHTS).reduce((s, [k, v]) => s + Number(row[k] || 0) * v, 0);
  const pitcher = Object.entries(PITCHER_WEIGHTS).reduce((s, [k, v]) => s + Number(row[k] || 0) * v, 0);
  return hitter + pitcher;
}

function activeMultipliers() {
  const mCode = $('#mode-select').value;
  const dCode = $('#difficulty-select').value;
  const m = modes.find((x) => x.code === mCode)?.multiplier ?? 1;
  const d = difficulties.find((x) => x.code === dCode)?.multiplier ?? 1;
  return { mode: Number(m), diff: Number(d) };
}

function calcFinalPxp(row) {
  const { mode, diff } = activeMultipliers();
  return rounding(calcRawPxp(row) * mode * diff);
}

function buildDefaultEntries() {
  entryRows = [];
  for (let i = 1; i <= 9; i++) entryRows.push(defaultEntry('batter', i, 1));
  entryRows.push(defaultEntry('pitcher', 1, 1));
  renderEntryTable();
}

function createStatCell(rowIndex, key, step = 1) {
  const row = entryRows[rowIndex];
  const td = document.createElement('td');
  td.className = 'stat-cell';
  const minus = document.createElement('button'); minus.textContent = '-'; minus.className = 'small-btn';
  const value = document.createElement('span'); value.textContent = row[key];
  const plus = document.createElement('button'); plus.textContent = '+'; plus.className = 'small-btn';
  minus.onclick = () => { row[key] = Math.max(0, Number(row[key]) - step); renderEntryTable(); };
  plus.onclick = () => { row[key] = Number(row[key]) + step; renderEntryTable(); };
  td.append(minus, value, plus);
  return td;
}

function renderEntryTable() {
  const tbody = $('#entry-table tbody');
  tbody.innerHTML = '';

  entryRows.sort((a, b) => (a.slot_type.localeCompare(b.slot_type) || a.slot_number - b.slot_number || a.stint_number - b.stint_number));

  entryRows.forEach((row, idx) => {
    row.raw_pxp = calcRawPxp(row);
    row.final_pxp = calcFinalPxp(row);

    const tr = document.createElement('tr');
    const slot = document.createElement('td'); slot.textContent = row.slot_type === 'batter' ? row.slot_number : 'P'; tr.append(slot);
    const type = document.createElement('td'); type.textContent = row.slot_type; tr.append(type);
    const stint = document.createElement('td'); stint.textContent = row.stint_number; tr.append(stint);

    const teamTd = document.createElement('td');
    const select = document.createElement('select');
    teams.forEach((t) => {
      const opt = document.createElement('option'); opt.value = t.id; opt.textContent = t.abbr; select.append(opt);
    });
    select.value = row.team_id;
    select.onchange = (e) => { row.team_id = Number(e.target.value); };
    teamTd.append(select); tr.append(teamTd);

    ['plate_appearances','singles','doubles','triples','home_runs','rbi','runs','stolen_bases','walks'].forEach((k) => tr.append(createStatCell(idx, k, 1)));
    tr.append(createStatCell(idx, 'innings_pitched', 0.1));
    ['pitcher_wins','pitcher_strikeouts','quality_starts','saves','holds','complete_games','shutouts'].forEach((k) => tr.append(createStatCell(idx, k, 1)));

    const pxp = document.createElement('td'); pxp.textContent = row.final_pxp; tr.append(pxp);

    const actions = document.createElement('td');
    const addSub = document.createElement('button'); addSub.textContent = '+ Sub'; addSub.className = 'small-btn';
    addSub.onclick = () => {
      const nextStint = Math.max(...entryRows.filter((e) => e.slot_type === row.slot_type && e.slot_number === row.slot_number).map((e) => e.stint_number)) + 1;
      entryRows.push(defaultEntry(row.slot_type, row.slot_number, nextStint));
      renderEntryTable();
    };
    actions.append(addSub);
    if (row.stint_number > 1) {
      const del = document.createElement('button'); del.textContent = 'Delete'; del.className = 'small-btn';
      del.onclick = () => { entryRows.splice(idx, 1); renderEntryTable(); };
      actions.append(del);
    }
    tr.append(actions);

    tbody.append(tr);
  });

  $('#game-total').textContent = entryRows.reduce((s, r) => s + r.final_pxp, 0);
}

function renderProgressTable(rows) {
  const table = $('#progress-table');
  table.innerHTML = '';
  const missionDefs = [
    ['PXP 7,500', 'total_pxp', 'pxp_7500'],
    ['PXP 25,000', 'total_pxp', 'pxp_25000'],
    ['PXP 50,000', 'total_pxp', 'pxp_50000'],
    ['PXP 75,000', 'total_pxp', 'pxp_75000'],
    ['PXP 100,000', 'total_pxp', 'pxp_100000'],
    ['Season Hits', 'total_hits', 'season_hits_target'],
    ['Season HR', 'total_hr_season', 'season_hr_target'],
    ['Season K', 'total_k', 'season_k_target'],
    ['Career HR', 'total_hr_career', 'career_hr_target']
  ];

  const head = document.createElement('tr');
  head.innerHTML = `<th>Mission</th>${rows.map((r) => `<th>${r.abbr}</th>`).join('')}`;
  table.append(head);

  missionDefs.forEach(([label, progKey, targetKey]) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${label}</td>`;
    rows.forEach((r) => {
      const current = Number(r[progKey] || 0);
      const target = Number(r[targetKey] || 0);
      const remaining = Math.max(0, target - current);
      const done = remaining === 0;
      const cls = done ? 'mission-done' : remaining <= (target * 0.1) ? 'mission-close' : 'mission-far';
      tr.innerHTML += `<td class="${cls}">${done ? '✓' : `${current}/${target} (${remaining} left)`}</td>`;
    });
    table.append(tr);
  });
}

function renderNearTable(rows, limit = 100, tableId = 'near-table') {
  const missionDefs = [
    ['PXP 7,500', 'total_pxp', 'pxp_7500', 1], ['PXP 25,000', 'total_pxp', 'pxp_25000', 1],
    ['PXP 50,000', 'total_pxp', 'pxp_50000', 1], ['PXP 75,000', 'total_pxp', 'pxp_75000', 1],
    ['PXP 100,000', 'total_pxp', 'pxp_100000', 1], ['Season Hits', 'total_hits', 'season_hits_target', 100],
    ['Season HR', 'total_hr_season', 'season_hr_target', 100], ['Season K', 'total_k', 'season_k_target', 100],
    ['Career HR', 'total_hr_career', 'career_hr_target', 100]
  ];

  const items = [];
  rows.forEach((r) => {
    missionDefs.forEach(([label, progKey, targetKey, weight]) => {
      const remaining = Math.max(0, Number(r[targetKey]) - Number(r[progKey] || 0));
      if (remaining > 0) {
        items.push({ team: r.abbr, mission: label, remaining, eq_pxp: remaining * weight });
      }
    });
  });
  items.sort((a, b) => a.eq_pxp - b.eq_pxp);

  const table = $(`#${tableId}`);
  table.innerHTML = '<tr><th>Team</th><th>Mission</th><th>Remaining</th><th>Equivalent PXP</th></tr>' +
    items.slice(0, limit).map((x) => `<tr><td>${x.team}</td><td>${x.mission}</td><td>${x.remaining}</td><td>${x.eq_pxp}</td></tr>`).join('');
}


function renderDashboardChart(rows) {
  const chart = $('#dashboard-chart');
  if (!chart) return;
  chart.innerHTML = '';
  rows.forEach((r) => {
    const pct = Math.min(100, Math.round((Number(r.total_pxp || 0) / Number(r.pxp_100000 || 100000)) * 100));
    const item = document.createElement('div');
    item.className = 'chart-item';
    item.innerHTML = `<div class="chart-label">${r.abbr}</div><div class="chart-bar"><span style="width:${pct}%"></span></div><div class="chart-value">${pct}%</div>`;
    chart.append(item);
  });
}
async function loadProgress() {
  const { data, error } = await sb.from('v_user_team_progress').select('*').order('abbr');
  if (error) {
    logDebug('loadProgress.error', { message: error.message, code: error.code, details: error.details, hint: error.hint });
    setAuthMessage(`Progress load failed: ${error.message}`, true);
    return;
  }
  logDebug('loadProgress.success', { rows: data?.length ?? 0 });
  if (!data || data.length === 0) {
    setAuthMessage('No progress rows returned. Check mission_targets seed data and user auth session.', true);
  }
  progressRows = data;
  renderProgressTable(data);
  renderNearTable(data);
  renderNearTable(data, 10, 'top-near-table');
  renderDashboardChart(data);
}

function renderBaseTable() {
  const table = $('#base-table');
  table.innerHTML = '<tr><th>Team</th><th>Base PXP</th><th>Base Hits</th><th>Base HR (Season)</th><th>Base K</th><th>Base HR (Career)</th></tr>';
  progressRows.forEach((r) => {
    table.innerHTML += `<tr data-team-id="${r.team_id}"><td>${r.abbr}</td>
      <td><input type="number" data-k="base_pxp" value="${Number(r.total_pxp) - estimateLogged(r, 'pxp')}" /></td>
      <td><input type="number" data-k="base_hits" value="${Number(r.total_hits) - estimateLogged(r, 'hits')}" /></td>
      <td><input type="number" data-k="base_hr_season" value="${Number(r.total_hr_season) - estimateLogged(r, 'hr')}" /></td>
      <td><input type="number" data-k="base_k" value="${Number(r.total_k) - estimateLogged(r, 'k')}" /></td>
      <td><input type="number" data-k="base_hr_career" value="${Number(r.total_hr_career) - estimateLogged(r, 'hr')}" /></td>
    </tr>`;
  });
}

function estimateLogged(row, kind) {
  // Placeholder estimator for table rendering only. save function does proper upsert values user chooses.
  if (kind === 'pxp') return 0;
  return 0;
}

async function saveBaseValues() {
  const rows = [...document.querySelectorAll('#base-table tr[data-team-id]')].map((tr) => {
    const team_id = Number(tr.dataset.teamId);
    const payload = { team_id };
    tr.querySelectorAll('input').forEach((i) => payload[i.dataset.k] = Number(i.value || 0));
    return payload;
  });
  const user = (await sb.auth.getUser()).data.user;
  const upserts = rows.map((r) => ({ ...r, user_id: user.id }));
  const { error } = await sb.from('user_base_progress').upsert(upserts, { onConflict: 'user_id,team_id' });
  if (error) return alert(error.message);
  alert('Base values saved');
  await loadProgress();
}

async function saveGame() {
  const user = (await sb.auth.getUser()).data.user;
  const mode = modes.find((m) => m.code === $('#mode-select').value);
  const diff = difficulties.find((d) => d.code === $('#difficulty-select').value);

  const { data: game, error: gErr } = await sb.from('games').insert({
    user_id: user.id,
    played_at: $('#played-at').value || new Date().toISOString().slice(0, 10),
    notes: $('#game-notes').value,
    game_mode_code: mode.code,
    difficulty_code: diff.code,
    mode_multiplier: mode.multiplier,
    difficulty_multiplier: diff.multiplier
  }).select('id').single();
  if (gErr) return alert(gErr.message);

  const payload = entryRows.map((r) => ({ ...r, game_id: game.id, user_id: user.id, team_id: Number(r.team_id) }));
  const { error: eErr } = await sb.from('game_entries').insert(payload);
  if (eErr) return alert(eErr.message);

  alert('Game saved');
  buildDefaultEntries();
  await loadProgress();
  await loadGames();
}

async function loadGames() {
  const { data, error } = await sb.from('games').select('id, played_at, notes, game_mode_code, difficulty_code, created_at').order('created_at', { ascending: false }).limit(20);
  if (error) {
    logDebug('loadGames.error', { message: error.message, code: error.code, details: error.details, hint: error.hint });
    setAuthMessage(`Saved games load failed: ${error.message}`, true);
    return;
  }
  logDebug('loadGames.success', { rows: data?.length ?? 0 });
  const wrap = $('#saved-games');
  wrap.innerHTML = '';

  for (const g of data) {
    const card = document.createElement('article');
    card.innerHTML = `<strong>${g.played_at}</strong> (${g.game_mode_code} / ${g.difficulty_code}) ${g.notes ? `- ${g.notes}` : ''}`;
    const del = document.createElement('button'); del.textContent = 'Delete'; del.className = 'small-btn';
    del.onclick = async () => {
      if (!confirm('Delete this game?')) return;
      const { error: dErr } = await sb.from('games').delete().eq('id', g.id);
      if (dErr) return alert(dErr.message);
      await loadGames();
      await loadProgress();
    };
    card.append(del);
    wrap.append(card);
  }
}

async function bootstrapLookups() {
  const [{ data: t }, { data: m }, { data: d }] = await Promise.all([
    sb.from('teams').select('*').order('abbr'),
    sb.from('game_modes').select('*').order('label'),
    sb.from('difficulties').select('*').order('multiplier')
  ]);
  teams = t || [];
  modes = m || [];
  difficulties = d || [];
  logDebug('bootstrapLookups.success', { teams: teams.length, modes: modes.length, difficulties: difficulties.length });

  $('#mode-select').innerHTML = modes.map((x) => `<option value="${x.code}">${x.label} x${x.multiplier}</option>`).join('');
  $('#difficulty-select').innerHTML = difficulties.map((x) => `<option value="${x.code}">${x.label} x${x.multiplier}</option>`).join('');
  $('#played-at').value = new Date().toISOString().slice(0, 10);
}

async function runDataHealthChecks() {
  const [{ count: teamsCount, error: teamsErr }, { count: mtCount, error: mtErr }, { count: progressCount, error: progErr }] = await Promise.all([
    sb.from('teams').select('*', { count: 'exact', head: true }),
    sb.from('mission_targets').select('*', { count: 'exact', head: true }),
    sb.from('v_user_team_progress').select('*', { count: 'exact', head: true })
  ]);

  if (teamsErr) logDebug('health.teams.error', { message: teamsErr.message, code: teamsErr.code, details: teamsErr.details, hint: teamsErr.hint });
  if (mtErr) logDebug('health.mission_targets.error', { message: mtErr.message, code: mtErr.code, details: mtErr.details, hint: mtErr.hint });
  if (progErr) logDebug('health.progress_view.error', { message: progErr.message, code: progErr.code, details: progErr.details, hint: progErr.hint });

  logDebug('health.summary', { teamsCount, missionTargetsCount: mtCount, progressCount });

  if ((teamsCount ?? 0) > 0 && (mtCount ?? 0) === 0) {
    setAuthMessage('No mission targets found. Run supabase/seed_example.sql in Supabase SQL editor.', true);
  }
}

async function setAuthUI(sessionOverride) {
  const requestId = ++authUiRequestId;
  const session = sessionOverride ?? (await sb.auth.getSession()).data.session;
  const authed = Boolean(session);
  logDebug('auth.session', { authed, email: session?.user?.email || null });
  $('#app-view').classList.toggle('hidden', !authed);
  $('#auth-status').textContent = authed ? `Logged in as ${session.user.email}` : 'Logged out';
  setDashboardTitle(session);
  $('#mini-login-form').classList.toggle('hidden', authed);
  $('#logout-btn').classList.toggle('hidden', !authed);

  if (requestId !== authUiRequestId) return;

  if (authed) {
    await bootstrapLookups();
    await runDataHealthChecks();
    buildDefaultEntries();
    await loadProgress();
    renderBaseTable();
    await loadGames();
  }
}

document.querySelectorAll('nav button[data-tab]').forEach((btn) => btn.onclick = () => {
  showTab(btn.dataset.tab);
  if (btn.dataset.tab === 'base') renderBaseTable();
});

$('#mini-login-form').onsubmit = async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim();
  const password = $('#password').value;
  const submitBtn = e.currentTarget.querySelector('button[type="submit"]');

  logDebug('login.submit.start', { email });

  setAuthMessage('Signing in...');
  if (submitBtn) submitBtn.disabled = true;

  try {
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      logDebug('login.submit.error', { message: error.message, code: error.code, details: error.details, hint: error.hint });
      setAuthMessage(error.message, true);
      return;
    }
    logDebug('login.submit.success', { email });
    setAuthMessage('Signed in successfully. Loading your tracker...');
    await setAuthUI();
    setAuthMessage('');
  } catch (err) {
    setAuthMessage(err?.message || 'Sign-in failed. Please try again.', true);
  } finally {
    if (submitBtn) submitBtn.disabled = false;
  }
};

$('#logout-btn').onclick = async () => { await sb.auth.signOut(); await setAuthUI(); };
$('#save-game-btn').onclick = saveGame;
$('#refresh-games-btn').onclick = loadGames;
$('#save-base-btn').onclick = saveBaseValues;
$('#mode-select').onchange = renderEntryTable;
$('#difficulty-select').onchange = renderEntryTable;

sb.auth.onAuthStateChange((_event, session) => setAuthUI(session));
setAuthUI();
