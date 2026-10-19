import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Testing Mobile Zero-Horizontal-Scroll & User Detail Flow...\n');

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

const html = fs.readFileSync('index.html', 'utf-8');
const css = fs.readFileSync('src/style.css', 'utf-8');
const mainJs = fs.readFileSync('src/main.js', 'utf-8');

// 1. Table headers carry .col-desktop-only
test('All secondary table headers in index.html carry col-desktop-only', () => {
  assert(html.includes('<th class="col-desktop-only">Program</th>'), 'Cockpit donations th program');
  assert(html.includes('<th class="col-desktop-only">Wali</th>'), 'Cockpit ppdb th wali');
  assert(html.includes('<th class="col-desktop-only">Kategori</th>'), 'Programs th kategori');
  assert(html.includes('<th class="col-desktop-only">Target Hafalan</th>'), 'Programs th target');
  assert(html.includes('<th class="col-desktop-only">No. Reg</th>'), 'PPDB th no reg');
  assert(html.includes('<th class="col-desktop-only">No. Invoice</th>'), 'Donations th invoice');
  assert(html.includes('<th class="col-desktop-only">Penanggung Jawab</th>'), 'Visits th pj');
  assert(html.includes('<th class="col-desktop-only">Email Login</th>'), 'Users th email');
  assert(html.includes('<th class="col-desktop-only">Cakupan Akses</th>'), 'Users th scope');
  assert(html.includes('<th class="col-desktop-only">Login Terakhir</th>'), 'Users th login');
  assert(html.includes('<th class="col-desktop-only">Status</th>'), 'Users th status');
});

// 2. Main.js table renderers carry col-desktop-only
test('Main.js table renderers apply col-desktop-only on secondary columns', () => {
  // Users table
  assert(mainJs.includes('<td class="col-desktop-only"><code>${u.email}</code></td>'), 'Users td email');
  assert(mainJs.includes('<td class="col-desktop-only" style="font-size: 0.78rem; color: var(--text-dark);">${roleDescriptions[u.role]'), 'Users td scope');
  assert(mainJs.includes('<td class="col-desktop-only"><span style="font-size: 0.78rem; color: var(--text-muted);">${u.lastLogin}</span></td>'), 'Users td lastLogin');
  assert(mainJs.includes('<td class="col-desktop-only"><span class="status-pill status-success">Aktif</span></td>'), 'Users td status');

  // Donations table
  assert(mainJs.includes('<td class="col-desktop-only"><code>${t.invoiceNumber}</code></td>'), 'Donations td invoice');
  assert(mainJs.includes('<td class="col-desktop-only">${t.campaignTitle.substring(0, 28)}...</td>'), 'Donations td campaign');

  // PPDB table
  assert(mainJs.includes('<td class="col-desktop-only"><code style="font-size: 0.78rem; font-weight: 700; color: var(--primary-purple);">${lead.id}</code></td>'), 'PPDB td id');
  assert(mainJs.includes('<td class="col-desktop-only">${lead.parentName}</td>'), 'PPDB td parent');
});

// 3. User Detail panel in index.html
test('User Detail panel (#admin-panel-user-detail) exists with wireframe elements', () => {
  assert(html.includes('id="admin-panel-user-detail"'), 'Panel #admin-panel-user-detail missing');
  assert(html.includes('id="userDetailAvatar"'), '#userDetailAvatar missing');
  assert(html.includes('id="userDetailName"'), '#userDetailName missing');
  assert(html.includes('id="userDetailRoleBadge"'), '#userDetailRoleBadge missing');
  assert(html.includes('id="userDetailId"'), '#userDetailId missing');
  assert(html.includes('id="userDetailEmail"'), '#userDetailEmail missing');
  assert(html.includes('id="userDetailScope"'), '#userDetailScope missing');
  assert(html.includes('id="userDetailForbidden"'), '#userDetailForbidden missing');
  assert(html.includes('id="userDetailLastLogin"'), '#userDetailLastLogin missing');
  assert(html.includes('id="btnDetailEditUser"'), '#btnDetailEditUser missing');
  assert(html.includes('id="btnDetailDeleteUser"'), '#btnDetailDeleteUser missing');
});

// 4. Main.js user detail routing and row click
test('Main.js user detail routing and user row click handlers are wired', () => {
  assert(mainJs.includes("'user-detail': 'users'"), 'user-detail submodule parent missing');
  assert(mainJs.includes('renderUserDetailPage'), 'renderUserDetailPage function missing');
  assert(mainJs.includes('#admin-user-detail'), 'hash navigation to #admin-user-detail missing');
  assert(mainJs.includes('.user-table-row'), '.user-table-row class missing');
});

// 5. Mobile CSS constraints (zero horizontal scroll)
test('Mobile CSS enforces overflow-x: hidden and hides desktop-only columns', () => {
  assert(css.includes('.col-desktop-only') && css.includes('display: none !important;'), '.col-desktop-only display: none missing');
  assert(css.includes('.admin-table-wrapper') && css.includes('overflow-x: hidden !important;'), '.admin-table-wrapper overflow-x: hidden missing');
  assert(css.includes('.admin-table') && css.includes('min-width: 0 !important;'), '.admin-table min-width: 0 missing');
});

// 6. 1 line 3 campaigns on mobile
test('Campaign grid on mobile renders 1 line 3 campaigns', () => {
  assert(css.includes('.admin-campaign-grid') && css.includes('repeat(3, minmax(0, 1fr)) !important;'), '1 line 3 campaigns grid missing');
  assert(css.includes('.campaign-card-thumb') && css.includes('height: 58px !important;'), 'Compact campaign thumb height missing');
  assert(css.includes('.campaign-card-meta-secondary') && css.includes('display: none !important;'), 'campaign-card-meta-secondary hidden on mobile');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed}/${total} Passed (${Math.round(passed / total * 100)}%)`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
