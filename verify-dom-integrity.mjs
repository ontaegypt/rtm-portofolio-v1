import fs from 'node:fs';

const html = fs.readFileSync('index.html', 'utf-8');
const mainJs = fs.readFileSync('src/main.js', 'utf-8');

const requiredIds = [
  'ppdbModal',
  'btnClosePPDBModal',
  'modalPPDBForm',
  'stepIndicator1',
  'stepIndicator2',
  'stepIndicator3',
  'wizardStep1',
  'wizardStep2',
  'wizardStep3',
  'modalProgramId',
  'modalBatchId',
  'modalFullName',
  'modalGender',
  'modalBirthDate',
  'modalParentName',
  'modalPhone',
  'modalEmail',
  'modalPaymentMethod',
  'modalInfoSource',
  'modalMotivation',
  'btnNextToStep2',
  'btnBackToStep1',
  'btnNextToStep3',
  'btnBackToStep2',
  'btnSubmitModalPPDB',
  'ppdbSuccessModal',
  'receiptRegNumber',
  'receiptStudentName',
  'receiptGender',
  'receiptProgramName',
  'receiptBatch',
  'receiptParentName',
  'receiptPhone',
  'receiptPayment',
  'receiptDate',
  'receiptStatus',
  'btnConfirmWhatsappPPDB',
  'btnPrintPPDBReceipt',
  'btnCloseSuccessPPDB',
  'btnCloseSuccessPPDBBtn',
  'adminPPDBDetailModal',
  'dossierStudentName',
  'dossierRegId',
  'dossierDate',
  'dossierStatusPill',
  'dossierGender',
  'dossierBirthDate',
  'dossierProgram',
  'dossierBatch',
  'dossierParentName',
  'dossierPhone',
  'dossierPhoneLink',
  'dossierEmail',
  'dossierPayment',
  'dossierSource',
  'dossierMotivation',
  'dossierNotesInput',
  'btnDossierDelete',
  'btnDossierChatWA',
  'btnDossierSaveNotes',
  'btnDossierVerify',
  'btnDossierAccept',
  'btnDossierReject',
  'filterPPDBSearch',
  'filterPPDBProgram',
  'filterPPDBStatus',
  'btnExportPPDB',
  'adminPPDBCountBadge',
  'adminPPDBTableBody',
  'overviewPPDBTable',
  'btnNavbarPPDB'
];

console.log('🔍 Verifying DOM element integrity for Sprint 4...\n');
let missing = 0;
for (const id of requiredIds) {
  const exists = html.includes(`id="${id}"`) || html.includes(`id='${id}'`);
  if (!exists) {
    console.error(`  ❌ Missing ID in index.html: #${id}`);
    missing++;
  } else {
    console.log(`  ✅ Verified #${id}`);
  }
}

console.log(`\nDOM Integrity Check: ${requiredIds.length - missing}/${requiredIds.length} elements present.`);
if (missing > 0) {
  process.exit(1);
} else {
  console.log('🌟 100% DOM elements verified successfully!\n');
  process.exit(0);
}
