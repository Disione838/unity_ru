// ── Supabase Auth Module ──
const SUPABASE_URL = 'https://hvqjqwshxnnogmwygxea.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh2cWpxd3NoeG5ub2dtd3lneGVhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NTQxODMsImV4cCI6MjA5MDAzMDE4M30.xlp6oIBuCKSyUVIdsRjUlu2cHxKUnVStx3AjF18fBOc';

async function sbFetch(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      'apikey': SUPABASE_ANON,
      'Authorization': `Bearer ${getToken() || SUPABASE_ANON}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation',
      ...(opts.headers || {})
    }
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, data: text ? JSON.parse(text) : null };
}

async function sbAuth(endpoint, body) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/${endpoint}`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return { ok: res.ok, data: await res.json() };
}

function getToken() { return localStorage.getItem('sb_token'); }
function getUser()  { try { return JSON.parse(localStorage.getItem('sb_user')); } catch { return null; } }
function setSession(data) {
  localStorage.setItem('sb_token', data.access_token);
  localStorage.setItem('sb_user', JSON.stringify(data.user));
}
function clearSession() { localStorage.removeItem('sb_token'); localStorage.removeItem('sb_user'); }

async function signUp(email, password, username) {
  const r = await sbAuth('signup', { email, password, data: { username } });
  if (!r.ok) return { error: r.data.msg || r.data.error_description || 'Ошибка регистрации' };
  if (r.data.access_token) {
    setSession(r.data);
    await ensureProfile(r.data.user.id, username, email);
  }
  return { data: r.data };
}

async function signIn(email, password) {
  const r = await sbAuth('token?grant_type=password', { email, password });
  if (!r.ok) return { error: r.data.error_description || 'Неверный email или пароль' };
  setSession(r.data);
  return { data: r.data };
}

async function signOut() {
  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON, 'Authorization': `Bearer ${getToken()}` }
  });
  clearSession();
}

async function ensureProfile(userId, username, email) {
  await sbFetch('profiles', {
    method: 'POST',
    headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ id: userId, username: username || email.split('@')[0], email })
  });
}

async function saveQuizResult(score, total, timeMs) {
  const user = getUser();
  if (!user) return;
  return sbFetch('quiz_results', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, score, total, time_ms: timeMs, completed_at: new Date().toISOString() })
  });
}

async function savePuzzleResult(puzzleName, timeMs) {
  const user = getUser();
  if (!user) return;
  return sbFetch('puzzle_results', {
    method: 'POST',
    body: JSON.stringify({ user_id: user.id, puzzle_name: puzzleName, time_ms: timeMs, completed_at: new Date().toISOString() })
  });
}

async function getLeaderboard(type = 'quiz') {
  const table = type === 'quiz' ? 'quiz_leaderboard' : 'puzzle_leaderboard';
  const r = await sbFetch(`${table}?select=*&limit=20`);
  return r.data || [];
}

// Redirect to auth page if not logged in
function requireAuth() {
  if (!getUser() || !getToken()) {
    const current = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `auth.html?redirect=${current}`;
    return false;
  }
  return true;
}
