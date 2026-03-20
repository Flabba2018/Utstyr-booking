// =============================================================================
// Supabase-klient (singleton)
// Brukes KUN i service-laget, aldri direkte i UI-komponenter
// =============================================================================

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase-konfigurasjon mangler. Sett VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY i .env'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  }
);
