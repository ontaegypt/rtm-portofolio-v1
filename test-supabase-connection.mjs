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
    // Try pinging or listing tables/auth
    console.log('\nTesting Supabase REST API connection...');
    const { data, error } = await supabase.from('institution_profile').select('*').limit(1);
    
    if (error) {
      console.log('Supabase API responded with message:', error.message);
      console.log('Error details:', error);
      if (error.code === 'PGRST205' || error.message.includes('relation "institution_profile" does not exist') || error.code === '42P01') {
        console.log('✅ KONEKSI BERHASIL! Supabase cloud terhubung, tetapi tabel belum dibuat di database.');
      } else {
        console.log('Status code/hint:', error.hint || error.code);
      }
    } else {
      console.log('✅ KONEKSI BERHASIL & TABEL DITEMUKAN!');
      console.log('Data sample:', data);
    }
  } catch (err) {
    console.error('❌ Connection error:', err.message);
  }
}

testConnection();
