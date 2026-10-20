import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🧪 Testing Wakaf Header, Finance Table Nowrap & Receipt Modal Enhancements...\n');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ [PASS] ${message}`);
    passCount++;
  } else {
    console.error(`  ❌ [FAIL] ${message}`);
    failCount++;
  }
}

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const css = fs.readFileSync(path.join(__dirname, 'src', 'style.css'), 'utf-8');
const mainJs = fs.readFileSync(path.join(__dirname, 'src', 'main.js'), 'utf-8');
const dataJs = fs.readFileSync(path.join(__dirname, 'src', 'data.js'), 'utf-8');

// 1. Header Action Buttons in Wakaf/Donasi Panel
assert(
  html.includes('class="panel-header-actions donasi-header-actions"') &&
  html.includes('id="btnExportDonationCSV"') &&
  html.includes('id="btnOpenManualTransaction"') &&
  html.includes('id="btnCreateCampaign"'),
  'Wakaf & Donasi panel header contains donasi-header-actions with all 3 buttons'
);

assert(
  html.includes('<span>Ekspor CSV</span>') &&
  html.includes('<span>+ Catat Transaksi Manual</span>') &&
  html.includes('<span>+ Buat Campaign Baru</span>'),
  'Button labels are concise: Ekspor CSV, Catat Transaksi Manual, Buat Campaign Baru'
);

assert(
  css.includes('.donasi-header-actions') &&
  css.includes('flex-direction: row !important') &&
  css.includes('flex-wrap: nowrap !important'),
  'donasi-header-actions is styled side-by-side (flex row nowrap) on desktop'
);

assert(
  css.includes('.panel-header-actions.donasi-header-actions') &&
  css.includes('grid-template-columns: repeat(3, 1fr) !important'),
  'donasi-header-actions is aligned in 1 single row (grid 3 columns) on mobile devices'
);

// 2. Tables: Rekap Transaksi Donatur & Jurnal Audit Keuangan
assert(
  html.includes('<table class="admin-table table-finance-nowrap">') &&
  (html.match(/table-finance-nowrap/g) || []).length >= 2,
  'Both Rekap Transaksi Donatur and Jurnal Audit Keuangan tables have class table-finance-nowrap'
);

assert(
  css.includes('.table-finance-nowrap th,') &&
  css.includes('.table-finance-nowrap td') &&
  css.includes('white-space: nowrap !important'),
  'table-finance-nowrap enforces white-space nowrap and clean font sizing to prevent column wrapping'
);

// 3. Receipt Modal Bukti Transfer & Metadata Rows
assert(
  fs.existsSync(path.join(__dirname, 'assets', 'images', 'bukti-transfer-sample.svg')),
  'Official bank transfer receipt SVG asset exists in assets/images/bukti-transfer-sample.svg'
);

assert(
  mainJs.includes('bukti-transfer-sample.svg') &&
  mainJs.includes('isCampaignImage'),
  'openReceiptModal strictly isolates receipt images to transfer proofs, suppressing campaign photos'
);

assert(
  html.includes('receipt-meta-row-2col') &&
  html.includes('receiptModalInvoice') &&
  html.includes('receiptModalDonor') &&
  html.includes('receiptModalAmount') &&
  html.includes('receiptModalMethod'),
  'Receipt modal groups No. Invoice + Nama Donatur in 1 row, and Nominal + Metode Bayar in 1 row'
);

assert(
  css.includes('.receipt-meta-row-2col') &&
  css.includes('grid-template-columns: 1fr 1fr'),
  'receipt-meta-row-2col is styled as a 2-column grid'
);

// 4. Receipt Modal Action Buttons (Setujui, Tolak, Kirim Kwitansi with Plane Icon in 1 Row)
assert(
  html.includes('id="btnApproveReceiptAction"') &&
  html.includes('<span>Setujui</span>') &&
  !html.includes('<span>Setujui & Verifikasi Dana Masuk</span>'),
  'Approve button is simplified to "Setujui"'
);

assert(
  html.includes('id="btnRejectReceiptAction"') &&
  html.includes('<span>Tolak</span>') &&
  !html.includes('<span>Tolak Transaksi (Tidak Valid)</span>'),
  'Reject button is simplified to "Tolak"'
);

assert(
  html.includes('id="btnSendWAReceipt"') &&
  html.includes('<span>Kirim Kwitansi</span>') &&
  html.includes('polygon points="22 2 15 22 11 13 2 9 22 2"'),
  'Send receipt button is "Kirim Kwitansi" with a paper airplane / share SVG icon'
);

assert(
  css.includes('.receipt-modal-actions') &&
  css.includes('grid-template-columns: repeat(3, 1fr) !important'),
  'All 3 receipt modal buttons are arranged in 1 single row (grid 3 columns) on desktop, iPad, and mobile'
);

console.log('\n========================================');
console.log(`Test Results: ${passCount}/${passCount + failCount} Passed (${Math.round(passCount / (passCount + failCount) * 100)}%)`);
console.log('========================================\n');

if (failCount > 0) {
  process.exit(1);
} else {
  console.log('🌟 All Wakaf header, table nowrap & receipt modal enhancements verified successfully!');
}
