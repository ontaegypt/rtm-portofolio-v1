import { createClient } from '@supabase/supabase-js';
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

export default supabase;
