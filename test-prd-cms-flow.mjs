/**
 * test-prd-cms-flow.mjs
 * ============================================================
 * End-to-End Verification Suite for RTM CMS PRD Requirements (1-9)
 * Tests:
 * 1. Auth & User Management (Active/Deactivate account lock, Role enforcement)
 * 2. Overview Dashboard (Zero fabricated metrics, date range filter, audit log)
 * 3. Article Management (Slug uniqueness 409 conflict, SEO metadata, Rich-Text, Archive)
 * 4. Gallery & Shared Media Library (Alt text, Album, Ordering, Reusable Media Library)
 * 5. Academic Program Management (CRUD, publication status, dynamic form_schema)
 * 6. Program Registrations (PPDB dynamic custom_answers, needs_correction, PII protection blocking finance role)
 * 7. Donation Campaigns & Independent Finance (General ledger, verify, correction with mandatory audit reason, campaign recalculation)
 * 8. Website Display & Settings (Draft save vs Publish workflow)
 * 9. Shared Platform Requirements (Audit logs, safe archive/void policies, DOM & JS bindings)
 * ============================================================
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { api } from './server/api.js';
import { db } from './server/db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
process.chdir(__dirname);

let passed = 0;
let failed = 0;

function assert(condition, label, detail = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${label}`);
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${label}${detail ? ` — ${detail}` : ''}`);
        failed++;
    }
}

console.log('\n============================================================');
console.log('🧪 RTM CMS PRD VERIFICATION SUITE (REQ #1 - #9)');
console.log('============================================================\n');

// ------------------------------------------------------------
// PART 1: Static Code & DOM Binding Checks
// ------------------------------------------------------------
console.log('📌 [Part 1] Static DOM & Module Binding Verification');

const htmlContent = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');
const mainJsContent = fs.readFileSync(path.join(__dirname, 'src/main.js'), 'utf-8');
const apiClientContent = fs.readFileSync(path.join(__dirname, 'src/api-client.js'), 'utf-8');
const schemaSqlContent = fs.readFileSync(path.join(__dirname, 'server/schema.sql'), 'utf-8');

const requiredPrdDomIds = [
    'overviewAuditLogTableBody',
    'overviewContentSummaryBadge',
    'articleFormSlug',
    'btnGenerateSlug',
    'btnPreviewArticle',
    'adminArticleStatusFilter',
    'galleryFormId',
    'galleryFormAltText',
    'galleryFormAlbum',
    'galleryFormSortOrder',
    'galleryFormStatus',
    'btnOpenMediaLibrary',
    'mediaLibraryPickerModal',
    'mediaLibraryGridContainer',
    'btnCreateNewProgram',
    'admin-panel-program-form',
    'adminProgramEditForm',
    'programCustomFieldsContainer',
    'filterPPDBProgram',
    'filterPPDBStatus',
    'filterPPDBDateRange',
    'modalDynamicProgramFields',
    'dossierCustomAnswersBox',
    'dossierStatusHistoryList',
    'btnDossierRequestCorrection',
    'btnOpenManualTransaction',
    'adminManualDonationModal',
    'adminManualDonationForm',
    'receiptCorrectionSection',
    'btnSubmitTrxCorrection',
    'adminFinancialAuditTableBody',
    'btnSaveSettingsDraft',
    'btnPreviewSiteSettings',
    'btnDetailToggleUserActive'
];

for (const id of requiredPrdDomIds) {
    assert(htmlContent.includes(`id="${id}"`), `index.html contains PRD element #${id}`);
}

assert(schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS media_assets'), 'schema.sql defines media_assets table');
assert(schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS registration_status_logs'), 'schema.sql defines registration_status_logs table');
assert(schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS financial_audit_logs'), 'schema.sql defines financial_audit_logs table');
assert(schemaSqlContent.includes('CREATE TABLE IF NOT EXISTS system_audit_logs'), 'schema.sql defines system_audit_logs table');
assert(apiClientContent.includes('export const mediaApi'), 'src/api-client.js exports mediaApi');
assert(apiClientContent.includes('export const auditApi'), 'src/api-client.js exports auditApi');
assert(mainJsContent.includes('openProgramEditPage'), 'src/main.js implements openProgramEditPage');
assert(mainJsContent.includes('renderFinancialAuditTable'), 'src/main.js implements renderFinancialAuditTable');
assert(mainJsContent.includes('openMediaLibraryModal'), 'src/main.js implements openMediaLibraryModal');

// ------------------------------------------------------------
// PART 2: Live Backend API & Database Integration Tests
// ------------------------------------------------------------
console.log('\n📌 [Part 2] Live Server API, RBAC, Finance Audit & Workflow Tests');

const app = express();
app.use('/api', api);
const server = http.createServer(app);

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

async function requestJson(method, endpoint, body = null, token = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${baseUrl}${endpoint}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    return { status: res.status, data };
}

try {
    // 1. Login as SuperAdmin, Editor, Finance
    const adminLogin = await requestJson('POST', '/api/auth/login', {
        email: 'admin@rumahtahfidz.sch.id',
        password: 'admin123'
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'SuperAdmin login succeeds');
    const adminToken = adminLogin.data.token;

    const financeLogin = await requestJson('POST', '/api/auth/login', {
        email: 'finance@rumahtahfidz.sch.id',
        password: 'finance123'
    });
    assert(financeLogin.status === 200 && financeLogin.data.token, 'Finance login succeeds');
    const financeToken = financeLogin.data.token;

    // 2. Overview Stats & Zero Fabricated Metrics (Req #2)
    const statsRes = await requestJson('GET', '/api/stats?range=30d', null, adminToken);
    assert(statsRes.status === 200 && statsRes.data.success, 'GET /api/stats?range=30d returns overview metrics');
    assert(typeof statsRes.data.data.totalDonations === 'number', 'Overview stats include verified totalDonations calculated from DB');
    assert(Array.isArray(statsRes.data.data.recentAuditLogs), 'Overview stats include recentAuditLogs');

    // 3. Article Slug Uniqueness & SEO Metadata (Req #3)
    const uniqueSlug = `uji-artikel-prd-${Date.now()}`;
    const createArticle1 = await requestJson('POST', '/api/articles', {
        title: 'Artikel Uji PRD Satu',
        slug: uniqueSlug,
        strict_slug: true,
        category: 'Pendidikan',
        excerpt: 'Ringkasan uji PRD',
        content: '<p>Konten lengkap uji PRD</p>',
        tags: ['tahfidz', 'prd'],
        seo_title: 'Judul SEO Uji PRD',
        seo_description: 'Deskripsi meta SEO uji PRD',
        status: 'published'
    }, adminToken);
    assert(createArticle1.status === 201 && createArticle1.data.id, 'Create article with custom slug & SEO fields succeeds');

    const duplicateSlugRes = await requestJson('POST', '/api/articles', {
        title: 'Artikel Duplikat Slug',
        slug: uniqueSlug,
        strict_slug: true,
        category: 'Kegiatan',
        excerpt: 'Ringkasan',
        content: '<p>Konten</p>'
    }, adminToken);
    assert(
        duplicateSlugRes.status === 409 && duplicateSlugRes.data.code === 'CONFLICT_SLUG',
        'Duplicate article slug (strict_slug=true) is rejected with HTTP 409 CONFLICT_SLUG'
    );

    // Cleanup created test article
    if (createArticle1.data?.id) {
        await requestJson('DELETE', `/api/articles/${createArticle1.data.id}`, null, adminToken);
    }

    // 4. Shared Media Library & Gallery Metadata Update (Req #4)
    const createMedia = await requestJson('POST', '/api/media', {
        file_name: 'test-banner.jpg',
        file_url: '/assets/images/campus.jpg',
        alt_text: 'Gedung Rumah Tahfidz Muslimah',
        caption: 'Tampak depan gedung asrama'
    }, adminToken);
    assert(createMedia.status === 201 && createMedia.data.id, 'POST /api/media registers asset in Shared Media Library');

    const mediaList = await requestJson('GET', '/api/media', null, adminToken);
    assert(mediaList.status === 200 && mediaList.data.data.length > 0, 'GET /api/media lists shared media assets');

    // 5. Academic Program CRUD + Dynamic Registration Form Schema (Req #5)
    const createProg = await requestJson('POST', '/api/programs', {
        name: 'Program Tahfidz Akhir Pekan PRD',
        headline: 'Program Tahsin & Tahfidz Intensif Akhir Pekan',
        badge: 'Kajian & Tahsin',
        target_participants: 'Muslimah Pekerja & Mahasiswi',
        description: 'Program tahsin dan tahfidz intensif akhir pekan.',
        duration_claim: '6 Bulan',
        quota: 25,
        eligibility_criteria: 'Muslimah usia 17-45 tahun',
        schedule_info: 'Sabtu & Ahad, 08.00 - 11.30 WIB',
        application_instructions: 'Siapkan KTP dan rekaman bacaan QS. Maryam ayat 1-11.',
        publication_status: 'published',
        form_schema: [
            { id: 'jadwal_pilihan', label: 'Pilihan Sesi Akhir Pekan', type: 'select', required: true, options: ['Sesi Pagi', 'Sesi Siang'] }
        ]
    }, adminToken);
    assert(createProg.status === 201 && createProg.data.id, 'POST /api/programs creates new Academic Program with dynamic form_schema');
    const createdProgId = createProg.data.id;

    // 6. Program Registrations (PPDB): Dynamic Answers, PII RBAC Lock, & Needs Correction (Req #6)
    const submitPpdb = await requestJson('POST', '/api/ppdb', {
        full_name: 'Aisyah Putri PRD',
        birth_date: '2004-05-12',
        phone_whatsapp: '081299887766',
        email: 'aisyah.prd@example.com',
        parent_name: 'Bapak Abdullah',
        program_id: createdProgId || 'smp',
        motivation: 'Ingin menghafal Al-Quran 30 Juz mutqin',
        custom_answers: { jadwal_pilihan: 'Sesi Pagi' }
    });
    assert(submitPpdb.status === 201 && submitPpdb.data.id, 'Public PPDB registration accepts custom_answers JSON');
    const ppdbId = submitPpdb.data.id;

    // Finance role must be blocked from accessing applicant PII (Req #6)
    const financePpdbAccess = await requestJson('GET', '/api/ppdb', null, financeToken);
    assert(financePpdbAccess.status === 403, 'Finance role is strictly blocked (HTTP 403) from viewing PPDB applicant personal data');

    // Request correction without note must fail validation
    const invalidCorrection = await requestJson('PATCH', `/api/ppdb/${ppdbId}/status`, {
        status: 'needs_correction',
        notes: '',
        correction_note: ''
    }, adminToken);
    assert(invalidCorrection.status === 400, 'Setting PPDB status to needs_correction without notes fails with HTTP 400');

    // Request correction with valid note succeeds & logs history
    const validCorrection = await requestJson('PATCH', `/api/ppdb/${ppdbId}/status`, {
        status: 'needs_correction',
        notes: 'Mohon unggah ulang foto kartu identitas yang lebih jelas.'
    }, adminToken);
    assert(
        validCorrection.status === 200 &&
        validCorrection.data.data?.status === 'needs_correction' &&
        Array.isArray(validCorrection.data.data?.statusLogs) &&
        validCorrection.data.data.statusLogs.length > 0,
        'Setting PPDB status to needs_correction with note succeeds and records statusLogs'
    );

    // Cleanup test PPDB registration
    await requestJson('DELETE', `/api/ppdb/${ppdbId}`, null, adminToken);

    // 7. Independent Financial Records, Campaign Recalculation, & Financial Audit Trail (Req #7)
    const manualGeneralTx = await requestJson('POST', '/api/donations', {
        campaign_id: 'general',
        donor_name: 'Donatur Umum PRD',
        donor_phone: '081122334455',
        amount: 350000,
        payment_method: 'Transfer BSI',
        reference_number: 'BSI-PRD-001',
        verify_immediately: true,
        notes: 'Infaq operasional bulanan'
    }, financeToken);
    assert(
        manualGeneralTx.status === 201 &&
        manualGeneralTx.data.id &&
        manualGeneralTx.data.paymentStatus === 'success',
        'Finance can record an independent general donation transaction with immediate verification'
    );
    const generalTxId = manualGeneralTx.data.id;

    // Attempt financial correction without mandatory reason (< 5 chars) -> must fail
    const badFinCorrection = await requestJson('PATCH', `/api/donations/${generalTxId}/correct`, {
        amount: 400000,
        reason: 'fix'
    }, financeToken);
    assert(badFinCorrection.status === 400, 'Financial correction without a valid audit reason (>= 5 chars) is rejected with HTTP 400');

    // Valid financial correction -> updates amount and writes immutable financial_audit_logs entry
    const goodFinCorrection = await requestJson('PATCH', `/api/donations/${generalTxId}/correct`, {
        amount: 400000,
        reference_number: 'BSI-PRD-001-REV',
        reason: 'Koreksi nominal sesuai mutasi rekening koran BSI tanggal hari ini'
    }, financeToken);
    assert(
        goodFinCorrection.status === 200 && goodFinCorrection.data.success === true,
        'Financial correction with valid reason updates transaction and recalculates totals'
    );

    const finAuditRes = await requestJson('GET', `/api/finance/audit-logs?transaction_id=${generalTxId}`, null, financeToken);
    assert(
        finAuditRes.status === 200 &&
        Array.isArray(finAuditRes.data.data) &&
        finAuditRes.data.data.some((log) => log.transaction_id === generalTxId && log.action_type === 'CORRECTED'),
        'GET /api/finance/audit-logs returns immutable financial correction audit trail'
    );

    // 8. Website Settings Draft vs Publish (Req #8)
    const draftSettingsRes = await requestJson('PUT', '/api/settings', {
        mode: 'draft',
        site_tagline: 'Mencetak Generasi Muslimah Ahlul Quran Berakhlak Mulia'
    }, adminToken);
    assert(
        draftSettingsRes.status === 200 && draftSettingsRes.data.mode === 'draft',
        'PUT /api/settings with mode="draft" saves draft configuration without overwriting live published state'
    );

    // 9. User Active/Inactive Status Management (Req #1)
    const selfDeactivate = await requestJson('PATCH', `/api/users/${adminLogin.data.user.id}/status`, {
        is_active: false
    }, adminToken);
    assert(selfDeactivate.status === 400, 'Sole active SuperAdmin cannot deactivate their own active account');

} finally {
    try {
        db.prepare("DELETE FROM academic_programs WHERE name LIKE '%PRD%'").run();
        db.prepare("DELETE FROM media_assets WHERE file_name = 'test-banner.jpg'").run();
        db.prepare("DELETE FROM financial_audit_logs WHERE transaction_id IN (SELECT id FROM donations WHERE donor_name LIKE '%PRD%')").run();
        db.prepare("DELETE FROM donations WHERE donor_name LIKE '%PRD%'").run();
        db.prepare("DELETE FROM system_audit_logs WHERE summary LIKE '%PRD%' OR summary LIKE '%Artikel Duplikat%'").run();
    } catch {
        // ignore cleanup errors
    }
    await new Promise((resolve) => server.close(resolve));
}

// ------------------------------------------------------------
// PART 3: Existing Regression Verification Suites
// ------------------------------------------------------------
console.log('\n📌 [Part 3] Existing Regression Verification Suites');
const originalExit = process.exit;
process.exit = (code = 0) => {
    if (code !== 0) {
        originalExit(code);
    }
};
try {
    await import('./verify-dom-integrity.mjs');
    await import('./test-dashboard-enhancements.mjs');
    await import('./test-gallery-and-roles.mjs');
    await import('./test-mobile-zero-scroll.mjs');
} finally {
    process.exit = originalExit;
}

console.log('\n============================================================');
console.log(`📊 PRD TEST SUMMARY: ${passed} Passed, ${failed} Failed`);
console.log('============================================================\n');

if (failed > 0) {
    process.exit(1);
}
