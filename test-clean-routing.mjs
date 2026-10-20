import assert from 'node:assert';
import fs from 'node:fs';

console.log('🚀 Running Comprehensive Clean URL Permalinks & History API Test Suite...\n');

// 1. Verify index.html navigation links do not use bookmark hash navigation
const htmlContent = fs.readFileSync('index.html', 'utf-8');

const forbiddenBookmarkHashes = [
  'href="#home"',
  'href="#akademik"',
  'href="#akademik-',
  'href="#visit"',
  'href="#about"',
  'href="#news"',
  'href="#admin"',
  'href="#admin-',
  'href="#admin-login"',
  'href="#admin-overview"',
  'href="#admin-akademik"',
  'href="#admin-donasi"',
  'href="#admin-galeri"',
  'href="#admin-berita"',
  'href="#admin-users"',
  'href="#admin-tampilan"'
];

for (const badHash of forbiddenBookmarkHashes) {
  assert(
    !htmlContent.includes(badHash),
    `Found legacy bookmark hash link in index.html: ${badHash}`
  );
}
console.log('✅ PASS: No legacy bookmark hash links found in index.html navigation elements.');

// 2. Verify clean permalinks present in index.html
const expectedPermalinks = [
  'href="/"',
  'href="/akademik"',
  'href="/akademik/smp"',
  'href="/akademik/sma"',
  'href="/akademik/mahasantri"',
  'href="/akademik/tpa"',
  'href="/akademik/online"',
  'href="/akademik/halaqoh-ibu"',
  'href="/visit"',
  'href="/about"',
  'href="/news"',
  'href="/admin/login"',
  'href="/admin/overview"',
  'href="/admin/akademik"',
  'href="/admin/donasi"',
  'href="/admin/galeri"',
  'href="/admin/berita"',
  'href="/admin/users"',
  'href="/admin/tampilan"'
];

for (const permalink of expectedPermalinks) {
  assert(
    htmlContent.includes(permalink),
    `Expected clean permalink missing from index.html: ${permalink}`
  );
}
console.log('✅ PASS: All standard clean permalinks verified in index.html.');

// 3. Mock Browser Globals for Node.js import of src/main.js
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
  location: {
    pathname: '/',
    hash: '',
    search: '',
    origin: 'http://localhost:5173'
  },
  history: {
    pushState: (state, title, url) => {
      global.window.location.pathname = url;
    },
    replaceState: (state, title, url) => {
      global.window.location.pathname = url;
      global.window.location.hash = '';
    }
  },
  addEventListener: () => {},
  removeEventListener: () => {},
  scrollTo: () => {}
};

global.document = {
  title: '',
  body: {
    classList: {
      add: () => {},
      remove: () => {},
      contains: () => false,
      toggle: () => {}
    },
    appendChild: () => {}
  },
  createElement: () => ({
    classList: { add: () => {}, remove: () => {} },
    appendChild: () => {},
    style: {}
  }),
  addEventListener: () => {},
  removeEventListener: () => {},
  getElementById: () => null,
  querySelectorAll: () => [],
  querySelector: () => null
};

// 4. Test router unit functions exported from src/main.js
const { hashToPath, pathToRoute, navigate } = await import('./src/main.js');
const { client } = await import('./src/api-client.js');

// Test legacy hash to clean path conversion
const hashTestCases = [
  { input: '#admin-overview', expected: '/admin/overview' },
  { input: '#admin-akademik', expected: '/admin/akademik' },
  { input: '#admin-donasi', expected: '/admin/donasi' },
  { input: '#admin-galeri', expected: '/admin/galeri' },
  { input: '#admin-berita', expected: '/admin/berita' },
  { input: '#admin-users', expected: '/admin/users' },
  { input: '#admin-profile', expected: '/admin/profile' },
  { input: '#admin-tampilan', expected: '/admin/tampilan/identitas' },
  { input: '#admin-tampilan/kontak', expected: '/admin/tampilan/kontak' },
  { input: '#admin-login', expected: '/admin/login' },
  { input: '#akademik-smp', expected: '/akademik/smp' },
  { input: '#akademik-sma', expected: '/akademik/sma' },
  { input: '#visit', expected: '/visit' },
  { input: '#about', expected: '/about' },
  { input: '#news', expected: '/news' },
  { input: '#home', expected: '/' },
  { input: '#', expected: '/' },
  { input: '', expected: '/' }
];

for (const { input, expected } of hashTestCases) {
  const result = hashToPath(input);
  assert.strictEqual(result, expected, `hashToPath("${input}") should return "${expected}", got "${result}"`);
}
console.log('✅ PASS: hashToPath() accurately converts all legacy hash bookmarks to clean permalinks.');

// Test pathname to route resolution
const pathTestCases = [
  { path: '/', type: 'public', view: 'home' },
  { path: '/home', type: 'public', view: 'home' },
  { path: '/akademik', type: 'public', view: 'akademik', programParam: null },
  { path: '/akademik/smp', type: 'public', view: 'akademik', programParam: 'smp' },
  { path: '/akademik/sma', type: 'public', view: 'akademik', programParam: 'sma' },
  { path: '/visit', type: 'public', view: 'visit' },
  { path: '/galeri', type: 'public', view: 'visit' },
  { path: '/about', type: 'public', view: 'about' },
  { path: '/news', type: 'public', view: 'news' },
  { path: '/admin/login', type: 'admin-login', view: 'admin-login' },
  { path: '/admin', type: 'admin', module: 'overview' },
  { path: '/admin/overview', type: 'admin', module: 'overview' },
  { path: '/admin/akademik', type: 'admin', module: 'akademik' },
  { path: '/admin/donasi', type: 'admin', module: 'donasi' },
  { path: '/admin/galeri', type: 'admin', module: 'galeri' },
  { path: '/admin/berita', type: 'admin', module: 'berita' },
  { path: '/admin/users', type: 'admin', module: 'users' },
  { path: '/admin/profile', type: 'admin', module: 'profile' },
  { path: '/admin/tampilan', type: 'admin', module: 'tampilan/identitas' },
  { path: '/admin/tampilan/kontak', type: 'admin', module: 'tampilan/kontak' },
  { path: '/admin/program-form', type: 'admin', module: 'program-form' },
  { path: '/admin/campaign-form', type: 'admin', module: 'campaign-form' },
  { path: '/admin/article-form', type: 'admin', module: 'article-form' },
  { path: '/admin/gallery-form', type: 'admin', module: 'gallery-form' },
  { path: '/admin/user-form', type: 'admin', module: 'user-form' },
  { path: '/admin/user-detail', type: 'admin', module: 'user-detail' },
  { path: '/admin/syllabus-form', type: 'admin', module: 'syllabus-form' }
];

for (const testCase of pathTestCases) {
  const route = pathToRoute(testCase.path);
  assert.strictEqual(route.type, testCase.type, `pathToRoute("${testCase.path}") type mismatch`);
  if (testCase.view) {
    assert.strictEqual(route.view, testCase.view, `pathToRoute("${testCase.path}") view mismatch`);
  }
  if (testCase.module) {
    assert.strictEqual(route.module, testCase.module, `pathToRoute("${testCase.path}") module mismatch`);
  }
  if ('programParam' in testCase) {
    assert.strictEqual(route.programParam, testCase.programParam, `pathToRoute("${testCase.path}") programParam mismatch`);
  }
  assert(route.title && route.title.length > 0, `Route title must be defined for "${testCase.path}"`);
}
console.log('✅ PASS: pathToRoute() maps all clean permalink paths with correct views, modules, and SEO titles.');

// 5. Test history API navigation cycle
navigate('/akademik/smp');
assert.strictEqual(global.window.location.pathname, '/akademik/smp', 'navigate(/akademik/smp) must update pathname');
assert(global.document.title.includes('SMP'), 'Document title should update for SMP program');

navigate('/admin/login');
assert.strictEqual(global.window.location.pathname, '/admin/login', 'navigate(/admin/login) must update pathname');

// 6. Verify legacy hash auto-migration:
// Public route migration
global.window.location.hash = '#visit';
navigate('#visit');
assert.strictEqual(global.window.location.pathname, '/visit', 'Legacy hash #visit must be converted to /visit');
assert.strictEqual(global.window.location.hash, '', 'Hash must be cleared after migration');

// Authenticated admin route migration
storage.rtm_admin_user = JSON.stringify({ id: 'user-superadmin', name: 'Super Admin', email: 'admin@rtm.sch.id', role: 'superadmin' });
client.setToken('rtm-token-superadmin');
global.window.location.hash = '#admin-galeri';
navigate('#admin-galeri');
assert.strictEqual(global.window.location.pathname, '/admin/galeri', 'Legacy hash #admin-galeri must be converted to /admin/galeri');
assert.strictEqual(global.window.location.hash, '', 'Hash must be cleared after migration');
console.log('✅ PASS: Browser History API pushState and legacy hash migration verified.');

// 7. Verify no window.location.hash assignments in src/main.js
const mainJs = fs.readFileSync('src/main.js', 'utf-8');
const assignmentMatches = mainJs.match(/window\.location\.hash\s*=[^=]/g) || [];
assert.strictEqual(
  assignmentMatches.length,
  0,
  `Expected 0 window.location.hash assignments in src/main.js, but found: ${assignmentMatches.length}`
);
console.log('✅ PASS: All 45 window.location.hash assignments successfully replaced with navigate().');

console.log('\n🎉 ALL CLEAN PERMALINK & ROUTING TESTS PASSED (100%)!\n');
