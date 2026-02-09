import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '../utils/logger';

const log = createLogger('supabase');

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  log.warn('Missing Supabase environment variables. Running in demo mode with sample data.');
}

// Create client without strict typing for flexibility
// Types are enforced at the application layer instead
export const supabase: SupabaseClient | null = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export const isSupabaseConfigured = () => !!supabase;
