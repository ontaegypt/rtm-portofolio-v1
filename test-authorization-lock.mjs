// Automated Verification Test Suite: Authorization & Role Lock Integrity
import fs from 'node:fs';

const API_URL = 'http://localhost:3000/api';

async function runAuthTests() {
  console.log('🔒 Testing Patented Authorization & Role Locking System...\n');
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
    // 1. Static HTML & DOM Verification
    const indexHtml = fs.readFileSync('index.html', 'utf-8');
    const mainJs = fs.readFileSync('src/main.js', 'utf-8');

    assert(!indexHtml.includes('id="quickRoleSelect"'), 'Live quick-role switcher dropdown (#quickRoleSelect) has been completely removed from index.html');
    assert(indexHtml.includes('id="topbarUserRoleBadge"'), 'Locked role indicator badge (#topbarUserRoleBadge) is present in topbar');
    assert(!mainJs.includes('quickRoleSelect.addEventListener'), 'Event listener allowing live role switching has been completely eliminated from main.js');
    assert(mainJs.includes('verifyAndSyncSession'), 'verifyAndSyncSession is present to prevent localStorage role spoofing and tampering');

    // 2. Authentication: Super Administrator
    const loginSuper = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@rumahtahfidz.sch.id', password: 'admin123' })
    });
    const superData = await loginSuper.json();
    assert(loginSuper.status === 200 && superData.user.role === 'superadmin', 'Superadmin login succeeds with role "superadmin"');

    const meSuper = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${superData.token}` }
    });
    const meSuperData = await meSuper.json();
    assert(meSuperData.success === true && meSuperData.user.role === 'superadmin', 'GET /api/auth/me authoritatively returns "superadmin" from database');

    // Superadmin has permission to manage users
    const userSuperRes = await fetch(`${API_URL}/users`, {
      headers: { 'Authorization': `Bearer ${superData.token}` }
    });
    assert(userSuperRes.status === 200, 'Superadmin is permitted to access /api/users');

    // 3. Authentication: Content Editor
    const loginEditor = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'editor@rumahtahfidz.sch.id', password: 'editor123' })
    });
    const editorData = await loginEditor.json();
    assert(loginEditor.status === 200 && editorData.user.role === 'editor', 'Content Editor login succeeds with role "editor"');

    const meEditor = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${editorData.token}` }
    });
    const meEditorData = await meEditor.json();
    assert(meEditorData.success === true && meEditorData.user.role === 'editor', 'GET /api/auth/me authoritatively returns "editor" from database');

    // Editor attempting to modify site settings -> REJECTED (403)
    const editorSettingsRes = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${editorData.token}`
      },
      body: JSON.stringify({ site_name: 'Hacked Site Name' })
    });
    assert(editorSettingsRes.status === 403, 'Editor attempting to modify settings is strictly BLOCKED with HTTP 403 Forbidden');

    // Editor attempting to manage users -> REJECTED (403)
    const editorCreateUserRes = await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${editorData.token}`
      },
      body: JSON.stringify({ name: 'Hacker', email: 'hacker@rtm.sch.id', password: '123', role: 'superadmin' })
    });
    assert(editorCreateUserRes.status === 403, 'Editor attempting to create user is strictly BLOCKED with HTTP 403 Forbidden');

    // Editor attempting to create campaigns -> REJECTED (403)
    const editorCreateCampRes = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${editorData.token}`
      },
      body: JSON.stringify({ title: 'Campaign by Editor', target_amount: 1000000 })
    });
    assert(editorCreateCampRes.status === 403, 'Editor attempting to create donation campaigns is strictly BLOCKED with HTTP 403 Forbidden');

    // 4. Authentication: Finance / Bendahara
    const loginFinance = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'finance@rumahtahfidz.sch.id', password: 'finance123' })
    });
    const financeData = await loginFinance.json();
    assert(loginFinance.status === 200 && financeData.user.role === 'finance', 'Finance login succeeds with role "finance"');

    const meFinance = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${financeData.token}` }
    });
    const meFinanceData = await meFinance.json();
    assert(meFinanceData.success === true && meFinanceData.user.role === 'finance', 'GET /api/auth/me authoritatively returns "finance" from database');

    // Finance attempting to publish articles -> REJECTED (403)
    const financeArticleRes = await fetch(`${API_URL}/articles`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${financeData.token}`
      },
      body: JSON.stringify({ title: 'Article by Finance', content: 'Testing content' })
    });
    assert(financeArticleRes.status === 403, 'Finance attempting to publish articles is strictly BLOCKED with HTTP 403 Forbidden');

    // Finance attempting to modify settings -> REJECTED (403)
    const financeSettingsRes = await fetch(`${API_URL}/settings`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${financeData.token}`
      },
      body: JSON.stringify({ site_name: 'Hacked by Finance' })
    });
    assert(financeSettingsRes.status === 403, 'Finance attempting to modify settings is strictly BLOCKED with HTTP 403 Forbidden');

    // Finance is authorized to manage campaigns
    const financeCampRes = await fetch(`${API_URL}/campaigns`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${financeData.token}`
      },
      body: JSON.stringify({
        title: 'Program Wakaf Ambulans Medis Santri',
        target_amount: 250000000,
        category_name: 'Sarana & Medis'
      })
    });
    assert(financeCampRes.status === 201, 'Finance is authorized to create donation campaigns (HTTP 201)');

  } catch (err) {
    console.error('❌ Unhandled error in auth test suite:', err);
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

runAuthTests();
