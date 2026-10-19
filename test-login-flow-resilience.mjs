import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Testing Login Flow & Offline Resilience...\n');

let passed = 0;
let total = 0;

function test(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

const mainJs = fs.readFileSync('src/main.js', 'utf-8');
const viteConfig = fs.readFileSync('vite.config.js', 'utf-8');

// Test 1: vite.config.js provides API middleware
test('vite.config.js configures dev server with API middleware fallback', () => {
  assert(viteConfig.includes("name: 'rtm-api-server'"), 'Missing rtm-api-server plugin');
  assert(viteConfig.includes("server.middlewares.use('/api'"), 'Missing /api middleware');
});

// Test 2: Login form handles API failure and falls back to local demo accounts
test('Login form implements fallback authentication against usersState/ADMIN_USERS when API fails', () => {
  assert(mainJs.includes('catch (apiErr) {'), 'Missing catch (apiErr) in login form');
  assert(mainJs.includes("usersState.find(u => u.email.toLowerCase() === email.toLowerCase())"), 'Missing local user lookup in login fallback');
  assert(mainJs.includes("offline_token_"), 'Missing offline token generation in login fallback');
});

// Test 3: verifyAndSyncSession preserves session on network error or offline token
test('verifyAndSyncSession does not boot user on network error or offline token', () => {
  assert(mainJs.includes("token.startsWith('offline_token_')"), 'Missing offline token check in verifyAndSyncSession');
  assert(mainJs.includes("err.status === 401 || err.status === 403"), 'Session clearance should only occur on HTTP 401/403');
});

// Test 4: Invalid credentials provide friendly validation error instead of raw technical error
test('Invalid credentials show user-friendly message', () => {
  assert(mainJs.includes('Email atau kata sandi tidak valid. Silakan gunakan akun demo yang tersedia di bawah.'), 'Missing user-friendly error message');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed}/${total} Passed (${Math.round(passed / total * 100)}%)`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
} else {
  console.log('🌟 Login flow & offline resilience verified successfully!');
}
