import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';

// Read .env manually without external dotenv dependency if not installed
const envContent = fs.readFileSync('.env', 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^\s*([\w_]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val;
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

console.log('--- TESTING SUPABASE CONNECTION ---');
console.log('Project URL:', SUPABASE_URL);
console.log('Anon Key Present:', !!SUPABASE_ANON_KEY);
console.log('Service Role Key Present:', !!SUPABASE_SERVICE_ROLE_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY);

async function testConnection() {
  try {
    // Try querying created tables
    console.log('\nTesting Supabase REST API connection against created tables...');
    const results = await Promise.all([
      supabase.from('academic_programs').select('*').limit(1),
      supabase.from('articles').select('*').limit(1),
      supabase.from('users').select('*').limit(1),
      supabase.from('donation_campaigns').select('*').limit(1)
    ]);

    const tableNames = ['academic_programs', 'articles', 'users', 'donation_campaigns'];
    let allSuccess = true;

    results.forEach((res, idx) => {
      if (res.error) {
        console.log(`❌ Table ${tableNames[idx]} error:`, res.error.message);
        allSuccess = false;
      } else {
        console.log(`✅ Table ${tableNames[idx]} verified! Rows found:`, res.data.length);
      }
    });

    if (allSuccess) {
      console.log('\n🎉 SEMUA TABEL SUPABASE CLOUD SUDAH AKTIF DAN SIAP DIGUNAKAN!');
    }
    return;
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }
}

testConnection();
