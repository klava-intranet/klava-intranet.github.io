import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY (web/.env.local)');

// Todas as tabelas/RPCs da intranet vivem no schema "intranet"
export const sb = createClient(url, key, {
  db: { schema: 'intranet' },
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
