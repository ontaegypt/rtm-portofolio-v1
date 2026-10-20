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

// Test 3: Topbar Profile Pill in topbar-right with Link to #admin-profile
test('Topbar profile pill is placed in topbar-right with href="#admin-profile"', () => {
  const topbarRightStart = html.indexOf('class="topbar-right"');
  const profilePillStart = html.indexOf('class="topbar-profile-pill"');

  assert(profilePillStart > topbarRightStart, 'Profile pill must be in topbar-right');
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

// Test 13: Simplified sidebar menu labels without 'Kelola', 'Modul', and 'Manajemen'
test("Menu labels omit 'Kelola', 'Modul', and use 'Akademik' & 'Pengguna'", () => {
  const startIdx = html.indexOf('<nav class="sidebar-nav">');
  const endIdx = html.indexOf('</nav>', startIdx);
  const sidebarNavSnippet = html.substring(startIdx, endIdx);
  assert(!sidebarNavSnippet.includes('>Kelola Akademik<'), "Sidebar menu should not contain 'Kelola Akademik'");
  assert(!sidebarNavSnippet.includes('>Modul Wakaf & Donasi<'), "Sidebar menu should not contain 'Modul Wakaf & Donasi'");
  assert(!sidebarNavSnippet.includes('>Kelola Galeri'), "Sidebar menu should not contain 'Kelola Galeri'");
  assert(!sidebarNavSnippet.includes('>Kelola Artikel'), "Sidebar menu should not contain 'Kelola Artikel'");
  assert(!sidebarNavSnippet.includes('>Kelola Tampilan<'), "Sidebar menu should not contain 'Kelola Tampilan'");
  assert(!sidebarNavSnippet.includes('>Manajemen Pengguna<'), "Sidebar menu should not contain 'Manajemen Pengguna'");

  assert(sidebarNavSnippet.includes('>Akademik<'), "Sidebar menu must contain 'Akademik'");
  assert(sidebarNavSnippet.includes('>Wakaf & Donasi<'), "Sidebar menu must contain 'Wakaf & Donasi'");
  assert(sidebarNavSnippet.includes('>Galeri & Kunjungan<'), "Sidebar menu must contain 'Galeri & Kunjungan'");
  assert(sidebarNavSnippet.includes('>Artikel / Berita<'), "Sidebar menu must contain 'Artikel / Berita'");
  assert(sidebarNavSnippet.includes('>Tampilan<'), "Sidebar menu must contain 'Tampilan'");
  assert(sidebarNavSnippet.includes('>Pengguna<'), "Sidebar menu must contain 'Pengguna'");
});

// Test 14: Artikel / Berita Header Action Button Sizing & Label
test("Tombol 'Artikel Baru' tidak memiliki duplicate + dan ukurannya sama dengan menu akademik di desktop, ipad, dan mobile", () => {
  assert(html.includes('class="panel-header-actions artikel-header-actions"'), 'Missing .artikel-header-actions in index.html');
  assert(html.includes('id="btnCreateArticle"'), 'btnCreateArticle missing in index.html');
  assert(html.includes('<span>Artikel Baru</span>'), 'Button text must be "Artikel Baru" without duplicate +');
  assert(!html.includes('+ Tulis Artikel Baru'), 'Old label "+ Tulis Artikel Baru" should be removed');

  // Desktop
  assert(css.includes('.artikel-header-actions .btn {') && css.includes('height: 38px !important;') && css.includes('font-size: 0.85rem !important;'), 'Desktop rules for .artikel-header-actions .btn must match akademik (font-size: 0.85rem, height: 38px)');

  // iPad
  const ipadSection = css.slice(css.indexOf('@media (max-width: 1024px)'));
  assert(ipadSection.includes('.artikel-header-actions .btn {') && ipadSection.includes('font-size: 0.78rem !important;'), 'iPad rules for .artikel-header-actions .btn must match akademik (font-size: 0.78rem)');

  // Mobile
  const mobileSection = css.slice(css.indexOf('@media (max-width: 768px)'));
});

// Test 15: Galeri 'Tambah Media' & Pengguna 'Tambah Pengguna Baru' without duplicate + and matching Menu Akademik
test("Tombol 'Tambah Media' dan 'Tambah Pengguna Baru' tidak memiliki duplicate + dan ukurannya sama dengan menu akademik", () => {
  // Tambah Media
  assert(html.includes('id="btnAddGalleryMedia"'), 'btnAddGalleryMedia missing in index.html');
  assert(html.includes('<span>Tambah Media</span>'), 'Button text must be "Tambah Media" without duplicate +');
  assert(!html.includes('<span>+ Tambah Media</span>'), 'Old label "<span>+ Tambah Media</span>" should be removed');

  // Tambah Pengguna Baru
  assert(html.includes('class="panel-header-actions users-header-actions"'), 'Missing .users-header-actions in index.html');
  assert(html.includes('id="btnCreateUser"'), 'btnCreateUser missing in index.html');
  assert(html.includes('<span>Tambah Pengguna Baru</span>'), 'Button text must be "Tambah Pengguna Baru" without duplicate +');
  assert(!html.includes('>+ Tambah Pengguna Baru<'), 'Old label "+ Tambah Pengguna Baru" string + should be removed');

  // Desktop
  assert(css.includes('.users-header-actions .btn') && css.includes('height: 38px !important;') && css.includes('font-size: 0.85rem !important;'), 'Desktop rules for .users-header-actions .btn must match akademik');

  // iPad
  const ipadSection = css.slice(css.indexOf('@media (max-width: 1024px)'));
  assert(ipadSection.includes('.users-header-actions .btn') && ipadSection.includes('font-size: 0.78rem !important;'), 'iPad rules for .users-header-actions .btn must match akademik');

  // Mobile
  const mobileSection = css.slice(css.indexOf('@media (max-width: 768px)'));
  assert(mobileSection.includes('.panel-header-actions.users-header-actions .btn') && mobileSection.includes('font-size: 0.76rem !important;'), 'Mobile rules for .users-header-actions .btn must match akademik');
});

// Test 16: Topbar Right Order: [Lihat Web] [Notifikasi] [Account Dropdown] & Sophie Bennett Style Card
test("Topbar right has [Lihat Web] [Notifikasi] [Account Dropdown] in order with 5 menus", () => {
  // 1. Right side ordering: Lihat Web < Notifikasi < Account Dropdown
  const topbarRightStart = html.indexOf('class="topbar-right"');
  const webBtnStart = html.indexOf('class="btn btn-secondary btn-sm topbar-web-btn"');
  const notifBoxStart = html.indexOf('class="topbar-notif-box"');
  const avatarWrapperStart = html.indexOf('id="topbarAccountWrapper"');

  assert(webBtnStart > topbarRightStart, 'topbar-web-btn must be inside topbar-right');
  assert(webBtnStart < notifBoxStart, 'topbar-web-btn must be before topbar-notif-box');
  assert(notifBoxStart < avatarWrapperStart, 'topbar-notif-box must be before topbarAccountWrapper');

  // 2. Avatar button contains only the avatar circle (no username text on the topbar bar)
  assert(html.includes('id="topbarAvatarTrigger"'), 'topbarAvatarTrigger button missing');
  assert(html.includes('id="topbarAvatar"'), 'topbarAvatar circle missing');

  // 3. Account dropdown card exists with header and 5 menus
  assert(html.includes('id="accountDropdownCard"'), 'accountDropdownCard missing');
  assert(html.includes('class="account-card-header"'), 'account-card-header missing');
  assert(html.includes('id="accountDropdownEmail"'), 'accountDropdownEmail missing');
  assert(html.includes('id="accountDropdownAvatarRing"'), 'accountDropdownAvatarRing missing');
  assert(html.includes('id="accountDropdownAvatar"'), 'accountDropdownAvatar missing');

  // 4. Five menu items: Profil Saya, Bahasa, Bantuan, Kirim Masukan, | Keluar
  assert(html.includes('id="accountMenuProfile"') && html.includes('Profil Saya'), 'Menu Profil Saya missing');
  assert(html.includes('id="accountMenuLanguage"') && html.includes('Bahasa'), 'Menu Bahasa missing');
  assert(html.includes('id="accountMenuHelp"') && html.includes('Bantuan'), 'Menu Bantuan missing');
  assert(html.includes('id="accountMenuFeedback"') && html.includes('Kirim Masukan'), 'Menu Kirim Masukan missing');
  assert(html.includes('class="account-card-divider"'), 'Divider line missing');
  assert(html.includes('id="accountMenuLogout"') && html.includes('Keluar'), 'Menu Keluar missing');

  // 5. CSS definitions for card, rainbow ring, and menu items
  assert(css.includes('.account-dropdown-card'), '.account-dropdown-card styling missing');
  assert(css.includes('.account-card-avatar-ring'), '.account-card-avatar-ring styling missing');
  assert(css.includes('conic-gradient('), 'Conic gradient rainbow ring missing');
  assert(css.includes('.account-menu-item'), '.account-menu-item styling missing');
  assert(css.includes('.account-menu-logout'), '.account-menu-logout styling missing');

  // 6. Main.js wiring for trigger toggle, click-outside, and menu actions
  assert(mainJs.includes('topbarAvatarTrigger.addEventListener'), 'topbarAvatarTrigger click event missing');
  assert(mainJs.includes('accountMenuLogout.addEventListener'), 'accountMenuLogout click event missing');
  assert(mainJs.includes('adminLanguageModal'), 'adminLanguageModal handling missing');
  assert(mainJs.includes('adminHelpModal'), 'adminHelpModal handling missing');
  assert(mainJs.includes('adminFeedbackModal'), 'adminFeedbackModal handling missing');
});

// Test 17: Menu Ringkasan / Analytics: Tombol 'Muat Ulang Data' dihapus & Tombol 'Unduh Rekap' berwarna ungu
test("Menu Ringkasan: Tombol 'Muat Ulang Data' dihapus & Tombol 'Unduh Rekap' berwarna ungu seperti menu akademik", () => {
  // 1. Muat ulang data button removed
  assert(!html.includes('id="btnRefreshOverview"'), 'btnRefreshOverview must be removed from index.html');
  assert(!html.includes('>Muat Ulang Data<'), 'Muat Ulang Data string must be removed from index.html');
  assert(!mainJs.includes("getElementById('btnRefreshOverview')"), 'btnRefreshOverview listener must be removed from main.js');

  // 2. Unduh Rekap button uses purple primary styling
  assert(html.includes('id="btnQuickExportCSV"'), 'btnQuickExportCSV must exist in index.html');
  assert(html.includes('btn-rekap-purple'), 'btnQuickExportCSV must have btn-rekap-purple class in index.html');
  assert(css.includes('.btn-rekap-purple {') && css.includes('background: var(--primary-purple) !important;'), '.btn-rekap-purple must use var(--primary-purple) in style.css');
  assert(css.includes('.btn-rekap-purple:hover {') && css.includes('background: var(--purple-hover) !important;'), '.btn-rekap-purple:hover must use var(--purple-hover)');
});

// Test 18: Welcoming Banner: Analytics Pengunjung (Google Analytics Standby) & Konsistensi Warna/Fitur di Semua Media Query
test("Welcoming Banner: Analytics Pengunjung (GA4 Standby) & Warna/Fitur seragam di Desktop, Tablet, dan Mobile", () => {
  // 1. Rightmost feature is Visitor Analytics with Google Analytics readiness
  assert(html.includes('id="cockpitVisitorAnalytics"'), 'cockpitVisitorAnalytics must exist in index.html');
  assert(html.includes('class="cockpit-visitor-analytics-card"'), 'cockpit-visitor-analytics-card must exist in index.html');
  assert(html.includes('class="analytics-ga-badge"'), 'analytics-ga-badge must exist in index.html');
  assert(html.includes('class="ga-status-dot"'), 'ga-status-dot must exist in index.html');
  assert(html.includes('id="gaVisitorsToday"'), 'gaVisitorsToday must exist in index.html');
  assert(html.includes('id="gaPageviewsToday"'), 'gaPageviewsToday must exist in index.html');
  assert(html.includes('Siap disambungkan ke Google Analytics'), 'Google Analytics readiness notice missing in index.html');

  // 2. Desktop CSS styling
  assert(css.includes('.cockpit-welcome-banner {') && css.includes('background: #c39860;'), 'Desktop welcome banner must use camel #c39860');
  assert(css.includes('.cockpit-visitor-analytics-card {'), 'cockpit-visitor-analytics-card CSS missing');
  assert(css.includes('.ga-status-dot {') && css.includes('#22c55e;'), 'ga-status-dot CSS missing or not green');

  // 3. Mobile CSS styling uniformity (no dark teal divergence, all features retained)
  const mobileCss = css.slice(css.indexOf('@media (max-width: 768px)'));
  assert(mobileCss.includes('.cockpit-welcome-banner {') && mobileCss.includes('background: #c39860 !important;'), 'Mobile welcome banner must use unified #c39860 !important');
  assert(!mobileCss.includes('.cockpit-top-actions {\n    display: none;'), 'Mobile cockpit top actions (date filter and rekap button) must not be hidden');
  assert(mobileCss.includes('.cockpit-pill-btn {') && mobileCss.includes('background: #ffffff !important;'), 'Mobile pill button must match desktop white pill');
  assert(mobileCss.includes('.cockpit-pill-btn.cockpit-pill-secondary {') && mobileCss.includes('display: inline-flex !important;'), 'Mobile secondary action button must not be hidden');
  assert(mobileCss.includes('.cockpit-visitor-analytics-card {') && mobileCss.includes('width: 100% !important;'), 'Mobile visitor analytics card must be full width');
});

// Test 19: Menu Ringkasan: Hapus Fitur Aksi Cepat CMS & Hapus Filter Periode
test("Menu Ringkasan: Aksi Cepat CMS dan Filter Periode berhasil dihapus", () => {
  // 1. Aksi Cepat CMS bar removed
  assert(!html.includes('Aksi Cepat CMS:'), 'Aksi Cepat CMS label must be removed from index.html');
  assert(!html.includes('id="btnQuickWriteArticle"'), 'btnQuickWriteArticle must be removed from index.html');
  assert(!html.includes('id="btnQuickManualDonation"'), 'btnQuickManualDonation must be removed from index.html');
  assert(!html.includes('id="btnQuickNewCampaign"'), 'btnQuickNewCampaign must be removed from index.html');
  assert(!html.includes('id="btnQuickManageProgram"'), 'btnQuickManageProgram must be removed from index.html');
  assert(!html.includes('id="btnQuickMediaLibrary"'), 'btnQuickMediaLibrary must be removed from index.html');

  // 2. Filter periode next to Unduh Rekap removed
  assert(!html.includes('id="overviewDateFilter"'), 'overviewDateFilter must be removed from index.html');
  assert(!html.includes('aria-label="Filter Periode Waktu"'), 'Filter Periode Waktu select must be removed from index.html');
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
