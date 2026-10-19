import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Testing Dashboard Enhancements: Form Pages, Desktop Sticky Sidebar, Mobile Fixed Nav, & Profile Route...\n');

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

// Test 1: HTML Nesting Fix (admin-panel-users properly closed before form panels)
test('admin-panel-users is closed before admin-panel-article-form', () => {
  const usersPanelStart = html.indexOf('id="admin-panel-users"');
  const articleFormStart = html.indexOf('id="admin-panel-article-form"');
  assert(usersPanelStart !== -1, 'admin-panel-users missing');
  assert(articleFormStart !== -1, 'admin-panel-article-form missing');
  assert(usersPanelStart < articleFormStart, 'users panel must precede article form');

  const snippetBetween = html.substring(usersPanelStart, articleFormStart);
  // Count div opens and closes
  const openDivs = (snippetBetween.match(/<div[\s>]/g) || []).length;
  const closeDivs = (snippetBetween.match(/<\/div>/g) || []).length;
  assert.strictEqual(openDivs, closeDivs, `Div mismatch inside users panel: ${openDivs} opens vs ${closeDivs} closes`);
});

// Test 2: All Form Panels Exist as Direct Admin Panels
test('All form panels (campaign, article, user, gallery, syllabus, profile) exist in index.html', () => {
  const formPanels = [
    'admin-panel-campaign-form',
    'admin-panel-article-form',
    'admin-panel-user-form',
    'admin-panel-gallery-form',
    'admin-panel-syllabus-form',
    'admin-panel-profile'
  ];
  for (const id of formPanels) {
    assert(html.includes(`id="${id}"`), `Missing #${id}`);
  }
});

// Test 3: Topbar Profile Pill in topbar-left with Link to #admin-profile
test('Topbar profile pill is placed in topbar-left with href="#admin-profile"', () => {
  const topbarLeftStart = html.indexOf('class="topbar-left"');
  const topbarRightStart = html.indexOf('class="topbar-right"');
  const profilePillStart = html.indexOf('class="topbar-profile-pill"');

  assert(profilePillStart > topbarLeftStart && profilePillStart < topbarRightStart, 'Profile pill must be in topbar-left');
  assert(html.includes('href="#admin-profile"'), 'Profile pill must link to #admin-profile');
  assert(html.includes('id="topbarAvatar"'), '#topbarAvatar missing');
  assert(html.includes('id="topbarUserName"'), '#topbarUserName missing');
  assert(html.includes('id="topbarUserRoleBadge"'), '#topbarUserRoleBadge missing');
});

// Test 4: Desktop Sticky Sidebar & Scrollable Content Styling
test('Desktop layout locks height to 100dvh and sidebar is sticky', () => {
  assert(css.includes('body.admin-mode') && css.includes('height: 100dvh;'), 'body.admin-mode must lock height: 100dvh');
  assert(css.includes('.admin-sidebar') && css.includes('position: sticky;') && css.includes('height: 100dvh;'), 'admin-sidebar must be sticky with height: 100dvh');
  assert(css.includes('.admin-content-area') && css.includes('height: calc(100dvh - 64px);') && css.includes('overflow-y: auto;'), 'admin-content-area must scroll independently');
});

// Test 5: Sidebar Duplicate User Card is Hidden
test('Sidebar duplicate user card is hidden (.sidebar-user-card display: none)', () => {
  assert(css.includes('.sidebar-user-card') && css.includes('display: none !important;'), 'sidebar-user-card must be display: none !important');
});

// Test 6: Mobile Bottom Nav Sticky and Active View Transform Reset
test('Active view-admin transform is reset and mobile bottom nav is fixed sticky', () => {
  assert(css.includes('#view-admin.page-view.active') && css.includes('transform: none !important;'), '#view-admin transform reset missing');
  assert(css.includes('.mobile-app-bottom-nav') && css.includes('position: fixed !important;'), 'mobile-app-bottom-nav fixed position missing');
  assert(css.includes('z-index: 9999 !important;'), 'mobile-app-bottom-nav high z-index missing');
});

// Test 7: Mobile Topbar Displays Only Avatar Circle
test('Mobile topbar hides user meta (.topbar-user-meta display: none)', () => {
  assert(css.includes('.topbar-user-meta') && css.includes('display: none !important;'), 'topbar-user-meta must be hidden on mobile');
});

// Test 8: Main.js Router and Profile Module Integration
test('main.js handles profile submodule routing and renderAdminProfile', () => {
  assert(mainJs.includes("'profile': 'overview'"), 'profile mapped to overview in SUBMODULE_PARENTS');
  assert(mainJs.includes('renderAdminProfile'), 'renderAdminProfile function exists');
  assert(mainJs.includes('adminProfileForm'), 'adminProfileForm submit handler wired');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed}/${total} Passed (${Math.round(passed / total * 100)}%)`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
} else {
  console.log('🌟 All dashboard enhancements verified successfully!\n');
  process.exit(0);
}
