import express from 'express';
import { api } from './server/api.js';
import { db, hashPassword } from './server/db.js';
import EventEmitter from 'node:events';

// Direct express in-memory dispatcher (No network socket needed)
function callApi(method, path, body = {}, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = new EventEmitter();
    req.method = method.toUpperCase();
    req.url = path;
    req.originalUrl = `/api${path}`;
    req.baseUrl = '/api';
    req.path = path.split('?')[0];
    const qIndex = path.indexOf('?');
    req.query = {};
    if (qIndex !== -1) {
      const sp = new URLSearchParams(path.slice(qIndex + 1));
      for (const [k, v] of sp.entries()) req.query[k] = v;
    }
    req.headers = {
      'content-type': 'application/json',
      ...Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v]))
    };
    req.body = body;
    req.socket = { remoteAddress: '127.0.0.1' };
    req.ip = '127.0.0.1';

    let resBody = null;
    let resStatusCode = 200;
    const resHeaders = {};

    const res = {
      status(code) {
        resStatusCode = code;
        return res;
      },
      setHeader(name, value) {
        resHeaders[name.toLowerCase()] = value;
      },
      getHeader(name) {
        return resHeaders[name.toLowerCase()];
      },
      json(data) {
        resBody = data;
        resolve({ status: resStatusCode, body: resBody });
      },
      send(data) {
        resBody = data;
        resolve({ status: resStatusCode, body: resBody });
      },
      redirect(url) {
        resolve({ status: 302, redirect: url });
      }
    };

    api.handle(req, res, (err) => {
      if (err) reject(err);
      else resolve({ status: 404, body: { success: false, message: 'Not Found' } });
    });
  });
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('--- STARTING IN-MEMORY VERIFICATION TESTS ---');

  // TEST 1: Database Users Check
  console.log('\n[1] Verifying all CMS dashboard users in SQLite database...');
  const users = db.prepare('SELECT id, name, email, role, role_title, is_active FROM users ORDER BY id ASC').all();
  assert(users.length >= 3, `Users table has at least 3 users (found ${users.length})`);
  const adminUser = users.find(u => u.id === 'usr-1');
  const editorUser = users.find(u => u.id === 'usr-2');
  const financeUser = users.find(u => u.id === 'usr-3');

  assert(adminUser && adminUser.email === 'admin@rumahtahfidz.sch.id' && adminUser.role === 'superadmin', 'usr-1 (superadmin) exists in SQLite DB');
  assert(editorUser && editorUser.email === 'editor@rumahtahfidz.sch.id' && editorUser.role === 'editor', 'usr-2 (editor) exists in SQLite DB');
  assert(financeUser && financeUser.email === 'finance@rumahtahfidz.sch.id' && financeUser.role === 'finance', 'usr-3 (finance) exists in SQLite DB');

  // TEST 2: Login to get token for Editor (non-superadmin)
  console.log('\n[2] Logging in as Editor to obtain session token...');
  const loginRes = await callApi('POST', '/auth/login', {
    email: 'editor@rumahtahfidz.sch.id',
    password: 'editor123'
  });
  assert(loginRes.status === 200 && loginRes.body.token, 'Editor successfully logged in with token');
  const editorToken = loginRes.body.token;

  // TEST 3: User Profile Update via PATCH /auth/profile (Previously 404!)
  console.log('\n[3] Testing PATCH /auth/profile for Editor user...');
  const profileUpdateRes = await callApi('PATCH', '/auth/profile', {
    name: 'Ustadz Ahmad Syakir, Lc. Al-Hafizh',
    email: 'editor.syakir@rumahtahfidz.sch.id',
    avatar: 'AS'
  }, { Authorization: `Bearer ${editorToken}` });

  assert(profileUpdateRes.status === 200, `Profile update returned 200 OK (status: ${profileUpdateRes.status})`);
  assert(profileUpdateRes.body.success === true, 'Profile update returned success true');
  assert(profileUpdateRes.body.user.name === 'Ustadz Ahmad Syakir, Lc. Al-Hafizh', 'Updated name reflected in API response');

  // Verify in SQLite database
  const dbEditor = db.prepare('SELECT id, name, email, avatar FROM users WHERE id = ?').get('usr-2');
  assert(dbEditor.name === 'Ustadz Ahmad Syakir, Lc. Al-Hafizh', 'Database holds new updated name in SQLite');
  assert(dbEditor.email === 'editor.syakir@rumahtahfidz.sch.id', 'Database holds new email in SQLite');
  assert(dbEditor.avatar === 'AS', 'Database holds new avatar in SQLite');

  // TEST 4: Self update via PATCH /users/:id by non-superadmin (Previously 403 Forbidden!)
  console.log('\n[4] Testing PATCH /users/usr-2 by usr-2 self...');
  const selfPatchRes = await callApi('PATCH', '/users/usr-2', {
    name: 'Ustadz H. Ahmad Syakir, Lc.',
    email: 'editor@rumahtahfidz.sch.id'
  }, { Authorization: `Bearer ${editorToken}` });

  assert(selfPatchRes.status === 200, `Self patch returned 200 OK (not 403! status: ${selfPatchRes.status})`);
  assert(selfPatchRes.body.success === true, 'Self patch returned success');

  // Re-verify in SQLite
  const dbEditorRestored = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get('usr-2');
  assert(dbEditorRestored.email === 'editor@rumahtahfidz.sch.id', 'Restored editor email in SQLite');

  // TEST 5: Non-superadmin forbidden from updating someone else
  console.log('\n[5] Testing non-superadmin blocked from updating another user...');
  const unauthorizedPatchRes = await callApi('PATCH', '/users/usr-1', {
    name: 'Hacked Admin'
  }, { Authorization: `Bearer ${editorToken}` });
  assert(unauthorizedPatchRes.status === 403, `Non-superadmin received 403 when updating another user (status: ${unauthorizedPatchRes.status})`);

  // TEST 6: Email conflict prevention on profile update
  console.log('\n[6] Testing email conflict validation on profile update...');
  const conflictRes = await callApi('PATCH', '/auth/profile', {
    email: 'admin@rumahtahfidz.sch.id' // Already used by usr-1
  }, { Authorization: `Bearer ${editorToken}` });
  assert(conflictRes.status === 400, `Duplicate email rejected with status 400 (status: ${conflictRes.status})`);

  // TEST 7: Academic Program Registration via POST /ppdb
  console.log('\n[7] Testing Academic Program Registration (POST /ppdb)...');
  const regPayload = {
    program_id: 'smp',
    batch_id: 'Gelombang 1 - TA 2026/2027',
    full_name: 'Fatih Ahmad Al-Faruq',
    gender: 'Laki-laki',
    birth_date: '2012-08-15',
    parent_name: 'H. Joko Susanto',
    phone_whatsapp: '081298765432',
    email: 'joko.susanto@gmail.com',
    info_source: 'Website Resmi',
    motivation: 'Ingin menghafal 30 juz Al-Qur\'an dan mutqin.',
    payment_method: 'Transfer Bank BSI',
    custom_answers: { 'Hafalan Saat Ini': '3 Juz' }
  };

  const regRes = await callApi('POST', '/ppdb', regPayload);
  assert(regRes.status === 201, `Registration returned status 201 Created (status: ${regRes.status})`);
  assert(regRes.body.success === true, 'Registration response success is true');
  assert(regRes.body.registration_number && regRes.body.registration_number.startsWith('REG-2026-'), `Generated registration number: ${regRes.body.registration_number}`);

  // TEST 8: Verify Registration Persisted in SQLite DB & Connected to CMS
  console.log('\n[8] Verifying registration persisted in SQLite ppdb_registrations & accessible to CMS...');
  const dbReg = db.prepare('SELECT * FROM ppdb_registrations WHERE id = ?').get(regRes.body.id);
  assert(dbReg !== undefined, `Registration ${regRes.body.id} found in SQLite table ppdb_registrations`);
  assert(dbReg.full_name === 'Fatih Ahmad Al-Faruq', 'Full name matches in SQLite database');
  assert(dbReg.program_id === 'smp', 'Program ID is smp in database');
  assert(dbReg.status === 'pending', 'Initial registration status is pending');

  // Verify Audit Log
  const auditEntry = db.prepare("SELECT * FROM system_audit_logs WHERE module = 'ppdb' AND entity_id = ? ORDER BY id DESC LIMIT 1").get(regRes.body.id);
  assert(auditEntry !== undefined, 'Audit log created for PPDB registration');

  // TEST 9: Verify GET /ppdb returns the new registration for CMS staff
  console.log('\n[9] Verifying GET /ppdb returns new registration for CMS staff...');
  const listRes = await callApi('GET', '/ppdb', {}, { Authorization: `Bearer ${editorToken}` });
  assert(listRes.status === 200, `GET /ppdb returned status 200 (status: ${listRes.status})`);
  const foundInList = listRes.body.data.find(r => r.id === regRes.body.id);
  assert(foundInList !== undefined, `New registration found in CMS PPDB list data (total: ${listRes.body.total})`);

  console.log('\n🎉 ALL 9 VERIFICATION CHECKS PASSED PERFECTLY!\n');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Unhandled test error:', err);
  process.exit(1);
});
