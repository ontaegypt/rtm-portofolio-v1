import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Testing Academic Latest Enhancements (5 Requirements)...\n');

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
const styleCss = fs.readFileSync('src/style.css', 'utf-8');
const indexHtml = fs.readFileSync('index.html', 'utf-8');

// Test 1: [Halaman akademik keseluruhan] Animasi accordion bukan hanya teksnya, tapi kotaknya juga dianimasikan
test("Animasi accordion pada kotaknya (.curriculum-phase-card) dengan cardTapePull & cardTapeRetract", () => {
  assert(styleCss.includes(".curriculum-phase-item.open .curriculum-phase-card {"), "Missing .curriculum-phase-item.open .curriculum-phase-card rule");
  assert(styleCss.includes("animation: cardTapePull"), "Missing cardTapePull animation on phase card");
  assert(styleCss.includes(".curriculum-phase-item.tape-retracting .curriculum-phase-card {"), "Missing .curriculum-phase-item.tape-retracting .curriculum-phase-card rule");
  assert(styleCss.includes("animation: cardTapeRetract"), "Missing cardTapeRetract animation on phase card");
  assert(styleCss.includes("@keyframes cardTapePull"), "Missing @keyframes cardTapePull definition");
  assert(styleCss.includes("@keyframes cardTapeRetract"), "Missing @keyframes cardTapeRetract definition");
  assert(styleCss.includes("transform-origin: top center;"), "Missing transform-origin top center on curriculum-phase-card");
});

// Test 2: [Mobile version] Section alur pendaftaran bergaris putus-putus dan nomor berwarna ungu sesuai color palette
test("Mobile version section alur pendaftaran nomor dan garis berwarna ungu (#811ce5) sesuai palette", () => {
  assert(styleCss.includes(".stepper-node:not(:last-child)::before"), "Missing vertical connecting line ::before pseudo-element");
  assert(styleCss.includes("border-left: 2px dashed #811ce5"), "Missing purple dashed line connector style");
  assert(styleCss.includes("background: #ffffff !important;"), "Stepper circle on mobile not white");
  assert(styleCss.includes("color: #811ce5 !important;"), "Stepper circle number on mobile not purple #811ce5");
  assert(mainJs.includes('<div class="stepper-node-content">'), "Missing stepper-node-content wrapper in main.js");
  assert(styleCss.includes(".stepper-node-content {"), "Missing .stepper-node-content styling in style.css");
});

// Test 3: [Tablet version] Image di hero section berada di atas tulisan sama seperti mobile version
test("Image di hero section pada versi tablet/iPad (max-width: 1024px) berada di atas tulisan (order: 1)", () => {
  const query1024Idx = styleCss.indexOf("@media (max-width: 1024px)");
  assert(query1024Idx !== -1, "Missing @media (max-width: 1024px)");
  const query1024Block = styleCss.substring(query1024Idx, styleCss.indexOf("@media (max-width: 768px)", query1024Idx));
  assert(query1024Block.includes(".prog-hero-visual {"), "Missing .prog-hero-visual in 1024px query");
  assert(query1024Block.includes("order: 1 !important;"), "prog-hero-visual is not order: 1 in 1024px query");
  assert(query1024Block.includes(".prog-hero-content {"), "Missing .prog-hero-content in 1024px query");
  assert(query1024Block.includes("order: 2 !important;"), "prog-hero-content is not order: 2 in 1024px query");
});

// Test 4: Section tantangan zaman hanya ada di program non formal
test("Section tantangan zaman (prog-why-block) hanya dirender pada program non formal (!isFormal)", () => {
  assert(mainJs.includes("<!-- BLOCK 3: Kenapa Belajar Al-Qur'an (Problem & Solution Cards) - Khusus Program Non-Formal -->"), "Missing non-formal block 3 comment");
  assert(mainJs.includes("${!isFormal ? `"), "Tantangan zaman is not wrapped in !isFormal conditional");
});

// Test 5: [Halaman akademik non formal] Metode pembayaran lebih jelas dan respon pop up kirim invoice ke email
test("Metode pembayaran lebih jelas (Transfer BSI, VA, Cicilan) dan pop up notifikasi invoice terkirim ke email", () => {
  // Clear payment cards
  assert(mainJs.includes('class="payment-radio-card"'), "Missing rich payment-radio-card in main.js");
  assert(mainJs.includes('Transfer Bank BSI'), "Missing Transfer Bank BSI card");
  assert(mainJs.includes('Virtual Account (VA)'), "Missing Virtual Account card");
  assert(mainJs.includes('Angsuran / Cicilan Bertahap'), "Missing Cicilan Bertahap card");
  assert(mainJs.includes('class="payment-method-email-note"'), "Missing email notification note in form");
  
  // Styles for payment cards
  assert(styleCss.includes(".payment-radio-card {"), "Missing .payment-radio-card CSS");
  assert(styleCss.includes(".payment-method-email-note {"), "Missing .payment-method-email-note CSS");
  
  // Response popup email notification
  assert(indexHtml.includes('id="receiptTargetEmail"'), "Missing receiptTargetEmail span in index.html");
  assert(indexHtml.includes('Bukti Registrasi & Invoice Telah Dikirim ke Email'), "Missing email notice text in index.html receipt-email-alert");
  assert(mainJs.includes("receiptTargetEmail"), "Missing receiptTargetEmail population in main.js");
  assert(mainJs.includes("Bukti registrasi dan invoice pembayaran telah dikirim ke email Anda"), "Missing email toast notification");
});

// Test 6: [Halaman akademik seluruhnya] Hero section berjarak ke section setelahnya (desktop & tab ~78-80vh, mobile untouched)
test("Hero section berjarak ke section setelahnya (desktop & tab), mobile tidak diubah", () => {
  // Desktop
  assert(styleCss.includes("min-height: calc(80vh - var(--header-height, 80px));"), "Missing desktop min-height on prog-hero-block");
  assert(styleCss.includes("margin-bottom: 3.5rem;"), "Missing desktop margin-bottom on prog-hero-block");
  
  // Tablet
  const query1024Idx = styleCss.indexOf("@media (max-width: 1024px)");
  const query1024Block = styleCss.substring(query1024Idx, styleCss.indexOf("@media (max-width: 768px)", query1024Idx));
  assert(query1024Block.includes("min-height: calc(78vh - var(--header-height, 75px)) !important;"), "Missing tablet min-height in 1024px query");
  assert(query1024Block.includes("margin-bottom: 3.5rem !important;"), "Missing tablet margin-bottom in 1024px query");

  // Mobile (untouched/compact)
  const query768Idx = styleCss.indexOf("@media (max-width: 768px)");
  const query768Block = styleCss.substring(query768Idx);
  assert(query768Block.includes("min-height: auto !important;"), "Mobile hero should have min-height: auto");
  assert(query768Block.includes("margin-bottom: 0 !important;"), "Mobile hero should have margin-bottom: 0");
});

// Test 7: Section tertarik mendaftar memiliki warna & style seperti section 'siap membina putri' di home
test("Section tertarik mendaftar memiliki warna & style dark luxury seperti section 'siap membina putri'", () => {
  assert(styleCss.includes("background: radial-gradient(circle at 82% 50%, rgba(37, 99, 235, 0.16) 0%, rgba(15, 10, 34, 0) 65%), #151518;"), "cta-wa-card does not match home cta-daftar-card background");
  assert(styleCss.includes("border: 1px solid rgba(255, 255, 255, 0.08);"), "cta-wa-card missing border");
  assert(styleCss.includes("box-shadow: 0 24px 55px -15px rgba(0, 0, 0, 0.45);"), "cta-wa-card missing shadow");
  assert(styleCss.includes(".cta-wa-card::before {"), "cta-wa-card missing ::before glow");
  assert(styleCss.includes("color: #ffffff;"), "cta-wa-title is not white");
  assert(styleCss.includes("color: rgba(255, 255, 255, 0.82);"), "cta-wa-desc is not light text");
});

// Test 8: [Formal Program] Tombol CTA pada section tertarik mendaftar sama besar dengan tombol download syllabus
test("Tombol CTA tertarik mendaftar sama besar dengan tombol download syllabus (padding: 0.85rem 2rem)", () => {
  const dlBtnIdx = styleCss.indexOf(".curriculum-download-footer .btn {");
  const dlBtnBlock = styleCss.substring(dlBtnIdx, styleCss.indexOf("}", dlBtnIdx));
  assert(dlBtnBlock.includes("padding: 0.85rem 2rem;"), "Missing padding: 0.85rem 2rem on download syllabus button");

  const ctaBtnIdx = styleCss.indexOf(".btn-cta-wa {");
  const ctaBtnBlock = styleCss.substring(ctaBtnIdx, styleCss.indexOf("}", ctaBtnIdx));
  assert(ctaBtnBlock.includes("padding: 0.85rem 2rem !important;"), "btn-cta-wa desktop padding does not match download syllabus button");

  const mobileCtaIdx = styleCss.lastIndexOf(".btn-cta-wa {");
  const mobileCtaBlock = styleCss.substring(mobileCtaIdx, styleCss.indexOf("}", mobileCtaIdx));
  assert(mobileCtaBlock.includes("padding: 0.85rem 1.25rem !important;"), "btn-cta-wa mobile padding does not match download syllabus mobile padding");
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
console.log(`========================================\n`);

if (passed === total) {
  console.log('🌟 All 5 requirements successfully verified!\n');
  process.exit(0);
} else {
  process.exit(1);
}
