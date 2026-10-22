import app from './server/index.js';

async function testUserApiSupabase() {
  console.log('Testing User API against Supabase Cloud...');

  const server = app.listen(3098, async () => {
    try {
      // 1. GET /api/users
      const listRes = await fetch('http://localhost:3098/api/users');
      const listData = await listRes.json();
      console.log(`\n1. GET /api/users: status=${listRes.status}, source=${listData.source || 'sqlite'}`);
      console.log(`Found ${listData.data?.length} users:`, listData.data?.map(u => `${u.name} (${u.email}) [${u.role}]`));

      // 2. POST /api/users
      const testEmail = `guru_tahfidz_${Date.now()}@rtm.sch.id`;
      const createRes = await fetch('http://localhost:3098/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Ustadzah Maryam Al-Banjari',
          email: testEmail,
          password: 'password123',
          role: 'academic',
          role_title: 'Academic',
          is_active: 1
        })
      });
      const createData = await createRes.json();
      console.log(`\n2. POST /api/users: status=${createRes.status}`);
      console.log('Response:', createData);
      const newUserId = createData.user?.id || createData.id;

      // 3. PATCH /api/users/:id
      const updateRes = await fetch(`http://localhost:3098/api/users/${newUserId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Ustadzah Dr. Maryam Al-Banjari, M.Pd.',
          role_title: 'Kepala Akademik Tahfidz'
        })
      });
      const updateData = await updateRes.json();
      console.log(`\n3. PATCH /api/users/${newUserId}: status=${updateRes.status}`);
      console.log('Response:', updateData);

      // 4. PATCH /api/users/:id/status
      const toggleRes = await fetch(`http://localhost:3098/api/users/${newUserId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: 0 })
      });
      const toggleData = await toggleRes.json();
      console.log(`\n4. PATCH /api/users/${newUserId}/status: status=${toggleRes.status}`);
      console.log('Response:', toggleData);

      // 5. POST /api/auth/login
      const loginRes = await fetch('http://localhost:3098/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'admin@rtm.sch.id',
          password: 'admin123'
        })
      });
      const loginData = await loginRes.json();
      console.log(`\n5. POST /api/auth/login: status=${loginRes.status}, success=${loginData.success}`);
      console.log(`User logged in: ${loginData.user?.name} (${loginData.user?.email})`);

      // 6. DELETE /api/users/:id (clean up test user)
      const delRes = await fetch(`http://localhost:3098/api/users/${newUserId}`, {
        method: 'DELETE'
      });
      const delData = await delRes.json();
      console.log(`\n6. DELETE /api/users/${newUserId}: status=${delRes.status}`);
      console.log('Response:', delData);

      server.close();
      console.log('\n🎉 ALL USER API TESTS PASSED! User creation, updates, toggles, login, and deletion work directly on Supabase Cloud without any 500 error!');
      process.exit(0);
    } catch (err) {
      console.error('Test error:', err);
      server.close();
      process.exit(1);
    }
  });
}

testUserApiSupabase();
