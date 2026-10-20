import assert from 'node:assert';
import { api } from './server/api.js';
import { db } from './server/db.js';

console.log('🧪 Testing Academic Programs API (Fix for 404 on create/edit)...\n');

function callRoute(method, urlPath, body = null) {
  return new Promise((resolve) => {
    let statusCode = 200;
    let responseData = null;

    const req = {
      method,
      url: urlPath,
      originalUrl: urlPath,
      baseUrl: '',
      path: urlPath.split('?')[0],
      query: {},
      params: {},
      headers: {
        authorization: 'Bearer mock-superadmin-token',
        'content-type': 'application/json'
      },
      body: body || {},
      user: { id: 'admin-1', name: 'Super Admin', role: 'superadmin' }
    };

    const res = {
      statusCode: 200,
      status(code) {
        statusCode = code;
        this.statusCode = code;
        return this;
      },
      json(data) {
        responseData = data;
        resolve({ status: statusCode, body: data });
        return this;
      },
      send(data) {
        responseData = data;
        resolve({ status: statusCode, body: data });
        return this;
      },
      setHeader() { return this; },
      end(data) {
        if (!responseData && data) responseData = data;
        resolve({ status: statusCode, body: responseData });
      }
    };

    api.handle(req, res, (err) => {
      if (err) {
        resolve({ status: 500, body: { error: err.message } });
      } else {
        resolve({ status: 404, body: { message: 'Route Not Handled' } });
      }
    });
  });
}

let passed = 0;
let total = 0;

async function test(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ [PASS] ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ [FAIL] ${name}: ${err.message}`);
  }
}

async function run() {
  // Test 1: GET /programs returns list of academic programs
  await test('GET /programs returns 200 and list of programs', async () => {
    const res = await callRoute('GET', '/programs');
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}`);
    assert(res.body.success, 'Expected success: true');
    assert(Array.isArray(res.body.data), 'Expected data to be array');
    assert(res.body.data.length > 0, 'Expected at least 1 program');
  });

  // Test 2: POST /programs creates new program with field aliases (title, subtitle, duration)
  const testProgId = `test-prog-${Date.now()}`;
  await test('POST /programs with title & subtitle aliases creates new program successfully', async () => {
    const payload = {
      id: testProgId,
      title: 'Program Uji Coba Otomatis',
      subtitle: 'Headline program uji coba kurikulum mutqin',
      category: 'formal',
      duration: '2 Tahun',
      hero_image: '/assets/images/classroom.jpg',
      eligibility_criteria: 'Lulusan SD',
      schedule_info: 'Senin - Jumat',
      application_instructions: 'Daftar online',
      form_schema: [{ label: 'Asal Sekolah', type: 'text', required: true }]
    };

    const res = await callRoute('POST', '/programs', payload);
    assert([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success, 'Expected success: true');
    assert(res.body.id === testProgId || res.body.slug, 'Expected returned id or slug');

    // Verify program exists in database
    const inDb = db.prepare('SELECT * FROM academic_programs WHERE id = ? OR slug = ?').get(testProgId, testProgId);
    assert(inDb, 'Program should exist in academic_programs table');
    assert.strictEqual(inDb.name, 'Program Uji Coba Otomatis');
    assert.strictEqual(inDb.headline, 'Headline program uji coba kurikulum mutqin');
  });

  // Test 3: PUT /programs/:id updates existing program without 404
  await test('PUT /programs/:id successfully updates program details', async () => {
    const updatePayload = {
      title: 'Program Uji Coba Otomatis (Revisi)',
      subtitle: 'Headline yang sudah diperbarui',
      duration: '3 Tahun',
      quota: 40
    };

    const res = await callRoute('PUT', `/programs/${testProgId}`, updatePayload);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success, 'Expected success: true');

    const inDb = db.prepare('SELECT * FROM academic_programs WHERE id = ?').get(testProgId);
    assert.strictEqual(inDb.name, 'Program Uji Coba Otomatis (Revisi)');
    assert.strictEqual(inDb.headline, 'Headline yang sudah diperbarui');
    assert.strictEqual(inDb.duration_claim, '3 Tahun');
  });

  // Test 4: PUT /programs/:id with a non-existent ID auto-upserts and NEVER returns 404
  const brandNewId = `brand-new-prog-${Date.now()}`;
  await test('PUT /programs/:id with non-existent ID auto-upserts without 404', async () => {
    const payload = {
      title: 'Program Auto Upsert Test',
      subtitle: 'Program yang baru dibuat via PUT',
      category: 'non_formal',
      duration: '1 Tahun'
    };

    const res = await callRoute('PUT', `/programs/${brandNewId}`, payload);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success, 'Expected success: true');

    const inDb = db.prepare('SELECT * FROM academic_programs WHERE id = ?').get(brandNewId);
    assert(inDb, 'Program should be automatically created in database');
    assert.strictEqual(inDb.name, 'Program Auto Upsert Test');
  });

  // Test 5: POST /programs with existing id updates cleanly without duplicate key error
  await test('POST /programs with already existing id updates gracefully', async () => {
    const payload = {
      id: testProgId,
      title: 'Program Uji Coba Otomatis (Updated via POST)',
      subtitle: 'Updated via POST idempotently'
    };

    const res = await callRoute('POST', '/programs', payload);
    assert([200, 201].includes(res.status), `Expected 200 or 201, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success, 'Expected success: true');

    const inDb = db.prepare('SELECT * FROM academic_programs WHERE id = ?').get(testProgId);
    assert.strictEqual(inDb.name, 'Program Uji Coba Otomatis (Updated via POST)');
  });

  // Test 6: PATCH /programs/:id/toggle toggles status without 404
  await test('PATCH /programs/:id/toggle toggles status without 404', async () => {
    const res = await callRoute('PATCH', `/programs/${testProgId}/toggle`);
    assert.strictEqual(res.status, 200, `Expected 200, got ${res.status}: ${JSON.stringify(res.body)}`);
    assert(res.body.success, 'Expected success: true');

    const inDb = db.prepare('SELECT is_active FROM academic_programs WHERE id = ?').get(testProgId);
    assert.strictEqual(inDb.is_active, res.body.isActive ? 1 : 0);
  });

  // Clean up test records
  db.prepare('DELETE FROM academic_programs WHERE id IN (?, ?)').run(testProgId, brandNewId);

  console.log(`\n🎉 Results: ${passed}/${total} tests passed!`);
  if (passed !== total) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
