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
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  '';

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

// ==============================================================================
// CLOUD MUTATION METHODS (PUT / PATCH OPERATIONS)
// ==============================================================================

/**
 * Update academic program in Supabase Cloud
 */
export async function updateSupabaseProgram(idOrSlug, data) {
  const existing = await getSupabaseProgramByIdOrSlug(idOrSlug);
  const targetId = existing?.id || idOrSlug;

  const payload = {
    updated_at: new Date().toISOString()
  };
  if (data.name || data.title) payload.title = data.name || data.title;
  if (data.category) payload.category = data.category;
  if (data.summary !== undefined) payload.summary = data.summary;
  if (data.headline !== undefined && !data.summary) payload.summary = data.headline;
  if (data.description !== undefined) payload.description = data.description;
  if (data.eligibility_criteria !== undefined) payload.eligibility_criteria = data.eligibility_criteria;
  if (data.duration_claim !== undefined) payload.duration = data.duration_claim;
  if (data.duration !== undefined) payload.duration = data.duration;
  if (data.schedule_info !== undefined) payload.schedule_info = data.schedule_info;
  if (data.application_instructions !== undefined) payload.application_instructions = data.application_instructions;
  if (data.quota !== undefined) payload.quota = Number(data.quota);
  if (data.form_schema !== undefined) payload.form_schema = Array.isArray(data.form_schema) ? data.form_schema : [];
  if (data.is_active !== undefined) payload.is_registration_open = Boolean(data.is_active);
  if (data.publication_status) {
    const s = String(data.publication_status).toUpperCase();
    payload.status = s === 'PUBLISHED' ? 'PUBLISHED' : (s === 'ARCHIVED' ? 'ARCHIVED' : 'DRAFT');
  }

  let res = await supabase.from('academic_programs').update(payload).eq('id', targetId).select();
  if ((!res.data || res.data.length === 0) && existing?.slug) {
    res = await supabase.from('academic_programs').update(payload).eq('slug', existing.slug).select();
  }
  return res.data?.[0] || null;
}

/**
 * Toggle academic program active status in Supabase Cloud
 */
export async function toggleSupabaseProgramStatus(idOrSlug, is_active) {
  const existing = await getSupabaseProgramByIdOrSlug(idOrSlug);
  const targetId = existing?.id || idOrSlug;
  const newActive = Boolean(is_active);

  let res = await supabase.from('academic_programs').update({
    is_registration_open: newActive,
    status: newActive ? 'PUBLISHED' : 'DRAFT',
    updated_at: new Date().toISOString()
  }).eq('id', targetId).select();

  return res.data?.[0] || null;
}

/**
 * Update article in Supabase Cloud
 */
export async function updateSupabaseArticle(idOrSlug, data) {
  const existing = await getSupabaseArticleByIdOrSlug(idOrSlug);
  const targetId = existing?.id || idOrSlug;

  const payload = {
    updated_at: new Date().toISOString()
  };
  if (data.title) payload.title = data.title;
  if (data.slug) payload.slug = data.slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  if (data.category) payload.category = data.category;
  if (data.excerpt !== undefined) payload.excerpt = data.excerpt;
  if (data.content !== undefined) payload.body_content = data.content;
  if (data.body_content !== undefined) payload.body_content = data.body_content;
  if (data.thumbnail_url !== undefined) payload.thumbnail_url = data.thumbnail_url;
  if (data.image !== undefined && !data.thumbnail_url) payload.thumbnail_url = data.image;
  if (data.tags !== undefined) payload.tags = Array.isArray(data.tags) ? data.tags : String(data.tags).split(',').map(t => t.trim());
  if (data.author_name) payload.author_name = data.author_name;
  if (data.status) {
    const s = String(data.status).toUpperCase();
    payload.status = s === 'PUBLISHED' ? 'PUBLISHED' : (s === 'ARCHIVED' ? 'ARCHIVED' : 'DRAFT');
  }

  let res = await supabase.from('articles').update(payload).eq('id', targetId).select();
  if ((!res.data || res.data.length === 0) && existing?.slug) {
    res = await supabase.from('articles').update(payload).eq('slug', existing.slug).select();
  }
  return res.data?.[0] || null;
}

/**
 * Toggle article published status in Supabase Cloud
 */
export async function toggleSupabaseArticleStatus(idOrSlug) {
  const existing = await getSupabaseArticleByIdOrSlug(idOrSlug);
  if (!existing) return null;
  const newStatus = existing.status === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
  const res = await supabase.from('articles').update({
    status: newStatus,
    updated_at: new Date().toISOString()
  }).eq('id', existing.id).select();
  return res.data?.[0] || null;
}

/**
 * Update donation campaign in Supabase Cloud
 */
export async function updateSupabaseCampaign(idOrSlug, data) {
  const existing = await getSupabaseCampaignByIdOrSlug(idOrSlug);
  const targetId = existing?.id || idOrSlug;

  const payload = {
    updated_at: new Date().toISOString()
  };
  if (data.title) payload.title = data.title;
  if (data.type) payload.type = data.type;
  if (data.category_name) payload.category_name = data.category_name;
  if (data.target_amount !== undefined) payload.target_amount = Number(data.target_amount);
  if (data.cover_image !== undefined) payload.cover_image = data.cover_image;
  if (data.description !== undefined) payload.description = data.description;
  if (data.end_date !== undefined) payload.end_date = data.end_date || null;
  if (data.status) {
    const s = String(data.status).toLowerCase();
    payload.status = (s === 'active' || s === 'published') ? 'PUBLISHED' : (s === 'closed' ? 'CLOSED' : 'DRAFT');
  }

  let res = await supabase.from('donation_campaigns').update(payload).eq('id', targetId).select();
  if ((!res.data || res.data.length === 0) && existing?.slug) {
    res = await supabase.from('donation_campaigns').update(payload).eq('slug', existing.slug).select();
  }
  return res.data?.[0] || null;
}

/**
 * Update site settings (Identity, Accounts, Contact) in Supabase Cloud
 */
export async function updateSupabaseSiteSettings(key, value, mode = 'publish') {
  const existing = await getSupabaseSiteSettings(key);
  const mergedValue = { ...(existing || {}), ...(value || {}) };

  const payload = {
    key,
    updated_at: new Date().toISOString()
  };
  if (mode === 'draft') {
    payload.draft_value = mergedValue;
  } else {
    payload.value = mergedValue;
    payload.draft_value = mergedValue;
    payload.published_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('site_settings')
    .upsert(payload)
    .select()
    .single();

  if (error) throw error;
  return data?.value || mergedValue;
}

/**
 * Update PPDB Registration status in Supabase Cloud
 */
export async function updateSupabaseRegistrationStatus(id, { status, notes }) {
  const statusMap = {
    submitted: 'SUBMITTED',
    pending: 'SUBMITTED',
    under_review: 'UNDER_REVIEW',
    needs_correction: 'NEEDS_CORRECTION',
    accepted: 'ACCEPTED',
    verified: 'ACCEPTED',
    rejected: 'REJECTED'
  };
  const supaStatus = statusMap[String(status).toLowerCase()] || 'SUBMITTED';

  const payload = {
    status: supaStatus,
    updated_at: new Date().toISOString()
  };
  if (notes !== undefined) payload.admin_notes = notes;

  let res = await supabase.from('program_registrations').update(payload).eq('id', id).select();
  if (!res.data || res.data.length === 0) {
    res = await supabase.from('program_registrations').update(payload).eq('registration_number', id).select();
  }
  return res.data?.[0] || null;
}

/**
 * Update financial transaction verification in Supabase Cloud
 */
export async function updateSupabaseDonationStatus(id, { status, notes, verified_by }) {
  const statusMap = {
    success: 'VERIFIED',
    verified: 'VERIFIED',
    pending: 'PENDING_VERIFICATION',
    rejected: 'REJECTED',
    voided: 'VOIDED'
  };
  const supaStatus = statusMap[String(status).toLowerCase()] || 'PENDING_VERIFICATION';

  const payload = {
    payment_status: supaStatus,
    updated_at: new Date().toISOString()
  };
  if (notes !== undefined) payload.notes = notes;
  if (verified_by) {
    payload.verified_at = new Date().toISOString();
  }

  let res = await supabase.from('financial_transactions').update(payload).eq('id', id).select();
  if (!res.data || res.data.length === 0) {
    res = await supabase.from('financial_transactions').update(payload).eq('invoice_number', id).select();
  }
  return res.data?.[0] || null;
}

/**
 * Create an academic program in Supabase Cloud
 */
export async function createSupabaseProgram(data) {
  const payload = {
    title: data.name || data.title,
    slug: data.slug || (data.name || data.title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    category: data.category === 'formal' ? 'formal' : 'non_formal',
    summary: data.headline || data.summary || data.description || '',
    description: data.description || '',
    eligibility_criteria: data.eligibility_criteria || '',
    duration: data.duration_claim || data.duration || '3 Tahun',
    schedule_info: data.schedule_info || '',
    application_instructions: data.application_instructions || '',
    quota: Number(data.quota || 30),
    form_schema: Array.isArray(data.form_schema) ? data.form_schema : [],
    is_registration_open: data.is_active !== undefined ? Boolean(data.is_active) : true,
    status: data.publication_status ? String(data.publication_status).toUpperCase() : 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data: inserted, error } = await supabase.from('academic_programs').insert(payload).select().single();
  if (error) throw error;
  return inserted;
}

/**
 * Delete an academic program in Supabase Cloud
 */
export async function deleteSupabaseProgram(idOrSlug) {
  const existing = await getSupabaseProgramByIdOrSlug(idOrSlug);
  const targetId = existing?.id || idOrSlug;
  const res = await supabase.from('academic_programs').delete().eq('id', targetId).select();
  return res.data || null;
}

/**
 * Create an article in Supabase Cloud
 */
export async function createSupabaseArticle(data) {
  const payload = {
    title: data.title,
    slug: data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    category: data.category || 'Berita',
    excerpt: data.excerpt || '',
    body_content: data.content || data.body_content || '',
    thumbnail_url: data.thumbnail_url || data.image || '/assets/images/campus.jpg',
    tags: Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(',').map(t => t.trim()) : ['Berita']),
    author_name: data.author_name || 'Tim Media RTM',
    seo_title: data.seo_title || data.title,
    seo_description: data.seo_description || data.excerpt || '',
    status: data.status ? String(data.status).toUpperCase() : 'PUBLISHED',
    published_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data: inserted, error } = await supabase.from('articles').insert(payload).select().single();
  if (error) throw error;
  return inserted;
}

/**
 * Delete an article in Supabase Cloud
 */
export async function deleteSupabaseArticle(idOrSlug) {
  const existing = await getSupabaseArticleByIdOrSlug(idOrSlug);
  const targetId = existing?.id || idOrSlug;
  const res = await supabase.from('articles').delete().eq('id', targetId).select();
  return res.data || null;
}

/**
 * Create a donation campaign in Supabase Cloud
 */
export async function createSupabaseCampaign(data) {
  const payload = {
    title: data.title,
    slug: data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    type: data.type || 'wakaf',
    category_name: data.category_name || 'Wakaf Sarana',
    summary: data.description || '',
    description: data.description || '',
    cover_image: data.cover_image || '/assets/images/campus.jpg',
    target_amount: Number(data.target_amount || 0),
    collected_amount: 0,
    donor_count: 0,
    end_date: data.end_date || null,
    status: (data.status === 'draft') ? 'DRAFT' : 'PUBLISHED',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  const { data: inserted, error } = await supabase.from('donation_campaigns').insert(payload).select().single();
  if (error) throw error;
  return inserted;
}

/**
 * Delete a donation campaign in Supabase Cloud
 */
export async function deleteSupabaseCampaign(idOrSlug) {
  const existing = await getSupabaseCampaignByIdOrSlug(idOrSlug);
  const targetId = existing?.id || idOrSlug;
  const res = await supabase.from('donation_campaigns').delete().eq('id', targetId).select();
  return res.data || null;
}

/**
 * Delete a registration in Supabase Cloud
 */
export async function deleteSupabaseRegistration(id) {
  const res = await supabase.from('program_registrations').delete().eq('id', id).select();
  return res.data || null;
}

/**
 * Financial transaction correction in Supabase Cloud
 */
export async function correctSupabaseDonation(id, { amount, notes, payment_status, reference_number, payment_source }) {
  const payload = {
    updated_at: new Date().toISOString()
  };
  if (amount !== undefined) payload.amount = Number(amount);
  if (notes) payload.notes = notes;
  if (reference_number) payload.reference_number = reference_number;
  if (payment_source) payload.payment_source = payment_source;
  if (payment_status) {
    const s = String(payment_status).toUpperCase();
    payload.payment_status = s === 'SUCCESS' ? 'VERIFIED' : s;
  }
  let res = await supabase.from('financial_transactions').update(payload).eq('id', id).select();
  if (!res.data || res.data.length === 0) {
    res = await supabase.from('financial_transactions').update(payload).eq('invoice_number', id).select();
  }
  return res.data?.[0] || null;
}

export default supabase;
