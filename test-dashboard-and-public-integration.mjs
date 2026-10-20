import assert from 'node:assert';
import { api } from './server/api.js';
import { db } from './server/db.js';

console.log('🧪 Running Comprehensive Dashboard & Public Website Integration Test...\n');

function callRoute(method, urlPath, body = null, userRole = 'superadmin') {
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
        authorization: 'Bearer mock-test-token',
        'content-type': 'application/json'
      },
      body: body || {},
      user: { id: 'admin-tester', name: 'Super Admin Tester', role: userRole }
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

async function runTests() {
  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name}`);
      console.error(err);
    }
  }

  console.log('--- 1. Media Library API ---');
  await asyncTest('GET /media returns list of assets without 404', async () => {
    const res = await callRoute('GET', '/media');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  let createdMediaId = null;
  await asyncTest('POST /media uploads new media asset', async () => {
    const res = await callRoute('POST', '/media', {
      file_name: 'test-doc.pdf',
      mime_type: 'application/pdf',
      file_size: 1024,
      data_url: 'data:application/pdf;base64,JVBERi0xLjQK',
      alt_text: 'Test Document',
      album_name: 'Dokumen Akademik'
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.data && res.body.data.id);
    createdMediaId = res.body.data.id;
  });

  await asyncTest('DELETE /media/:id successfully deletes uploaded asset without 404', async () => {
    assert.ok(createdMediaId);
    const res = await callRoute('DELETE', `/media/${createdMediaId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  console.log('\n--- 2. Articles API (News / Berita) ---');
  await asyncTest('GET /articles returns articles list without 404', async () => {
    const res = await callRoute('GET', '/articles');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  const testArticleId = 'test-art-' + Date.now();
  await asyncTest('PUT /articles/:id auto-upserts unseeded article without 404', async () => {
    const res = await callRoute('PUT', `/articles/${testArticleId}`, {
      title: 'Artikel Uji Integrasi',
      slug: 'artikel-uji-integrasi-' + Date.now(),
      category: 'Warta Utama',
      content: '<p>Konten uji artikel</p>',
      status: 'published'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data);
  });

  await asyncTest('PATCH /articles/:id/toggle toggles publication status without 404', async () => {
    const res = await callRoute('PATCH', `/articles/${testArticleId}/toggle`, {
      status: 'draft'
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.status, 'draft');
  });

  await asyncTest('DELETE /articles/:id deletes article without 404', async () => {
    const res = await callRoute('DELETE', `/articles/${testArticleId}`);
    assert.strictEqual(res.status, 200);
  });

  console.log('\n--- 3. Galleries & Visits API ---');
  await asyncTest('GET /galleries returns galleries list without 404', async () => {
    const res = await callRoute('GET', '/galleries');
    assert.strictEqual(res.status, 200);
    assert.ok(Array.isArray(res.body.data));
  });

  const testGalleryId = 'test-gal-' + Date.now();
  await asyncTest('PUT /galleries/:id auto-upserts gallery photo without 404', async () => {
    const res = await callRoute('PUT', `/galleries/${testGalleryId}`, {
      title: 'Foto Kegiatan Santri',
      category: 'kegiatan',
      album_name: 'Pustaka Foto',
      media_url: '/assets/images/sample.jpg',
      alt_text: 'Foto Santri',
      status: 'published'
    });
    assert.strictEqual(res.status, 200);
    assert.ok(res.body.data);
  });

  await asyncTest('DELETE /galleries/:id allows superadmin and editor without 404', async () => {
    const res = await callRoute('DELETE', `/galleries/${testGalleryId}`, null, 'editor');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  console.log('\n--- 4. Academic Programs & PPDB Open/Close Enforcement ---');
  const testProgId = 'prog-test-' + Date.now();
  await asyncTest('POST /programs creates a new active program', async () => {
    const res = await callRoute('POST', '/programs', {
      id: testProgId,
      name: 'Program Tahfidz Khusus Tes',
      slug: 'program-tahfidz-khusus-tes-' + Date.now(),
      category: 'formal',
      headline: 'Target Hafalan 30 Juz Mutqin',
      is_active: 1
    });
    assert.strictEqual(res.status, 201);
  });

  await asyncTest('POST /ppdb succeeds when target program is open (is_active = 1)', async () => {
    const res = await callRoute('POST', '/ppdb', {
      program_id: testProgId,
      batch_id: 'Gelombang 1',
      full_name: 'Ahmad Santri Uji',
      gender: 'Laki-laki',
      birth_date: '2012-05-10',
      parent_name: 'Bapak Santri',
      phone_whatsapp: '6281234567891'
    });
    assert.strictEqual(res.status, 201);
    assert.ok(res.body.success);
  });

  await asyncTest('PATCH /programs/:id/toggle closes program (is_active = 0)', async () => {
    const res = await callRoute('PATCH', `/programs/${testProgId}/toggle`, {
      is_active: 0
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.data.is_active, 0);
  });

  await asyncTest('POST /ppdb REJECTS with HTTP 400 when target program is closed (is_active = 0)', async () => {
    const res = await callRoute('POST', '/ppdb', {
      program_id: testProgId,
      batch_id: 'Gelombang 1',
      full_name: 'Santri Terlambat Daftar',
      gender: 'Laki-laki',
      birth_date: '2012-05-10',
      parent_name: 'Bapak Santri',
      phone_whatsapp: '6281234567892'
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
    assert.ok(res.body.message.toLowerCase().includes('ditutup'));
  });

  console.log('\n--- 5. Appearance / Site Settings API ---');
  await asyncTest('GET /site-settings and PUT /site-settings persist identity without 404', async () => {
    const getRes = await callRoute('GET', '/site-settings');
    assert.strictEqual(getRes.status, 200);

    const putRes = await callRoute('PUT', '/site-settings', {
      mode: 'publish',
      site_identity: {
        title: 'Yayasan Rumah Tahfidz Madani Indonesia',
        shortTitle: 'RTM Madani',
        tagline: 'Mencetak Generasi Qur\'ani Berakhlak Mulia',
        whatsappPPDB: '081234567890'
      }
    });
    assert.strictEqual(putRes.status, 200);
    assert.strictEqual(putRes.body.success, true);
  });

  console.log('\n========================================');
  console.log(`Results: ${passed}/${total} Tests Passed (${Math.round((passed / total) * 100)}%)`);
  console.log('========================================');

  if (passed === total) {
    console.log('🎉 ALL INTEGRATION TESTS PASSED PERFECTLY!\n');
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
