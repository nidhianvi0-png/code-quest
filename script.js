// ===== SUPABASE INIT =====
const SUPABASE_URL = 'https://oaprijfantarfzvaqmrg.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DQK3JmMrOlG2FjDCywO4ew_A-pNBqIi';
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentProfile = null;

// ===== INIT =====
window.onload = async () => {
  // Set today's date
  document.getElementById('logDate').value = new Date().toISOString().split('T')[0];

  const { data: { session } } = await db.auth.getSession();
  if (session) {
    currentUser = session.user;
    await loadProfile();
    showApp();
  }

  db.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN') {
      currentUser = session.user;
      loadProfile().then(showApp);
    } else if (event === 'SIGNED_OUT') {
      currentUser = null;
      currentProfile = null;
      showAuth();
    }
  });
};

// ===== AUTH =====
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => {
    b.classList.toggle('active', (tab === 'login' && i === 0) || (tab === 'register' && i === 1));
  });
  document.getElementById('loginForm').style.display = tab === 'login' ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
}

async function login() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const msg = document.getElementById('loginMsg');
  const btn = event.target;

  if (!email || !password) { showMsg(msg, 'error', 'Please fill all fields'); return; }

  btn.disabled = true; btn.textContent = 'Logging in...';

  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) {
    showMsg(msg, 'error', error.message);
    btn.disabled = false; btn.textContent = 'Login →';
  }
}

async function register() {
  const username = document.getElementById('regUsername').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;
  const leetcode = document.getElementById('regLeetcode').value.trim();
  const hackerrank = document.getElementById('regHackerrank').value.trim();
  const codechef = document.getElementById('regCodechef').value.trim();
  const msg = document.getElementById('registerMsg');
  const btn = event.target;

  if (!username || !email || !password) { showMsg(msg, 'error', 'Fill required fields'); return; }
  if (password.length < 6) { showMsg(msg, 'error', 'Password min 6 characters'); return; }

  btn.disabled = true; btn.textContent = 'Creating account...';

  const { data, error } = await db.auth.signUp({ email, password });
  if (error) {
    showMsg(msg, 'error', error.message);
    btn.disabled = false; btn.textContent = 'Create Account →';
    return;
  }

  if (data.user) {
    const { error: profileError } = await db.from('profiles').insert({
      id: data.user.id,
      username,
      leetcode_username: leetcode || null,
      hackerrank_username: hackerrank || null,
      codechef_username: codechef || null
    });

    if (profileError) {
      showMsg(msg, 'error', 'Account created! Please login.');
      btn.disabled = false; btn.textContent = 'Create Account →';
      switchTab('login');
      return;
    }

    showMsg(msg, 'success', '✅ Account created! Check email to verify.');
  }

  btn.disabled = false; btn.textContent = 'Create Account →';
}

async function logout() {
  await db.auth.signOut();
}

// ===== PROFILE =====
async function loadProfile() {
  const { data } = await db.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = data;
}

// ===== SHOW/HIDE =====
function showApp() {
  document.getElementById('authPage').style.display = 'none';
  document.getElementById('appPage').style.display = 'block';
  document.getElementById('navUsername').textContent = currentProfile?.username || currentUser?.email;
  loadDashboard();
  loadLeaderboard();
}

function showAuth() {
  document.getElementById('authPage').style.display = 'flex';
  document.getElementById('appPage').style.display = 'none';
}

function showSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById(name).classList.add('active');
  event.target.classList.add('active');
  if (name === 'leaderboard') loadLeaderboard();
  if (name === 'log') loadAllLogs();
}

// ===== DASHBOARD =====
async function loadDashboard() {
  if (!currentUser) return;

  const { data: logs } = await db.from('challenges')
    .select('*').eq('user_id', currentUser.id).order('date', { ascending: false });

  let lc = 0, hr = 0, cc = 0;
  if (logs) {
    logs.forEach(l => {
      if (l.platform === 'leetcode') lc += l.problems_solved;
      else if (l.platform === 'hackerrank') hr += l.problems_solved;
      else if (l.platform === 'codechef') cc += l.problems_solved;
    });
  }

  document.getElementById('lcTotal').textContent = lc;
  document.getElementById('hrTotal').textContent = hr;
  document.getElementById('ccTotal').textContent = cc;
  document.getElementById('totalAll').textContent = lc + hr + cc;

  // Recent 10 logs
  const container = document.getElementById('myLogs');
  if (!logs || logs.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>No logs yet! Add your first challenge.</p></div>`;
    return;
  }

  container.innerHTML = logs.slice(0, 10).map(l => `
    <div class="log-row fade-in">
      <span>${formatDate(l.date)}</span>
      <span><span class="platform-badge ${l.platform}">${l.platform}</span></span>
      <span style="font-family:'Space Mono',monospace; font-weight:700; color:var(--primary)">${l.problems_solved}</span>
      <span class="note-col" style="color:var(--muted); font-size:0.8rem">${l.notes || '—'}</span>
    </div>`).join('');
}

// ===== LOG CHALLENGE =====
async function logChallenge() {
  if (!currentUser) return;

  const platform = document.getElementById('logPlatform').value;
  const count = parseInt(document.getElementById('logCount').value);
  const date = document.getElementById('logDate').value;
  const notes = document.getElementById('logNotes').value.trim();

  if (!count || count < 1) { showToast('Enter valid number!', 'error'); return; }
  if (!date) { showToast('Select a date!', 'error'); return; }

  const { error } = await db.from('challenges').insert({
    user_id: currentUser.id,
    platform, problems_solved: count, date, notes: notes || null
  });

  if (error) { showToast('Error: ' + error.message, 'error'); return; }

  showToast('✅ Challenge logged!', 'success');
  document.getElementById('logCount').value = '';
  document.getElementById('logNotes').value = '';
  loadDashboard();
  loadAllLogs();
}

async function loadAllLogs() {
  if (!currentUser) return;

  const { data: logs } = await db.from('challenges')
    .select('*').eq('user_id', currentUser.id).order('date', { ascending: false });

  const container = document.getElementById('allLogs');
  if (!logs || logs.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">📭</div><p>No logs yet!</p></div>`;
    return;
  }

  container.innerHTML = logs.map(l => `
    <div class="log-row fade-in">
      <span>${formatDate(l.date)}</span>
      <span><span class="platform-badge ${l.platform}">${l.platform}</span></span>
      <span style="font-family:'Space Mono',monospace; font-weight:700; color:var(--primary)">${l.problems_solved}</span>
      <span class="note-col" style="color:var(--muted); font-size:0.8rem">${l.notes || '—'}</span>
    </div>`).join('');
}

// ===== LEADERBOARD =====
async function loadLeaderboard() {
  const container = document.getElementById('leaderboardRows');
  container.innerHTML = `<div class="empty"><div class="loading-spinner"></div><p style="margin-top:12px">Loading...</p></div>`;

  const { data: profiles } = await db.from('profiles').select('id, username');
  if (!profiles || profiles.length === 0) {
    container.innerHTML = `<div class="empty"><div class="empty-icon">👥</div><p>No users yet!</p></div>`;
    return;
  }

  const { data: challenges } = await db.from('challenges').select('user_id, platform, problems_solved');

  const userScores = profiles.map(p => {
    const userChalls = challenges ? challenges.filter(c => c.user_id === p.id) : [];
    const lc = userChalls.filter(c => c.platform === 'leetcode').reduce((s, c) => s + c.problems_solved, 0);
    const hr = userChalls.filter(c => c.platform === 'hackerrank').reduce((s, c) => s + c.problems_solved, 0);
    const cc = userChalls.filter(c => c.platform === 'codechef').reduce((s, c) => s + c.problems_solved, 0);
    return { username: p.username, lc, hr, cc, total: lc + hr + cc };
  }).sort((a, b) => b.total - a.total);

  container.innerHTML = userScores.map((u, i) => {
    const rank = i + 1;
    const rankClass = rank <= 3 ? `rank-${rank}` : '';
    const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank;
    return `
      <div class="leader-row fade-in">
        <span class="rank ${rankClass}">${medal}</span>
        <span class="username-cell">${u.username}${u.username === currentProfile?.username ? ' <span style="color:var(--primary);font-size:0.7rem">(you)</span>' : ''}</span>
        <span class="score-cell">${u.total}</span>
        <span class="platform-score" style="color:var(--orange)">${u.lc}</span>
        <span class="platform-score lc-col" style="color:var(--blue)">${u.hr}</span>
        <span class="platform-score cc-col" style="color:var(--purple)">${u.cc}</span>
      </div>`;
  }).join('');
}

// ===== HELPERS =====
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function showMsg(el, type, text) {
  el.className = `auth-msg ${type}`;
  el.textContent = text;
}

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3000);
}
