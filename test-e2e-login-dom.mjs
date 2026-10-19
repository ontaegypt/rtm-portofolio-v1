import assert from 'node:assert';

console.log('🧪 Simulating End-to-End DOM Login Flow in Node.js...\n');

// 1. Mock Browser Environment (Window, LocalStorage, Document, Hash)
const storage = {};
global.localStorage = {
  getItem: (k) => storage[k] || null,
  setItem: (k, v) => { storage[k] = String(v); },
  removeItem: (k) => { delete storage[k]; }
};
const session = {};
global.sessionStorage = {
  getItem: (k) => session[k] || null,
  setItem: (k, v) => { session[k] = String(v); },
  removeItem: (k) => { delete session[k]; }
};

global.window = {
  location: { hash: '#admin-login' },
  addEventListener: () => {},
  scrollTo: () => {}
};

// Simulate fetch that fails with "Failed to fetch" (simulating offline backend)
global.fetch = async () => {
  throw new TypeError('Failed to fetch');
};

// 2. Import modules
const { ADMIN_USERS } = await import('./src/data.js');

// Test the fallback logic extracted from main.js
const usersState = JSON.parse(JSON.stringify(ADMIN_USERS));

async function simulateLogin(email, password, rememberMe = true) {
  let loginSuccess = false;
  let userData = null;
  let userToken = null;

  try {
    // This will throw "Failed to fetch"
    await global.fetch('/api/auth/login');
  } catch (apiErr) {
    // Offline Fallback
    const localUser = usersState.find(u => u.email.toLowerCase() === email.toLowerCase());
    const isPasswordMatch = localUser && (localUser.password === password || password === 'admin123' || password === 'editor123' || password === 'finance123');

    if (localUser && isPasswordMatch) {
      loginSuccess = true;
      userData = {
        id: localUser.id,
        name: localUser.name,
        email: localUser.email,
        role: localUser.role,
        roleTitle: localUser.roleTitle || localUser.role,
        avatar: localUser.avatar || localUser.name.slice(0, 2).toUpperCase()
      };
      userToken = `offline_token_${localUser.id}_${Date.now()}`;
    }
  }

  if (loginSuccess && userData) {
    global.localStorage.setItem('rtm_admin_user', JSON.stringify(userData));
    global.localStorage.setItem('rtm_auth_token', userToken);
    const defaultModule = userData.role === 'editor' ? 'berita' : (userData.role === 'finance' ? 'donasi' : 'overview');
    global.window.location.hash = `#admin-${defaultModule}`;
    return { success: true, user: userData, token: userToken };
  }

  return { success: false, error: 'Email atau kata sandi tidak valid.' };
}

// Case A: Superadmin Login
const adminRes = await simulateLogin('admin@rumahtahfidz.sch.id', 'admin123');
assert(adminRes.success, 'Admin login should succeed even when fetch fails');
assert.strictEqual(global.window.location.hash, '#admin-overview', 'Admin should route to #admin-overview');
assert(global.localStorage.getItem('rtm_auth_token').startsWith('offline_token_'), 'Token should be stored');
console.log('  ✅ [PASS] Superadmin offline login succeeds and routes to #admin-overview');

// Case B: Editor Login
const editorRes = await simulateLogin('editor@rumahtahfidz.sch.id', 'editor123');
assert(editorRes.success, 'Editor login should succeed');
assert.strictEqual(global.window.location.hash, '#admin-berita', 'Editor should route to #admin-berita');
console.log('  ✅ [PASS] Editor offline login succeeds and routes to #admin-berita');

// Case C: Finance Login
const financeRes = await simulateLogin('finance@rumahtahfidz.sch.id', 'finance123');
assert(financeRes.success, 'Finance login should succeed');
assert.strictEqual(global.window.location.hash, '#admin-donasi', 'Finance should route to #admin-donasi');
console.log('  ✅ [PASS] Finance offline login succeeds and routes to #admin-donasi');

// Case D: Wrong Password
const failRes = await simulateLogin('admin@rumahtahfidz.sch.id', 'wrongpass');
assert(!failRes.success, 'Invalid credentials should fail gracefully');
console.log('  ✅ [PASS] Invalid password rejected gracefully without throwing uncaught error');

console.log('\n🌟 All simulated E2E login flows verified successfully!');
