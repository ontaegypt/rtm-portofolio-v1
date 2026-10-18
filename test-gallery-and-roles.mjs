import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Verifying Gallery Debug, Simplified Roles, and Super Admin Actions...\n');

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

const indexHtml = fs.readFileSync('index.html', 'utf-8');
const mainJs = fs.readFileSync('src/main.js', 'utf-8');
const dataJs = fs.readFileSync('src/data.js', 'utf-8');
const serverApiJs = fs.readFileSync('server/api.js', 'utf-8');

// 1. Gallery Feature & Modal
test('Gallery modal (#adminGalleryModal) and form exist in index.html', () => {
  assert(indexHtml.includes('id="adminGalleryModal"'), '#adminGalleryModal missing');
  assert(indexHtml.includes('id="adminGalleryForm"'), '#adminGalleryForm missing');
  assert(indexHtml.includes('id="galleryFormTitle"'), '#galleryFormTitle missing');
  assert(indexHtml.includes('id="galleryFormCategory"'), '#galleryFormCategory missing');
  assert(indexHtml.includes('id="galleryFormDate"'), '#galleryFormDate missing');
  assert(indexHtml.includes('id="galleryFormUrl"'), '#galleryFormUrl missing');
  assert(indexHtml.includes('id="galleryFormCaption"'), '#galleryFormCaption missing');
  assert(indexHtml.includes('btn-quick-gal-img'), '.btn-quick-gal-img presets missing');
  assert(indexHtml.includes('id="btnCloseGalleryModal"'), '#btnCloseGalleryModal missing');
  assert(indexHtml.includes('id="btnCancelGallery"'), '#btnCancelGallery missing');
  assert(indexHtml.includes('id="btnSubmitGallery"'), '#btnSubmitGallery missing');
});

test('Gallery modal handlers and quick presets are wired in main.js', () => {
  assert(mainJs.includes("getElementById('adminGalleryModal')"), 'adminGalleryModal not selected in main.js');
  assert(mainJs.includes("getElementById('adminGalleryForm')"), 'adminGalleryForm not selected in main.js');
  assert(mainJs.includes("galleriesApi.create"), 'galleriesApi.create not called on submit');
  assert(mainJs.includes(".btn-quick-gal-img"), 'quick preset listener missing in main.js');
});

test('Gallery mini grid displays items with functional delete button and superadmin check', () => {
  assert(mainJs.includes('btn-delete-gal-item'), 'btn-delete-gal-item missing in adminMediaMiniGrid');
  assert(mainJs.includes('galleriesApi.delete'), 'galleriesApi.delete missing');
  assert(mainJs.includes("Aksi ini dikhususkan hanya untuk Super Admin (Admin)."), 'Superadmin warning toast missing');
});

// 2. Simplified Roles
test('Roles are simplified to Admin, Content, and Finance in ROLES_CONFIG', () => {
  assert(mainJs.includes("name: 'Admin'"), "ROLES_CONFIG.superadmin.name should be 'Admin'");
  assert(mainJs.includes("name: 'Content'"), "ROLES_CONFIG.editor.name should be 'Content'");
  assert(mainJs.includes("name: 'Finance'"), "ROLES_CONFIG.finance.name should be 'Finance'");
});

test('Role titles in ADMIN_USERS (data.js) are simplified', () => {
  assert(dataJs.includes('roleTitle: "Admin"') || dataJs.includes("roleTitle: 'Admin'"), "usr-1 roleTitle should be 'Admin'");
  assert(dataJs.includes('roleTitle: "Content"') || dataJs.includes("roleTitle: 'Content'"), "usr-2 roleTitle should be 'Content'");
  assert(dataJs.includes('roleTitle: "Finance"') || dataJs.includes("roleTitle: 'Finance'"), "usr-3 roleTitle should be 'Finance'");
});

test('Topbar role label in index.html is simplified to Admin', () => {
  assert(indexHtml.includes('<span id="topbarUserRoleBadge" class="user-role-badge superadmin">Admin</span>'), 'topbarUserRoleBadge should display Admin');
});

test('User creation/edit form in index.html uses simplified role names', () => {
  assert(indexHtml.includes('Admin (Akses Penuh Seluruh Sistem)'), 'Option Admin missing in role dropdown');
  assert(indexHtml.includes('Content (Kelola Berita, Akademik, Galeri)'), 'Option Content missing in role dropdown');
  assert(indexHtml.includes('Finance (Modul Wakaf & Donasi)'), 'Option Finance missing in role dropdown');
});

// 3. User Table Action Buttons & Super Admin Only
test('User table renders functional Ubah and Hapus action buttons', () => {
  assert(mainJs.includes('btn-edit-user-action'), 'btn-edit-user-action missing');
  assert(mainJs.includes('btn-delete-user-action'), 'btn-delete-user-action missing');
  assert(mainJs.includes('openEditUserModal'), 'openEditUserModal function missing');
  assert(mainJs.includes('usersApi.update'), 'usersApi.update missing in userForm submission');
});

test('Backend /galleries endpoints are restricted to superadmin', () => {
  assert(serverApiJs.includes("api.post('/galleries', verifyRoleIfAuthenticated('superadmin')"), 'POST /galleries not restricted to superadmin');
  assert(serverApiJs.includes("api.delete('/galleries/:id', verifyRoleIfAuthenticated('superadmin')"), 'DELETE /galleries not restricted to superadmin');
});

test('Backend /users endpoints are restricted to superadmin', () => {
  assert(serverApiJs.includes("api.post('/users', verifyRoleIfAuthenticated('superadmin')"), 'POST /users not restricted to superadmin');
  assert(serverApiJs.includes("api.delete('/users/:id', verifyRoleIfAuthenticated('superadmin')"), 'DELETE /users not restricted to superadmin');
  assert(serverApiJs.includes("api.patch('/users/:id', verifyRoleIfAuthenticated('superadmin')"), 'PATCH /users not restricted to superadmin');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed}/${total} Passed (${Math.round(passed / total * 100)}%)`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
}
