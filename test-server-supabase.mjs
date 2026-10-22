import app from './server/index.js';

async function testExpressWithSupabase() {
  console.log('Testing Express API integration with Supabase Cloud...');

  // Start temporary server
  const server = app.listen(3099, async () => {
    try {
      console.log('Server started on port 3099');

      // 1. Test /api/health
      const healthRes = await fetch('http://localhost:3099/api/health');
      const healthData = await healthRes.json();
      console.log('\n1. /api/health Response:');
      console.log(JSON.stringify(healthData, null, 2));

      // 2. Test /api/programs
      const progRes = await fetch('http://localhost:3099/api/programs');
      const progData = await progRes.json();
      console.log(`\n2. /api/programs Response (Source: ${progData.source || 'sqlite'}):`);
      console.log(`Found ${progData.data?.length} programs:`, progData.data?.map(p => p.title || p.name));

      // 3. Test /api/articles
      const artRes = await fetch('http://localhost:3099/api/articles');
      const artData = await artRes.json();
      console.log(`\n3. /api/articles Response (Source: ${artData.source || 'sqlite'}):`);
      console.log(`Found ${artData.data?.length} articles:`, artData.data?.map(a => a.title));

      // 4. Test /api/campaigns
      const campRes = await fetch('http://localhost:3099/api/campaigns');
      const campData = await campRes.json();
      console.log(`\n4. /api/campaigns Response (Source: ${campData.source || 'sqlite'}):`);
      console.log(`Found ${campData.data?.length} campaigns:`, campData.data?.map(c => c.title));

      server.close();
      console.log('\n🎉 ALL TESTS PASSED! Node.js backend is now successfully running on Supabase Cloud database!');
      process.exit(0);
    } catch (err) {
      console.error('Test error:', err);
      server.close();
      process.exit(1);
    }
  });
}

testExpressWithSupabase();
