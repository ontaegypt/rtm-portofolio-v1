import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';

console.log('🧪 Testing Galeri Header 1-Row & WordPress Media Library Enhancements...\n');

const html = fs.readFileSync(path.resolve('./index.html'), 'utf8');
const css = fs.readFileSync(path.resolve('./src/style.css'), 'utf8');
const mainJs = fs.readFileSync(path.resolve('./src/main.js'), 'utf8');
const apiJs = fs.readFileSync(path.resolve('./server/api.js'), 'utf8');
const dbJs = fs.readFileSync(path.resolve('./server/db.js'), 'utf8');

// 1. Galeri Header Buttons
console.log('  1. Verifying Galeri & Kunjungan header action buttons...');
assert(html.includes('class="panel-header-actions galeri-header-actions"'), 'Missing .galeri-header-actions class in index.html');
assert(html.includes('id="btnOpenMediaLibrary"') && html.includes('Media Library'), 'btnOpenMediaLibrary must be renamed to Media Library');
assert(!html.includes('id="btnOpenMediaLibrary">Pustaka Media Bersama'), 'Old label "Pustaka Media Bersama" should be removed from button');
assert(html.includes('id="btnAddGalleryMedia"') && (html.includes('+ Tambah Media') || html.includes('Tambah Media')), 'btnAddGalleryMedia must be renamed to Tambah Media');
assert(!html.includes('+ Tambah Media Galeri'), 'Old label "+ Tambah Media Galeri" should be removed');
console.log('  ✅ [PASS] Button labels renamed to "Media Library" and "+ Tambah Media"');

// 2. Responsive 1-row Layout for galeri-header-actions
console.log('  2. Verifying responsive 1-row layout for .galeri-header-actions across desktop, tab, and mobile...');
assert(css.includes('.galeri-header-actions {') && css.includes('flex-direction: row !important;') && css.includes('flex-wrap: nowrap !important;'), 'Desktop rules for .galeri-header-actions must be flex row nowrap');

// iPad query
const ipadSection = css.slice(css.indexOf('@media (max-width: 1024px)'));
assert(ipadSection.includes('.galeri-header-actions {') && ipadSection.includes('flex-wrap: nowrap !important;'), 'iPad media query missing .galeri-header-actions flex nowrap rule');

// Mobile query
const mobileSection = css.slice(css.indexOf('@media (max-width: 768px)'));
assert(mobileSection.includes('.panel-header-actions.galeri-header-actions {') && mobileSection.includes('grid-template-columns: 1fr 1fr !important;'), 'Mobile media query missing 2-column grid rule for .galeri-header-actions');
console.log('  ✅ [PASS] .galeri-header-actions is strictly 1-row across desktop, iPad, and mobile');

// 3. WordPress-Style Media Library Modal Architecture
console.log('  3. Verifying WordPress-style Media Library modal components & navigation tabs...');
assert(html.includes('id="mediaLibraryPickerModal"'), 'Modal #mediaLibraryPickerModal exists');
assert(html.includes('id="wpTabBrowse"') && html.includes('id="wpTabUpload"'), 'Modal contains WordPress router tabs: Pustaka Media and Unggah Berkas Baru');
assert(html.includes('id="wpViewBrowse"') && html.includes('id="wpViewUpload"'), 'Modal contains separate views for browsing and uploading');
console.log('  ✅ [PASS] WordPress tabs (Pustaka Media & Unggah Berkas Baru) exist');

// 4. Dedicated Menus / Filters for Photos, Videos, and PDFs
console.log('  4. Verifying dedicated filters for Photo, Video, and PDF documents...');
assert(html.includes('data-type="all"') && html.includes('Semua Media'), 'Filter pill "Semua Media" exists');
assert(html.includes('data-type="image"') && html.includes('Foto / Gambar'), 'Filter pill "Foto / Gambar" exists');
assert(html.includes('data-type="video"') && html.includes('Video'), 'Filter pill "Video" exists');
assert(html.includes('data-type="pdf"') && html.includes('Dokumen (PDF)'), 'Filter pill "Dokumen (PDF)" exists');
assert(html.includes('id="wpMediaSearchInput"'), 'Search input #wpMediaSearchInput exists');
assert(html.includes('id="wpMediaCountBadge"'), 'Counter badge #wpMediaCountBadge exists');
console.log('  ✅ [PASS] Photo, Video, and PDF menu filters & search box verified');

// 5. Grid, Details Sidebar, and Bottom Selection Actions
console.log('  5. Verifying Media Library grid, attachment sidebar, and selection actions...');
assert(html.includes('id="mediaLibraryGridContainer"') && html.includes('id="mediaLibraryGrid"'), 'Both #mediaLibraryGridContainer and #mediaLibraryGrid exist');
assert(html.includes('id="wpMediaSidebar"'), 'Sidebar #wpMediaSidebar exists');
assert(html.includes('id="wpSidebarPreviewBox"') && html.includes('id="wpSidebarFileName"'), 'Sidebar preview and meta fields exist');
assert(html.includes('id="btnWpCopyUrl"') && html.includes('id="btnWpDeleteAsset"'), 'Sidebar contains copy URL and delete buttons');
assert(html.includes('id="btnApplyMediaSelection"'), 'Footer contains selection apply button #btnApplyMediaSelection');
console.log('  ✅ [PASS] Grid, attachment details sidebar, and apply buttons verified');

// 6. Upload Dropzone Supporting Photos, Videos, and PDFs
console.log('  6. Verifying upload form and dropzone for Photos, Videos, and PDFs...');
assert(html.includes('id="mediaLibraryUploadForm"'), 'Upload form #mediaLibraryUploadForm exists');
assert(html.includes('id="wpDropzoneBox"'), 'Dropzone #wpDropzoneBox exists');
assert(html.includes('id="mediaUploadFileInput"'), 'File input #mediaUploadFileInput exists');
assert(html.includes('id="mediaUploadAltText"'), 'Alt text input #mediaUploadAltText exists');
assert(apiJs.includes('video/mp4') && apiJs.includes('application/pdf'), 'Backend server/api.js supports video and PDF mimes');
assert(apiJs.includes('25 * 1024 * 1024'), 'Backend server/api.js permits 25MB media uploads');
console.log('  ✅ [PASS] Multi-format upload dropzone and backend API verified');

// 7. Academic Syllabus PDF Integration
console.log('  7. Verifying Academic Syllabus PDF Media Library integration...');
assert(html.includes('id="btnPickMediaForSyllabus"'), 'Syllabus form contains #btnPickMediaForSyllabus button');
assert(html.includes('id="syllabusPdfUrlInput"'), 'Syllabus form contains #syllabusPdfUrlInput');
assert(mainJs.includes('btnPickMediaForSyllabus') && mainJs.includes("'pdf'"), 'main.js wires btnPickMediaForSyllabus with pdf filter');
console.log('  ✅ [PASS] Syllabus form successfully integrates with Media Library PDF documents');

// 8. Academic Program & Gallery Media Integrations
console.log('  8. Verifying Academic Program & Gallery Media Library integrations...');
assert(html.includes('id="btnPickMediaForProgram"'), 'Academic Program form contains #btnPickMediaForProgram');
assert(html.includes('id="btnPickMediaForGallery"'), 'Gallery form contains #btnPickMediaForGallery');
assert(mainJs.includes('detectMediaType'), 'main.js contains detectMediaType function');
assert(mainJs.includes('silabus-smp-tahfidz-2026.pdf') && mainJs.includes('profil-pesantren-rtm.mp4'), 'Default assets list includes both PDF documents and MP4 videos');
assert(dbJs.includes('silabus-smp-tahfidz-2026.pdf') && dbJs.includes('profil-pesantren-rtm.mp4'), 'Database seed in db.js includes PDF and Video assets');
console.log('  ✅ [PASS] Cross-module integrations (Academic Program, Syllabus, Gallery) verified');

console.log('\n========================================');
console.log('Test Results: 8/8 Passed (100%)');
console.log('========================================\n');
console.log('🌟 All Media Library and Galeri header enhancements verified successfully!\n');
