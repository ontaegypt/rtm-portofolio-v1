import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://bnaaxskyzwjeaduasgru.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_d9SGt8oX-Gh4lwhnHfC_ZQ_Y8V2E83f';

// Supabase client instance with admin/service capabilities if service key is provided
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

export default supabase;
