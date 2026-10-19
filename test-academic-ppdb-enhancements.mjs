import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Testing Kelola Akademik & PPDB Table Enhancements...\n');

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

// Test 1: Tombol Kelola Akademik Sejajar di Desktop, iPad, dan Mobile
test("Tombol '+ Tambah Program Pendidikan' dan 'Unggah Silabus PDF Baru' sejajar di desktop, iPad, dan mobile", () => {
  // Check index.html container
  assert(html.includes('class="panel-header-actions akademik-header-actions"'), 'Missing .akademik-header-actions class in index.html');
  assert(html.includes('id="btnCreateNewProgram"'), 'Missing #btnCreateNewProgram');
  assert(html.includes('id="btnUploadSyllabus"'), 'Missing #btnUploadSyllabus');

  // Check CSS: Desktop (flex row, nowrap)
  assert(css.includes('.akademik-header-actions {') && css.includes('flex-direction: row !important;') && css.includes('flex-wrap: nowrap !important;'), 'Desktop flex row and nowrap missing');

  // Check CSS: iPad (max-width: 1024px) side-by-side
  const ipadSectionStart = css.lastIndexOf('@media (max-width: 1024px)');
  const nextMediaStart = css.indexOf('@media (max-width: 768px)', ipadSectionStart);
  const ipadSection = css.substring(ipadSectionStart, nextMediaStart !== -1 ? nextMediaStart : undefined);
  assert(ipadSection.includes('.akademik-header-actions'), 'iPad media query missing .akademik-header-actions');
  assert(ipadSection.includes('flex-direction: row !important;') && ipadSection.includes('flex-wrap: nowrap !important;'), 'iPad flex row and nowrap missing');

  // Check CSS: Mobile (max-width: 768px) grid side-by-side 1fr 1fr
  const mobileSectionStart = css.indexOf('@media (max-width: 768px)', ipadSectionStart);
  const mobileSection = css.substring(mobileSectionStart);
  assert(mobileSection.includes('.panel-header-actions.akademik-header-actions {'), 'Mobile media query missing .panel-header-actions.akademik-header-actions');
  assert(mobileSection.includes('grid-template-columns: 1fr 1fr !important;'), 'Mobile grid-template-columns: 1fr 1fr missing');
});

// Test 2: Status PPDB Satu Bahasa (Buka & Tutup) Tanpa (Open)/(Closed)
test("Status PPDB hanya menggunakan 'Buka' dan 'Tutup' tanpa embel-embel (Open)/(Closed)", () => {
  // Check main.js
  assert(!mainJs.includes("'Buka (Open)'"), "main.js still contains 'Buka (Open)'");
  assert(!mainJs.includes("'Tutup (Closed)'"), "main.js still contains 'Tutup (Closed)'");
  assert(!mainJs.includes("'DIBUKA (OPEN)'"), "main.js still contains 'DIBUKA (OPEN)'");
  assert(!mainJs.includes("'DITUTUP (CLOSED)'"), "main.js still contains 'DITUTUP (CLOSED)'");

  assert(mainJs.includes("p.ppdbOpen ? 'Buka' : 'Tutup'"), "main.js missing p.ppdbOpen ? 'Buka' : 'Tutup'");
  assert(mainJs.includes("prog.ppdbOpen ? 'Buka' : 'Tutup'"), "main.js missing prog.ppdbOpen ? 'Buka' : 'Tutup'");

  // Check index.html select options
  assert(html.includes('<option value="1">PPDB: Buka</option>'), 'index.html missing PPDB: Buka option');
  assert(html.includes('<option value="0">PPDB: Tutup</option>'), 'index.html missing PPDB: Tutup option');
});

// Test 3: Kolom Pilihan Program Sedikit Lebar dan Maksimal 2 Baris
test('Kolom Pilihan Program diperlebar dan dibatasi maksimal 2 baris (-webkit-line-clamp: 2)', () => {
  assert(html.includes('<th class="col-desktop-only col-ppdb-program">Pilihan Program</th>'), 'TH missing col-ppdb-program');
  assert(mainJs.includes('<td class="col-desktop-only col-ppdb-program">'), 'TD missing col-ppdb-program');
  assert(mainJs.includes('ppdb-program-badge'), 'main.js missing ppdb-program-badge class');

  // Check CSS width
  assert(css.includes('.col-ppdb-program {'), 'CSS missing .col-ppdb-program');
  assert(css.includes('min-width: 195px !important;'), 'CSS missing min-width: 195px !important');

  // Check CSS clamp 2 lines
  assert(css.includes('-webkit-line-clamp: 2 !important;'), 'CSS missing -webkit-line-clamp: 2 !important');
});

// Test 4: Tombol Paling Kanan Pada Table Pendaftar Hanya 3 Icon (Lihat, Menceklis, Buang)
test('Tindakan pada tabel pendaftar hanya memuat 3 icon: melihat (mata), menceklis (centang), dan buang (tempat sampah)', () => {
  // Eye icon button
  assert(mainJs.includes('class="btn-icon-action btn-view-lead"'), 'Missing btn-view-lead');
  assert(mainJs.includes('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>'), 'btn-view-lead missing SVG eye path');
  assert(!mainJs.includes('>Lihat</button>'), 'Button should not have text "Lihat", only icon');

  // Checkmark icon button
  assert(mainJs.includes('class="btn-icon-action approve-btn btn-accept-lead"'), 'Missing btn-accept-lead');
  assert(mainJs.includes('<polyline points="20 6 9 17 4 12"/>'), 'btn-accept-lead missing SVG checkmark');

  // Trash icon button
  assert(mainJs.includes('class="btn-icon-action btn-delete-lead"'), 'Missing btn-delete-lead');
  assert(mainJs.includes('<polyline points="3 6 5 6 21 6"/>'), 'btn-delete-lead missing SVG trash');

  // Verifikasi berkas (🔍) and WA button (💬) removed from action column
  const actionColumnSnippet = mainJs.substring(mainJs.indexOf('<div class="table-action-btns">'), mainJs.indexOf('ppdbBody.querySelectorAll(\'.ppdb-table-row\')'));
  assert(!actionColumnSnippet.includes('btn-verify-lead'), 'btn-verify-lead should be removed from table action buttons');
  assert(!actionColumnSnippet.includes('💬'), 'WA emoji button should be removed from table action buttons');
});

// Test 5: Chat WhatsApp Langsung dari Kolom Nomor WhatsApp dengan Format https://wa.me/62...
test('Chat WhatsApp langsung dari kolom nomor WhatsApp dengan link https://wa.me/62...', () => {
  assert(mainJs.includes('href="https://wa.me/${cleanPhone}?text=${waText}"'), 'Missing wa.me link with cleanPhone in main.js');
  assert(mainJs.includes('ppdb-wa-link'), 'Missing ppdb-wa-link class in main.js');

  // Public PPDB country code selector
  assert(html.includes('id="modalPhoneCountryCode"'), 'index.html missing #modalPhoneCountryCode');
  assert(html.includes('<option value="62" selected>🇮🇩 +62</option>'), 'Missing +62 default country code');
  assert(mainJs.includes("document.getElementById('modalPhoneCountryCode')?.value?.trim() || '62'"), 'main.js missing country code retrieval');
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
console.log(`========================================\n`);

if (passed !== total) {
  process.exit(1);
} else {
  console.log('🌟 All Kelola Akademik & PPDB enhancements verified successfully!');
}
