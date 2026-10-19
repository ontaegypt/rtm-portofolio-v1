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

// Test 9: Dark and Light Feature Removed
test('Dark and light theme toggle is removed from index.html', () => {
  assert(!html.includes('id="themeLightBtn"'), 'themeLightBtn should not exist in index.html');
  assert(!html.includes('id="themeDarkBtn"'), 'themeDarkBtn should not exist in index.html');
  assert(!html.includes('class="sidebar-theme-toggle"'), 'sidebar-theme-toggle should not exist in index.html');
});

// Test 10: Dashboard Brand Logo uses logo-footer-RTM.png with responsive sizing
test('Dashboard brand logo uses logo-footer-RTM.png and responsive styling', () => {
  assert(html.includes('src="/assets/images/logo-footer-RTM.png" alt="Rumah Tahfidz Madani" class="dashboard-brand-logo"'), 'Dashboard logo-footer-RTM.png missing in index.html');
  assert(css.includes('.dashboard-brand-logo'), 'dashboard-brand-logo class missing in CSS');
  assert(css.includes('max-width: 175px;'), 'Desktop logo max-width missing');
  assert(css.includes('max-width: 150px;'), 'iPad/Tablet logo max-width missing');
  assert(css.includes('max-width: 135px;'), 'Mobile logo max-width missing');
});

// Test 11: Mobile Bottom Nav has 4 menus only and Wakaf icon is money/banknote
test('Mobile bottom nav has 4 menus (no FAB button) and Wakaf icon uses money icon', () => {
  assert(!html.includes('id="mobQuickActionFab"'), 'mobQuickActionFab FAB button should be removed');
  const bottomNavSnippet = html.match(/<nav class="mobile-app-bottom-nav"[^>]*>([\s\S]*?)<\/nav>/)?.[1] || '';
  const mobNavItems = (bottomNavSnippet.match(/class="mob-nav-item/g) || []).length;
  assert.strictEqual(mobNavItems, 4, `Expected exactly 4 mob-nav-item elements, found ${mobNavItems}`);
  assert(!bottomNavSnippet.includes('M19 14c1.49-1.46'), 'Bottom nav Wakaf icon should not use heart svg');
  assert(bottomNavSnippet.includes('<circle cx="12" cy="12" r="2.5"/>'), 'Wakaf icon must use money banknote icon');
});

// Test 12: Mobile Sidebar Drawer is above bottom nav and does not cover logout button
test('Mobile drawer has higher z-index (10010) than sticky bottom nav (9999) and logout is unobstructed', () => {
  assert(css.includes('.admin-sidebar') && css.includes('z-index: 10010 !important;'), 'admin-sidebar must have z-index: 10010 !important');
  assert(css.includes('.sidebar-backdrop') && css.includes('z-index: 10005 !important;'), 'sidebar-backdrop must have z-index: 10005 !important');
  assert(css.includes('body.admin-sidebar-open .mobile-app-bottom-nav'), 'Bottom nav should hide when drawer is open');
  assert(css.includes('padding: 1rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px)) !important;'), 'Sidebar footer must have safe-area padding for logout button');
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
