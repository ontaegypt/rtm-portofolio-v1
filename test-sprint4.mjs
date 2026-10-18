// Automated Test Suite for Sprint 4: PPDB Integration & Endpoints
const API_URL = 'http://localhost:3000/api';

async function runTests() {
  console.log('🧪 Starting Sprint 4 Automated Test Suite...\n');
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✅ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ❌ [FAIL] ${message}`);
    }
  }

  try {
    // Test 1: Health check
    const healthRes = await fetch(`${API_URL}/health`);
    const health = await healthRes.json();
    assert(health.status === 'ok' && health.database.includes('rtm.db'), 'Backend health check & SQLite connection');

    // Test 2: Fetch all PPDB leads
    const listRes = await fetch(`${API_URL}/ppdb`);
    const listData = await listRes.json();
    assert(listData.success === true && Array.isArray(listData.data) && listData.data.length >= 3, `GET /api/ppdb returns seeded leads (count: ${listData.data?.length})`);

    // Test 3: PPDB Query filtering by status and program
    const filterRes = await fetch(`${API_URL}/ppdb?status=accepted`);
    const filterData = await filterRes.json();
    assert(filterData.success === true && filterData.data.every(l => l.status === 'accepted'), 'GET /api/ppdb?status=accepted returns only accepted candidates');

    // Test 4: PPDB Search query
    const searchRes = await fetch(`${API_URL}/ppdb?search=Azzam`);
    const searchData = await searchRes.json();
    assert(searchData.success === true && searchData.data.some(l => l.full_name.includes('Azzam')), 'GET /api/ppdb?search=Azzam successfully finds candidate by name');

    // Test 5: Validation - Reject incomplete registration
    const invalidRes = await fetch(`${API_URL}/ppdb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: 'Test Incomplete' }) // missing phone and program_id
    });
    const invalidData = await invalidRes.json();
    assert(invalidRes.status === 400 && invalidData.success === false, 'POST /api/ppdb rejects registration missing mandatory fields with HTTP 400');

    // Test 6: Create new candidate registration
    const newCandidate = {
      program_id: 'sma',
      batch_id: 'Gelombang 1 - TA 2026/2027',
      full_name: 'Muhammad Farhan Al-Fatih',
      gender: 'Laki-laki',
      birth_date: '2010-08-17',
      parent_name: 'Dr. H. Sulaiman',
      phone_whatsapp: '081298765432',
      email: 'farhan.alfatih@gmail.com',
      info_source: 'Website Resmi',
      motivation: 'Ingin menjadi hafizh 30 juz dan ahli sains muslim berprestasi.',
      payment_method: 'Transfer Bank BSI'
    };

    const createRes = await fetch(`${API_URL}/ppdb`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newCandidate)
    });
    const createData = await createRes.json();
    assert(createRes.status === 201 && createData.success === true && createData.id.startsWith('REG-2026-'), `POST /api/ppdb successfully generates official ID: ${createData.id}`);

    const newLeadId = createData.id;

    // Test 7: Retrieve single candidate dossier by ID
    const singleRes = await fetch(`${API_URL}/ppdb/${newLeadId}`);
    const singleData = await singleRes.json();
    assert(singleData.success === true && singleData.data.full_name === newCandidate.full_name && singleData.data.status === 'pending', `GET /api/ppdb/:id returns complete dossier with default status 'pending'`);

    // Test 8: Status update & Admin Notes
    const patchRes = await fetch(`${API_URL}/ppdb/${newLeadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: 'verified',
        notes: 'Hasil tes talaqqi juz 30: Mumtaz. Siap wawancara asrama.'
      })
    });
    const patchData = await patchRes.json();
    assert(patchData.success === true && patchData.data.status === 'verified' && patchData.data.notes.includes('Mumtaz'), 'PATCH /api/ppdb/:id/status updates status to verified and persists admin notes');

    // Test 9: Acceptance status update
    const acceptRes = await fetch(`${API_URL}/ppdb/${newLeadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'accepted' })
    });
    const acceptData = await acceptRes.json();
    assert(acceptData.success === true && acceptData.data.status === 'accepted', 'PATCH /api/ppdb/:id/status updates status to accepted');

    // Test 10: Reject invalid status
    const invalidStatusRes = await fetch(`${API_URL}/ppdb/${newLeadId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'lulus_bersyarat' }) // not in enum
    });
    assert(invalidStatusRes.status === 400, 'PATCH /api/ppdb/:id/status rejects invalid enum values with HTTP 400');

    // Test 11: PPDB CSV Export stream
    const exportRes = await fetch(`${API_URL}/ppdb/export`);
    const csvText = await exportRes.text();
    const contentType = exportRes.headers.get('content-type');
    const contentDisp = exportRes.headers.get('content-disposition');
    assert(
      contentType.includes('text/csv') &&
      contentDisp.includes('attachment') &&
      csvText.includes('No. Registrasi') &&
      csvText.includes(newLeadId) &&
      csvText.includes('Muhammad Farhan Al-Fatih'),
      'GET /api/ppdb/export returns compliant RFC 4180 CSV stream containing candidate records'
    );

    // Test 12: Delete candidate record
    const deleteRes = await fetch(`${API_URL}/ppdb/${newLeadId}`, { method: 'DELETE' });
    const deleteData = await deleteRes.json();
    assert(deleteData.success === true, 'DELETE /api/ppdb/:id successfully deletes registration record');

    // Test 13: Verify deleted candidate returns 404
    const verifyDelRes = await fetch(`${API_URL}/ppdb/${newLeadId}`);
    assert(verifyDelRes.status === 404, 'GET /api/ppdb/:id returns 404 after candidate deletion');

  } catch (err) {
    console.error('❌ Unhandled error in test suite:', err);
  }

  console.log(`\n========================================`);
  console.log(`Test Results: ${passed}/${total} Passed (${Math.round((passed / total) * 100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
