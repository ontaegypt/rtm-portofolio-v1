// test-tampilan-tabs-enhancements.mjs
// Automated verification suite for Dashboard Menu Tampilan WordPress-style pill tabs & save buttons

import fs from 'fs';
import path from 'path';
import assert from 'assert';

console.log('🧪 Testing Dashboard Menu Tampilan: WordPress-Style Tabs Navigation & Save Buttons...\n');

const htmlContent = fs.readFileSync(path.resolve('./index.html'), 'utf-8');
const cssContent = fs.readFileSync(path.resolve('./src/style.css'), 'utf-8');
const jsContent = fs.readFileSync(path.resolve('./src/main.js'), 'utf-8');

// 1. Verify WordPress-style Pill Tabs Navigation Structure
console.log('1. Verifying Tabs Navigation header & individual sub-routes in index.html...');
assert(htmlContent.includes('class="tampilan-tabs-wrapper"'), 'index.html must contain .tampilan-tabs-wrapper');
assert(htmlContent.includes('class="tampilan-tabs-nav"'), 'index.html must contain .tampilan-tabs-nav');
assert(htmlContent.includes('href="#admin-tampilan/identitas"'), 'Must have link to #admin-tampilan/identitas');
assert(htmlContent.includes('href="#admin-tampilan/kontak"'), 'Must have link to #admin-tampilan/kontak');
assert(htmlContent.includes('href="#admin-tampilan/beranda"'), 'Must have link to #admin-tampilan/beranda');
assert(htmlContent.includes('href="#admin-tampilan/footer"'), 'Must have link to #admin-tampilan/footer');
assert(htmlContent.includes('data-tab="identitas"'), 'Must have data-tab="identitas"');
assert(htmlContent.includes('data-tab="kontak"'), 'Must have data-tab="kontak"');
assert(htmlContent.includes('data-tab="beranda"'), 'Must have data-tab="beranda"');
assert(htmlContent.includes('data-tab="footer"'), 'Must have data-tab="footer"');
console.log('  ✅ [PASS] Tabs navigation bar and all 4 sub-routes verified.');

// 2. Verify Dedicated Tab Panels
console.log('2. Verifying 4 dedicated tab panels and input preservation...');
assert(htmlContent.includes('id="tab-content-identitas"'), 'Must contain #tab-content-identitas');
assert(htmlContent.includes('id="tab-content-kontak"'), 'Must contain #tab-content-kontak');
assert(htmlContent.includes('id="tab-content-beranda"'), 'Must contain #tab-content-beranda');
assert(htmlContent.includes('id="tab-content-footer"'), 'Must contain #tab-content-footer');

// Form input preservation checks
const requiredInputs = [
  'settingInstitutionName',
  'settingShortName',
  'settingTagline',
  'settingMudir',
  'settingLogoUrl',
  'btnPickMediaForLogo',
  'settingWhatsappPPDB',
  'settingWhatsappDonasi',
  'settingEmail',
  'settingAddress',
  'settingBankAccountInfo',
  'settingHeroTitle',
  'settingAboutSummary',
  'settingVision',
  'settingMission',
  'settingSocialInstagram',
  'settingSocialYoutube',
  'settingNavCtaLabel',
  'settingFooterCopyright'
];

for (const inputId of requiredInputs) {
  assert(htmlContent.includes(`id="${inputId}"`), `Input #${inputId} must be preserved`);
}
console.log('  ✅ [PASS] All 4 tab panels and all 19 form input controls verified.');

// 3. Verify Bottom Save Buttons in Each Tab
console.log('3. Verifying bottom save buttons in each tab...');
assert(htmlContent.includes('id="btnSaveTampilanIdentitas"'), 'Tab Identitas must have #btnSaveTampilanIdentitas');
assert(htmlContent.includes('id="btnSaveTampilanKontak"'), 'Tab Kontak must have #btnSaveTampilanKontak');
assert(htmlContent.includes('id="btnSaveTampilanBeranda"'), 'Tab Beranda must have #btnSaveTampilanBeranda');
assert(htmlContent.includes('id="btnSaveTampilanFooter"'), 'Tab Footer must have #btnSaveTampilanFooter');

// Check that buttons have class .btn-tampilan-save and are inside .tampilan-tab-footer
const footerCount = (htmlContent.match(/class="tampilan-tab-footer"/g) || []).length;
assert(footerCount >= 4, `Expected at least 4 .tampilan-tab-footer containers, found ${footerCount}`);
const saveBtnCount = (htmlContent.match(/btn-tampilan-save/g) || []).length;
assert(saveBtnCount >= 4, `Expected at least 4 .btn-tampilan-save buttons, found ${saveBtnCount}`);
console.log('  ✅ [PASS] Bottom save buttons and footers verified across all tabs.');

// 4. Verify CSS Specifications Matching Menu Akademik
console.log('4. Verifying button sizes & media queries matching Menu Akademik...');

// Desktop check
assert(cssContent.includes('.btn-tampilan-save') || cssContent.includes('.tampilan-tab-footer .btn'), 'CSS must define .btn-tampilan-save');
const desktopAkademikBtnMatch = cssContent.match(/\.akademik-header-actions \.btn\s*\{([^}]+)\}/);
assert(desktopAkademikBtnMatch, 'CSS must contain desktop .akademik-header-actions .btn rule');
assert(desktopAkademikBtnMatch[1].includes('height: 38px'), 'Akademik button height must be 38px');
assert(desktopAkademikBtnMatch[1].includes('font-size: 0.85rem'), 'Akademik button font-size must be 0.85rem');

const desktopTampilanBtnMatch = cssContent.match(/\.btn-tampilan-save\s*\{([^}]+)\}/) || cssContent.match(/\.tampilan-tab-footer \.btn,\s*\.btn-tampilan-save\s*\{([^}]+)\}/);
assert(desktopTampilanBtnMatch, 'CSS must contain desktop .btn-tampilan-save rule');
assert(desktopTampilanBtnMatch[1].includes('height: 38px'), 'btn-tampilan-save height must be 38px');
assert(desktopTampilanBtnMatch[1].includes('font-size: 0.85rem'), 'btn-tampilan-save font-size must be 0.85rem');
assert(desktopTampilanBtnMatch[1].includes('padding: 0.5rem 0.9rem'), 'btn-tampilan-save padding must match 0.5rem 0.9rem');

// iPad check (max-width: 1024px)
const ipadBlocks = Array.from(cssContent.matchAll(/@media\s*\([^{]*max-width:\s*1024px[^{]*\)\s*\{([\s\S]*?)(?=\n@media|$)/g)).map(m => m[1]).join('\n');
assert(ipadBlocks.includes('.btn-tampilan-save'), 'iPad media query must style .btn-tampilan-save');
assert(ipadBlocks.includes('height: 38px'), 'iPad .btn-tampilan-save height must be 38px');
assert(ipadBlocks.includes('font-size: 0.78rem'), 'iPad .btn-tampilan-save font-size must be 0.78rem');
assert(ipadBlocks.includes('padding: 0.45rem 0.65rem'), 'iPad .btn-tampilan-save padding must match');

// Mobile check (max-width: 768px)
const mobileBlocks = Array.from(cssContent.matchAll(/@media\s*\([^{]*max-width:\s*768px[^{]*\)\s*\{([\s\S]*?)(?=\n@media|$)/g)).map(m => m[1]).join('\n');
assert(mobileBlocks.includes('.btn-tampilan-save'), 'Mobile media query must style .btn-tampilan-save');
assert(mobileBlocks.includes('font-size: 0.72rem'), 'Mobile .btn-tampilan-save font-size must be 0.72rem');
assert(mobileBlocks.includes('padding: 0.45rem 0.35rem'), 'Mobile .btn-tampilan-save padding must match');
assert(mobileBlocks.includes('height: 38px'), 'Mobile .btn-tampilan-save height must be 38px');
assert(mobileBlocks.includes('width: 100%'), 'Mobile .btn-tampilan-save must be full width');

// Small Mobile check (max-width: 480px)
const smallMobileBlocks = Array.from(cssContent.matchAll(/@media\s*\([^{]*max-width:\s*480px[^{]*\)\s*\{([\s\S]*?)(?=\n@media|$)/g)).map(m => m[1]).join('\n');
assert(smallMobileBlocks.includes('.btn-tampilan-save'), 'Small mobile media query must style .btn-tampilan-save');
assert(smallMobileBlocks.includes('font-size: 0.68rem'), 'Small mobile .btn-tampilan-save font-size must be 0.68rem');
assert(smallMobileBlocks.includes('padding: 0.4rem 0.25rem'), 'Small mobile .btn-tampilan-save padding must match');
console.log('  ✅ [PASS] Button dimensions & media queries match Menu Akademik 100% across all 4 breakpoints.');

// 5. Verify WordPress Pill Tab Styling
console.log('5. Verifying pill tab capsule styling...');
assert(cssContent.includes('.tampilan-tabs-nav'), 'CSS must define .tampilan-tabs-nav');
assert(cssContent.includes('border-radius: 9999px'), 'Tabs must have capsule pill border-radius: 9999px');
assert(cssContent.includes('.tampilan-tab-btn.active'), 'CSS must define .tampilan-tab-btn.active');
console.log('  ✅ [PASS] Pill tab styling verified.');

// 6. Verify Router & Submodule Wiring in main.js
console.log('6. Verifying Router & JS Tab Switching Logic in main.js...');
assert(jsContent.includes('switchTampilanTab'), 'main.js must implement and export switchTampilanTab');
assert(jsContent.includes("'tampilan/identitas'"), 'main.js SUBMODULE_PARENTS must include tampilan/identitas');
assert(jsContent.includes("'tampilan/kontak'"), 'main.js SUBMODULE_PARENTS must include tampilan/kontak');
assert(jsContent.includes("'tampilan/beranda'"), 'main.js SUBMODULE_PARENTS must include tampilan/beranda');
assert(jsContent.includes("'tampilan/footer'"), 'main.js SUBMODULE_PARENTS must include tampilan/footer');
assert(jsContent.includes('btnSaveTampilanIdentitas'), 'main.js must wire #btnSaveTampilanIdentitas');
assert(jsContent.includes('btnSaveTampilanKontak'), 'main.js must wire #btnSaveTampilanKontak');
assert(jsContent.includes('btnSaveTampilanBeranda'), 'main.js must wire #btnSaveTampilanBeranda');
assert(jsContent.includes('btnSaveTampilanFooter'), 'main.js must wire #btnSaveTampilanFooter');
console.log('  ✅ [PASS] Router, submodule mappings, and tab switching logic verified.');

// 7. Verify Removal of Redundant Header Buttons
console.log('7. Verifying removal of header save, preview, and draft buttons...');
assert(!htmlContent.includes('id="btnPreviewSiteSettings"'), 'btnPreviewSiteSettings must be removed');
assert(!htmlContent.includes('id="btnSaveSettingsDraft"'), 'btnSaveSettingsDraft must be removed');
assert(!htmlContent.includes('id="btnSaveAppearanceSettings"'), 'btnSaveAppearanceSettings must be removed');
console.log('  ✅ [PASS] Obsolete header buttons successfully removed from DOM.');

// 8. Verify Gold Active Tab Color and Icon-Only Mobile Tabs
console.log('8. Verifying Gold Active Tab Color and Icon-Only Mobile Tabs...');
assert(cssContent.includes('.tampilan-tab-btn.active') && cssContent.includes('#d4a373'), 'Active tab must use gold color #d4a373');
assert(mobileBlocks.includes('.tampilan-tab-btn span') && mobileBlocks.includes('display: none'), 'Mobile tab buttons must hide text span to be icon-only');
console.log('  ✅ [PASS] Gold active tab (#d4a373) and icon-only mobile tabs verified.');

// 9. Verify Save Buttons Only Contain "Simpan"
console.log('9. Verifying Save Buttons text is strictly "Simpan"...');
const btnIdentitasMatch = htmlContent.match(/id="btnSaveTampilanIdentitas"[\s\S]*?<\/button>/)?.[0] || '';
const btnKontakMatch = htmlContent.match(/id="btnSaveTampilanKontak"[\s\S]*?<\/button>/)?.[0] || '';
const btnBerandaMatch = htmlContent.match(/id="btnSaveTampilanBeranda"[\s\S]*?<\/button>/)?.[0] || '';
const btnFooterMatch = htmlContent.match(/id="btnSaveTampilanFooter"[\s\S]*?<\/button>/)?.[0] || '';

assert(btnIdentitasMatch.includes('<span>Simpan</span>'), 'btnSaveTampilanIdentitas must contain <span>Simpan</span>');
assert(btnKontakMatch.includes('<span>Simpan</span>'), 'btnSaveTampilanKontak must contain <span>Simpan</span>');
assert(btnBerandaMatch.includes('<span>Simpan</span>'), 'btnSaveTampilanBeranda must contain <span>Simpan</span>');
assert(btnFooterMatch.includes('<span>Simpan</span>'), 'btnSaveTampilanFooter must contain <span>Simpan</span>');
assert(!btnIdentitasMatch.includes('<span>Simpan Identitas'), 'btnSaveTampilanIdentitas must not include tab name');
console.log('  ✅ [PASS] All tab save buttons contain only icon and "Simpan".');

console.log('\n========================================');
console.log('Test Results: All Tampilan Tabs Enhancements Passed (100%)');
console.log('========================================\n');
