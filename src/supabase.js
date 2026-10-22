import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://bnaaxskyzwjeaduasgru.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_d9SGt8oX-Gh4lwhnHfC_ZQ_Y8V2E83f';

// Supabase client instance for frontend browser usage
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
