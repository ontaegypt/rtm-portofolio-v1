import { api } from './server/api.js';
import { db } from './server/db.js';
import fs from 'node:fs';
import assert from 'node:assert';

console.log('🚀 Starting Comprehensive CMS Debug & Fix Verification...\n');

// 1. Verify Top Bar Button Removed
console.log('1️⃣ Checking index.html top bar for btnNavbarPPDB...');
const indexHtml = fs.readFileSync('./index.html', 'utf8');
assert(!indexHtml.includes('id="btnNavbarPPDB"'), 'btnNavbarPPDB must NOT exist in index.html');
console.log('   ✅ #btnNavbarPPDB successfully removed from navbar top bar.\n');

function callApi(method, pathWithQuery, body = undefined) {
  return new Promise((resolve, reject) => {
    let url = pathWithQuery;
    const query = {};
    if (url.includes('?')) {
      const [base, qs] = url.split('?');
      url = base;
      const searchParams = new URLSearchParams(qs);
      for (const [k, v] of searchParams.entries()) {
        query[k] = v;
      }
    }

    const req = {
      method: method.toUpperCase(),
      url,
      originalUrl: pathWithQuery,
      headers: { 'content-type': 'application/json' },
      body,
      query,
      params: {}
    };

    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      setHeader(name, val) {
        this.headers[name] = val;
        return this;
      },
      json(data) {
        resolve({ status: this.statusCode, data });
      },
      send(data) {
        resolve({ status: this.statusCode, data });
      },
      end() {
        resolve({ status: this.statusCode });
      }
    };

    api.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, data: { message: 'Not Found' } });
    });
  });
}

async function runTests() {
  // 2. Test Galeri Publication Status Debugging (Draft vs Published)
  console.log('2️⃣ Testing Galeri Publication Status Debugging & Database Persistence...');
  const testGalId = `gal-test-${Date.now()}`;
  db.prepare(`
    INSERT INTO galleries (id, title, category, album_name, media_type, media_url, alt_text, caption, sort_order, status, date)
    VALUES (?, 'Foto Uji Status', 'kegiatan_santri', 'Dokumentasi Utama', 'photo', '/assets/images/campus.jpg', 'Alt Uji', 'Caption Uji', 1, 'published', datetime('now'))
  `).run(testGalId);

  // Toggle to draft
  const draftRes = await callApi('PATCH', `/galleries/${testGalId}/toggle`, { status: 'draft' });
  assert.strictEqual(draftRes.status, 200);
  assert.strictEqual(draftRes.data.success, true);
  assert.strictEqual(draftRes.data.status, 'draft');

  // Verify in database
  const dbGalDraft = db.prepare('SELECT status FROM galleries WHERE id = ?').get(testGalId);
  assert.strictEqual(dbGalDraft.status, 'draft');
  console.log('   ✅ Galeri toggled to "draft" in SQLite database.');

  // Verify GET /galleries?status=published does NOT include this draft
  const publishedRes = await callApi('GET', '/galleries?status=published');
  assert.strictEqual(publishedRes.status, 200);
  const isPresentInPublished = publishedRes.data.data.some(g => g.id === testGalId);
  assert.strictEqual(isPresentInPublished, false, 'Draft gallery must not appear in published query');
  console.log('   ✅ Draft galeri is NOT shown in published filter.');

  // Toggle back to published
  const pubRes = await callApi('PATCH', `/galleries/${testGalId}/toggle`, { status: 'published' });
  assert.strictEqual(pubRes.status, 200);
  assert.strictEqual(pubRes.data.status, 'published');

  const dbGalPub = db.prepare('SELECT status FROM galleries WHERE id = ?').get(testGalId);
  assert.strictEqual(dbGalPub.status, 'published');
  console.log('   ✅ Galeri toggled back to "published" in SQLite database.\n');

  // Clean up test gallery
  db.prepare('DELETE FROM galleries WHERE id = ?').run(testGalId);

  // 3. Test Academic PPDB Status Column Toggle
  console.log('3️⃣ Testing Akademik PPDB Status Column Switch & Database Persistence...');
  const testProgId = 'smp';
  
  // Toggle SMP PPDB to closed (is_active: 0)
  const closeRes = await callApi('PATCH', `/programs/${testProgId}/toggle`, { is_active: 0 });
  assert.strictEqual(closeRes.status, 200);
  assert.strictEqual(closeRes.data.isActive, false);

  const dbProgClosed = db.prepare('SELECT is_active FROM academic_programs WHERE id = ?').get(testProgId);
  assert.strictEqual(dbProgClosed.is_active, 0);
  console.log('   ✅ PPDB status closed (is_active: 0) in SQLite database.');

  // Try to register for closed program -> should be rejected!
  const closedSubmitRes = await callApi('POST', '/ppdb', {
    program_id: testProgId,
    full_name: 'Santri Uji Tertutup',
    phone_whatsapp: '08123456789'
  });
  assert.strictEqual(closedSubmitRes.status, 400);
  assert(closedSubmitRes.data.message.includes('ditutup'), 'Must reject registration when PPDB is closed');
  console.log('   ✅ Public registration correctly blocked while PPDB status is closed.');

  // Reopen PPDB (is_active: 1)
  const openRes = await callApi('PATCH', `/programs/${testProgId}/toggle`, { is_active: 1 });
  assert.strictEqual(openRes.status, 200);
  assert.strictEqual(openRes.data.isActive, true);

  const dbProgOpen = db.prepare('SELECT is_active FROM academic_programs WHERE id = ?').get(testProgId);
  assert.strictEqual(dbProgOpen.is_active, 1);
  console.log('   ✅ PPDB status reopened (is_active: 1) in SQLite database.\n');

  // 4. Test Website Public Forms Connected to CMS Dashboard
  console.log('4️⃣ Testing Public Forms Integration with CMS Dashboard...');
  
  // 4A: PPDB Registration Form Submit
  const ppdbSubmitRes = await callApi('POST', '/ppdb', {
    program_id: 'smp',
    batch_id: 'Gelombang 1 - TA 2026/2027',
    full_name: 'Fatih Ahmad Al-Farisi',
    email: 'fatih@example.com',
    phone_whatsapp: '081298765432',
    gender: 'Laki-laki',
    birth_date: '2012-05-14',
    parent_name: 'Bpk. Ahmad Fauzi',
    info_source: 'Website Resmi',
    motivation: 'Menjadi hafidz 30 juz mutqin.',
    payment_method: 'Transfer Bank BSI',
    custom_answers: { 'Hafalan Saat Ini': '5 Juz' }
  });
  assert.strictEqual(ppdbSubmitRes.status, 201);
  assert.strictEqual(ppdbSubmitRes.data.success, true);
  assert(ppdbSubmitRes.data.id.startsWith('REG-'));
  console.log(`   ✅ PPDB form submitted successfully. Reg ID: ${ppdbSubmitRes.data.id}`);

  // Verify in GET /ppdb (CMS Dashboard table query)
  const ppdbListRes = await callApi('GET', '/ppdb');
  assert.strictEqual(ppdbListRes.status, 200);
  const foundInDashboard = ppdbListRes.data.data.find(l => l.id === ppdbSubmitRes.data.id);
  assert(foundInDashboard, 'Submitted lead must be in GET /ppdb for CMS table');
  assert.strictEqual(foundInDashboard.full_name, 'Fatih Ahmad Al-Farisi');
  assert.strictEqual(foundInDashboard.status, 'pending');
  console.log('   ✅ PPDB registration immediately appears in CMS Dashboard table (/ppdb).');

  // 4B: Tour Visit Reservation Form Submit
  const visitSubmitRes = await callApi('POST', '/reservations', {
    visitor_name: 'Ust. Burhanuddin',
    institution: 'Pesantren Al-Ikhlas Solo',
    email: 'burhan@alikhlas.sch.id',
    phone: '081333444555',
    visit_date: '2026-11-15',
    session_time: 'Sesi 1 (08.30 - 11.30 WIB)',
    visitor_count: 20,
    objective: 'Studi Banding Metode Tahfidz Modern'
  });
  assert.strictEqual(visitSubmitRes.status, 201);
  assert.strictEqual(visitSubmitRes.data.success, true);
  assert(visitSubmitRes.data.id.startsWith('vis-'));
  console.log(`   ✅ Visit Reservation form submitted successfully. Visit ID: ${visitSubmitRes.data.id}`);

  // Verify in GET /reservations (CMS Galeri & Kunjungan table query)
  const visitListRes = await callApi('GET', '/reservations');
  assert.strictEqual(visitListRes.status, 200);
  const foundVisit = visitListRes.data.data.find(v => v.id === visitSubmitRes.data.id);
  assert(foundVisit, 'Submitted reservation must be in GET /reservations for CMS table');
  assert.strictEqual(foundVisit.visitor_name, 'Ust. Burhanuddin');
  assert.strictEqual(foundVisit.status, 'pending');
  console.log('   ✅ Visit Reservation immediately appears in CMS Galeri & Kunjungan table.');

  // 4C: Confirm Visit in CMS Galeri & Kunjungan
  const confirmVisitRes = await callApi('PATCH', `/reservations/${visitSubmitRes.data.id}/status`, {
    status: 'confirmed'
  });
  assert.strictEqual(confirmVisitRes.status, 200);
  assert.strictEqual(confirmVisitRes.data.success, true);

  const dbVisitConfirmed = db.prepare('SELECT status FROM visit_reservations WHERE id = ?').get(visitSubmitRes.data.id);
  assert.strictEqual(dbVisitConfirmed.status, 'confirmed');
  console.log('   ✅ Visit Reservation status successfully approved/confirmed in database.\n');

  console.log('🎉 ALL INTEGRATION TESTS PASSED 100%!');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
