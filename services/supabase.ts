
import { createClient } from '@supabase/supabase-js';

// Helper to get environment variables from different possible sources
const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    return (typeof process !== 'undefined' && process.env?.[key]) || 
           // @ts-ignore
           (typeof import.meta !== 'undefined' && import.meta.env?.[key]) || 
           '';
  } catch {
    return '';
  }
};

const SUPABASE_URL = getEnv('VITE_SUPABASE_URL');
const SUPABASE_KEY = getEnv('VITE_SUPABASE_ANON_KEY');

// Use a safe fallback that won't trigger standard "Failed to fetch" on immediate load 
// if the credentials are empty or purely placeholder strings
const isConfigured = SUPABASE_URL && SUPABASE_URL.startsWith('http') && SUPABASE_KEY;
const finalUrl = isConfigured ? SUPABASE_URL : 'https://local-mode.supabase.co';
const finalKey = isConfigured ? SUPABASE_KEY : 'local-placeholder';

export const supabase = createClient(finalUrl, finalKey);

// Export a flag to check if we should even bother with remote calls
export const isSupabaseConfigured = isConfigured;
