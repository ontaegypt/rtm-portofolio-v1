import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';

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

const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_ANON_KEY);

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  if (!storedHash.includes(':')) return password === storedHash;
  const [salt, key] = storedHash.split(':');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), Buffer.from(hash, 'hex'));
  } catch {
    return false;
  }
}

async function testUserCrud() {
  console.log('Testing Supabase Users CRUD & Auth...');

  // 1. Get initial users
  const { data: users, error: listErr } = await supabase.from('users').select('*');
  console.log('Initial Supabase users:', users?.length, 'Error:', listErr?.message);

  // 2. Create test user
  const testEmail = `test_staff_${Date.now()}@rtm.sch.id`;
  const { data: created, error: createErr } = await supabase.from('users').insert({
    email: testEmail,
    full_name: 'Staf Akademik Test',
    role: 'ACADEMIC_ADMIN',
    is_active: true
  }).select().single();

  if (createErr) {
    console.error('❌ Create user failed:', createErr);
    return;
  }
  console.log('✅ Created user in Supabase:', created.id, created.email, created.role);

  // 3. Update test user
  const { data: updated, error: updateErr } = await supabase.from('users').update({
    full_name: 'Staf Akademik Updated',
    role: 'CONTENT_EDITOR',
    is_active: false
  }).eq('id', created.id).select().single();

  if (updateErr) {
    console.error('❌ Update user failed:', updateErr);
    return;
  }
  console.log('✅ Updated user in Supabase:', updated.id, updated.full_name, updated.role, 'is_active:', updated.is_active);

  // 4. Delete test user
  const { error: deleteErr } = await supabase.from('users').delete().eq('id', created.id);
  if (deleteErr) {
    console.error('❌ Delete user failed:', deleteErr);
    return;
  }
  console.log('✅ Deleted test user from Supabase successfully!');
}

testUserCrud();
