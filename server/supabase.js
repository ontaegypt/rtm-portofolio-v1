import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../.env');

if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // ignore
  }
}

const supabaseUrl = process.env.SUPABASE_URL || 'https://bnaaxskyzwjeaduasgru.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_d9SGt8oX-Gh4lwhnHfC_ZQ_Y8V2E83f';

// Supabase client instance with admin/service capabilities if service role key is provided
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseKey);

// ==============================================================================
// SUPABASE REPOSITORY METHODS (DATA ACCESS LAYER)
// ==============================================================================

/**
 * Health check & table metrics from live Supabase Cloud
 */
export async function getSupabaseHealth() {
  try {
    const [prog, art, users, camp] = await Promise.all([
      supabase.from('academic_programs').select('id', { count: 'exact', head: true }),
      supabase.from('articles').select('id', { count: 'exact', head: true }),
      supabase.from('users').select('id', { count: 'exact', head: true }),
      supabase.from('donation_campaigns').select('id', { count: 'exact', head: true }),
    ]);

    return {
      connected: true,
      url: supabaseUrl,
      project: 'bnaaxskyzwjeaduasgru',
      counts: {
        academic_programs: prog.count ?? 0,
        articles: art.count ?? 0,
        users: users.count ?? 0,
        donation_campaigns: camp.count ?? 0
      }
    };
  } catch (err) {
    return {
      connected: false,
      error: err.message
    };
  }
}

/**
 * Get all academic programs
 */
export async function getSupabasePrograms(category = null) {
  let query = supabase
    .from('academic_programs')
    .select('*')
    .eq('status', 'PUBLISHED')
    .order('created_at', { ascending: true });

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get program by slug or ID
 */
export async function getSupabaseProgramByIdOrSlug(idOrSlug) {
  // Check slug first
  let { data, error } = await supabase
    .from('academic_programs')
    .select('*')
    .eq('slug', idOrSlug)
    .maybeSingle();

  if (!data && !error) {
    // If UUID format, try querying by id
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      const res = await supabase.from('academic_programs').select('*').eq('id', idOrSlug).maybeSingle();
      data = res.data;
      error = res.error;
    }
  }

  if (error) throw error;
  return data;
}

/**
 * Get all articles with search and filtering
 */
export async function getSupabaseArticles({ category, search, status = 'PUBLISHED' } = {}) {
  let query = supabase
    .from('articles')
    .select('*')
    .order('published_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status.toUpperCase());
  }

  if (category && category !== 'all') {
    query = query.eq('category', category);
  }

  if (search) {
    query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,body_content.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get article by slug or ID
 */
export async function getSupabaseArticleByIdOrSlug(idOrSlug) {
  let { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', idOrSlug)
    .maybeSingle();

  if (!data && !error) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      const res = await supabase.from('articles').select('*').eq('id', idOrSlug).maybeSingle();
      data = res.data;
      error = res.error;
    }
  }

  if (error) throw error;
  return data;
}

/**
 * Get donation campaigns
 */
export async function getSupabaseCampaigns({ status = 'PUBLISHED' } = {}) {
  let query = supabase
    .from('donation_campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  if (status && status !== 'all') {
    query = query.eq('status', status.toUpperCase());
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Get campaign by slug or ID
 */
export async function getSupabaseCampaignByIdOrSlug(idOrSlug) {
  let { data, error } = await supabase
    .from('donation_campaigns')
    .select('*')
    .eq('slug', idOrSlug)
    .maybeSingle();

  if (!data && !error) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idOrSlug);
    if (isUuid) {
      const res = await supabase.from('donation_campaigns').select('*').eq('id', idOrSlug).maybeSingle();
      data = res.data;
      error = res.error;
    }
  }

  if (error) throw error;
  return data;
}

/**
 * Get site settings
 */
export async function getSupabaseSiteSettings(key = 'institution_profile') {
  const { data, error } = await supabase
    .from('site_settings')
    .select('*')
    .eq('key', key)
    .maybeSingle();

  if (error) throw error;
  return data?.value || null;
}

/**
 * Create a new program registration in Supabase
 */
export async function createSupabaseRegistration({
  program_id,
  applicant_name,
  applicant_email,
  applicant_phone,
  birth_date,
  parent_name,
  custom_answers = {}
}) {
  const registration_number = `PPDB-${Date.now().toString().slice(-6)}`;
  const { data, error } = await supabase
    .from('program_registrations')
    .insert({
      registration_number,
      program_id,
      applicant_name,
      applicant_email,
      applicant_phone,
      birth_date,
      parent_name,
      custom_answers,
      status: 'SUBMITTED'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Record a financial donation in Supabase
 */
export async function createSupabaseDonation({
  campaign_id,
  campaign_title,
  donor_name,
  donor_phone,
  donor_email,
  is_anonymous = false,
  amount,
  payment_method = 'Transfer Bank BSI',
  payment_source = 'Online',
  proof_image = null
}) {
  const invoice_number = `INV-${Date.now()}`;
  const { data, error } = await supabase
    .from('financial_transactions')
    .insert({
      invoice_number,
      campaign_id,
      campaign_title,
      donor_name,
      donor_phone,
      donor_email,
      is_anonymous,
      amount,
      payment_method,
      payment_source,
      proof_image,
      payment_status: 'PENDING_VERIFICATION'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==============================================================================
// USER & RBAC REPOSITORY METHODS
// ==============================================================================

export function mapRoleToSupabase(role) {
  const r = String(role || '').toLowerCase();
  if (r.includes('super') || r.includes('admin')) return 'SUPER_ADMIN';
  if (r.includes('edit') || r.includes('content')) return 'CONTENT_EDITOR';
  if (r.includes('acad')) return 'ACADEMIC_ADMIN';
  if (r.includes('fin')) return 'FINANCE_ADMIN';
  return 'CONTENT_EDITOR';
}

export function mapRoleFromSupabase(supaRole) {
  const r = String(supaRole || '').toUpperCase();
  if (r === 'SUPER_ADMIN') return 'superadmin';
  if (r === 'CONTENT_EDITOR') return 'editor';
  if (r === 'ACADEMIC_ADMIN') return 'academic';
  if (r === 'FINANCE_ADMIN') return 'finance';
  return 'editor';
}

const defaultRoleTitles = {
  superadmin: 'Admin',
  editor: 'Content',
  academic: 'Academic',
  finance: 'Finance'
};

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
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

async function getAuthCredentialsMap() {
  try {
    const { data } = await supabase.from('site_settings').select('value').eq('key', 'cms_users_auth').maybeSingle();
    return data?.value || {};
  } catch {
    return {};
  }
}

async function saveAuthCredentialsMap(map) {
  try {
    await supabase.from('site_settings').upsert({
      key: 'cms_users_auth',
      value: map,
      draft_value: map,
      updated_at: new Date().toISOString()
    });
  } catch (err) {
    console.warn('[Supabase Auth Save Error]:', err.message);
  }
}

/**
 * Get all users from Supabase Cloud
 */
export async function getSupabaseUsers() {
  const { data: users, error } = await supabase
    .from('users')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  if (!users) return [];

  const credsMap = await getAuthCredentialsMap();

  return users.map(u => {
    const lowerRole = mapRoleFromSupabase(u.role);
    const cred = credsMap[u.id] || credsMap[u.email.toLowerCase()] || {};
    const initials = (u.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

    return {
      id: u.id,
      name: u.full_name,
      email: u.email,
      role: lowerRole,
      role_title: cred.role_title || defaultRoleTitles[lowerRole] || 'Staf',
      avatar: u.avatar_url || cred.avatar || initials,
      is_active: u.is_active ? 1 : 0,
      last_login_at: u.last_login_at,
      created_at: u.created_at
    };
  });
}

/**
 * Get user by ID
 */
export async function getSupabaseUserById(id) {
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error || !user) return null;

  const credsMap = await getAuthCredentialsMap();
  const cred = credsMap[user.id] || credsMap[user.email.toLowerCase()] || {};
  const lowerRole = mapRoleFromSupabase(user.role);
  const initials = (user.full_name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();

  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: lowerRole,
    role_title: cred.role_title || defaultRoleTitles[lowerRole] || 'Staf',
    avatar: user.avatar_url || cred.avatar || initials,
    is_active: user.is_active ? 1 : 0,
    password_hash: user.password_hash || cred.password_hash || null,
    last_login_at: user.last_login_at
  };
}

/**
 * Get user by Email
 */
export async function getSupabaseUserByEmail(email) {
  if (!email) return null;
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email.trim().toLowerCase())
    .maybeSingle();

  if (error || !user) return null;

  const credsMap = await getAuthCredentialsMap();
  const cred = credsMap[user.id] || credsMap[user.email.toLowerCase()] || {};
  const lowerRole = mapRoleFromSupabase(user.role);

  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: lowerRole,
    role_title: cred.role_title || defaultRoleTitles[lowerRole] || 'Staf',
    avatar: user.avatar_url || cred.avatar,
    is_active: user.is_active ? 1 : 0,
    password_hash: user.password_hash || cred.password_hash || null,
    last_login_at: user.last_login_at
  };
}

/**
 * Create user in Supabase
 */
export async function createSupabaseUser({ name, email, password, role, role_title, avatar, is_active = 1 }) {
  const cleanEmail = email.trim().toLowerCase();
  const existing = await getSupabaseUserByEmail(cleanEmail);
  if (existing) {
    const err = new Error('Email sudah terdaftar untuk pengguna lain.');
    err.status = 400;
    throw err;
  }

  const supaRole = mapRoleToSupabase(role);
  const passHash = password ? hashPassword(password) : null;
  const initials = (name || 'U').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  const avatarVal = avatar || initials;

  // Insert into public.users
  const insertPayload = {
    email: cleanEmail,
    full_name: name.trim(),
    role: supaRole,
    is_active: is_active !== 0 && is_active !== false,
    avatar_url: avatarVal
  };

  const { data: created, error } = await supabase
    .from('users')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;

  // Save credentials in site_settings
  if (passHash) {
    const credsMap = await getAuthCredentialsMap();
    credsMap[created.id] = {
      password_hash: passHash,
      role_title: role_title || defaultRoleTitles[mapRoleFromSupabase(supaRole)] || 'Staf',
      avatar: avatarVal
    };
    credsMap[cleanEmail] = credsMap[created.id];
    await saveAuthCredentialsMap(credsMap);
  }

  return {
    id: created.id,
    name: created.full_name,
    email: created.email,
    role: mapRoleFromSupabase(created.role),
    role_title: role_title || defaultRoleTitles[mapRoleFromSupabase(supaRole)] || 'Staf',
    avatar: avatarVal,
    is_active: created.is_active ? 1 : 0
  };
}

/**
 * Update user in Supabase
 */
export async function updateSupabaseUser(id, { name, email, password, role, role_title, avatar, is_active }) {
  // Find user by id first, or email fallback
  let user = await getSupabaseUserById(id);
  if (!user && email) {
    user = await getSupabaseUserByEmail(email);
  }
  if (!user) {
    const allUsers = await getSupabaseUsers();
    user = allUsers.find(u => u.id === id || u.email.toLowerCase() === (email || '').toLowerCase());
  }

  const targetId = user ? user.id : id;
  const updatePayload = {
    updated_at: new Date().toISOString()
  };

  if (name) updatePayload.full_name = name.trim();
  if (email) updatePayload.email = email.trim().toLowerCase();
  if (role) updatePayload.role = mapRoleToSupabase(role);
  if (avatar) updatePayload.avatar_url = avatar.trim();
  if (is_active !== undefined) updatePayload.is_active = is_active !== 0 && is_active !== false;

  const { data: updated, error } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', targetId)
    .select()
    .single();

  if (error) throw error;

  // Update credentials if password or role_title provided
  if (password || role_title || avatar) {
    const credsMap = await getAuthCredentialsMap();
    const existingCred = credsMap[targetId] || credsMap[user?.email?.toLowerCase()] || {};
    if (password && password.trim()) {
      existingCred.password_hash = hashPassword(password.trim());
    }
    if (role_title) {
      existingCred.role_title = role_title;
    }
    if (avatar) {
      existingCred.avatar = avatar;
    }
    credsMap[targetId] = existingCred;
    if (updated.email) credsMap[updated.email.toLowerCase()] = existingCred;
    await saveAuthCredentialsMap(credsMap);
  }

  const lowerRole = mapRoleFromSupabase(updated.role);
  return {
    id: updated.id,
    name: updated.full_name,
    email: updated.email,
    role: lowerRole,
    role_title: role_title || defaultRoleTitles[lowerRole] || 'Staf',
    avatar: updated.avatar_url,
    is_active: updated.is_active ? 1 : 0
  };
}

/**
 * Toggle user status (active/inactive) in Supabase
 */
export async function toggleSupabaseUserStatus(id, is_active) {
  let user = await getSupabaseUserById(id);
  const targetId = user ? user.id : id;

  const { data, error } = await supabase
    .from('users')
    .update({
      is_active: is_active !== 0 && is_active !== false,
      updated_at: new Date().toISOString()
    })
    .eq('id', targetId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete user in Supabase
 */
export async function deleteSupabaseUser(id) {
  let user = await getSupabaseUserById(id);
  const targetId = user ? user.id : id;

  const users = await supabase.from('users').select('id, role').eq('role', 'SUPER_ADMIN');
  const isSuperAdmin = users.data?.some(u => u.id === targetId);
  if (isSuperAdmin && users.data?.length <= 1) {
    const err = new Error('Tidak dapat menghapus satu-satunya akun Super Admin!');
    err.status = 400;
    throw err;
  }

  const { error } = await supabase
    .from('users')
    .delete()
    .eq('id', targetId);

  if (error) throw error;
  return true;
}

/**
 * Verify user login against Supabase
 */
export async function verifySupabaseLogin(email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const user = await getSupabaseUserByEmail(cleanEmail);
  if (!user) return null;

  const defaultPasswords = {
    'admin@rumahtahfidz.sch.id': 'admin123',
    'admin@rtm.sch.id': 'admin123',
    'editor@rumahtahfidz.sch.id': 'editor123',
    'finance@rumahtahfidz.sch.id': 'finance123'
  };

  let isMatch = false;
  if (user.password_hash) {
    isMatch = verifyPassword(password, user.password_hash);
  } else if (defaultPasswords[cleanEmail]) {
    isMatch = password === defaultPasswords[cleanEmail];
  }

  if (!isMatch) return null;

  supabase.from('users').update({ last_login_at: new Date().toISOString() }).eq('id', user.id).then();

  return user;
}

export default supabase;
