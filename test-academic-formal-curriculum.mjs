import fs from 'node:fs';
import assert from 'node:assert';

console.log('🧪 Testing Academic Enhancements & Global Text Color Changes...\n');

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

// Test 1: Web keseluruhan teks hitam diubah menjadi #383838
test("Global dark text colors are configured to #383838", () => {
  assert(styleCss.includes("--primary-950: #383838;"), "Missing --primary-950: #383838;");
  assert(styleCss.includes("--text-dark: #383838;"), "Missing --text-dark: #383838;");
  assert(styleCss.includes("color: #383838;"), "Missing #383838 text color declarations");
  assert(!styleCss.includes("color: #1e1b4b;"), "Found leftover #1e1b4b in style.css");
});

// Test 2: Hero section spacing (header to hero, hero image to subheadline)
test("Jarak hero section dengan header dan hero image dengan subheadline diperlebar", () => {
  assert(styleCss.includes(".prog-hero-block {\n  padding: 6rem 0 6.5rem;"), "Desktop prog-hero-block top padding not expanded to 6rem");
  assert(styleCss.includes("margin-bottom: 1.25rem !important; /* Jarak antara hero image dengan subheadline */"), "Mobile hero visual missing margin-bottom spacing to subheadline");
});

// Test 3: Checklist lists downwards across Desktop, iPad, and Mobile
test("Checklist hero di desktop maupun ipad dan mobile melist ke bawah (flex-direction: column)", () => {
  const checklistIdx = styleCss.indexOf(".prog-hero-checklist {");
  const checklistBlock = styleCss.substring(checklistIdx, styleCss.indexOf("}", checklistIdx));
  assert(checklistBlock.includes("flex-direction: column !important;"), "Checklist is not flex column");
  assert(!checklistBlock.includes("grid-template-columns"), "Found grid-template-columns in prog-hero-checklist block");
});

// Test 4: Tombol Hubungi Kami disamakan ukurannya dengan tombol pendaftaran
test("Tombol 'Hubungi Kami' memiliki ukuran tinggi dan padding yang seragam dengan tombol pendaftaran", () => {
  assert(styleCss.includes(".prog-hero-buttons .btn {"), "Missing .prog-hero-buttons .btn sizing rule");
  assert(styleCss.includes("height: 46px;"), "Missing height: 46px on .prog-hero-buttons .btn");
  assert(styleCss.includes("border-radius: var(--radius-full, 9999px) !important;"), "Missing border-radius full on hero buttons");
});

// Test 5: Animasi accordion seperti meteran (pull & retract) dan auto-close accordion sisanya
test("Animasi accordion meteran (tapePullOut & tapeRetract) dan auto-close accordion sisanya", () => {
  // Check CSS keyframes
  assert(styleCss.includes("@keyframes tapePullOut"), "Missing @keyframes tapePullOut");
  assert(styleCss.includes("@keyframes tapeRetract"), "Missing @keyframes tapeRetract");
  assert(styleCss.includes(".curriculum-phase-item.tape-retracting .phase-card-body"), "Missing .tape-retracting rule");
  
  // Check JS auto-closing and tape-retracting logic
  assert(mainJs.includes("allOpenItems.forEach(openItem => {"), "Missing auto-close iteration on open accordion items");
  assert(mainJs.includes("openItem.classList.add('tape-retracting');"), "Missing tape-retracting trigger on closing accordion");
  assert(mainJs.includes("item.classList.add('open');"), "Missing open class addition on clicked accordion");
});

// Test 6: Section tertarik mendaftarkan ringkas tanpa kotak detail
test("Section tertarik mendaftarkan ringkas: tanpa kotak detail, headline singkat, paragraph, CTA button proporsional, & jam layanan", () => {
  assert(!mainJs.includes("cta-wa-features"), "Found leftover cta-wa-features kotak detail in main.js");
  assert(!mainJs.includes("cta-wa-feat-item"), "Found leftover cta-wa-feat-item in main.js");
  assert(mainJs.includes("Tertarik Mendaftarkan Putra / Putri Anda?"), "Missing concise headline");
  assert(mainJs.includes("Hubungi Kami via WhatsApp"), "Missing CTA WhatsApp button");
  assert(mainJs.includes("Layanan panitia aktif setiap hari kerja (08.00 - 16.00 WIB)"), "Missing active committee note");
});

console.log(`\n========================================`);
console.log(`Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
console.log(`========================================\n`);

if (passed === total) {
  console.log('🌟 All enhancements verified successfully!\n');
  process.exit(0);
} else {
  process.exit(1);
}
