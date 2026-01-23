import { createClient } from '@supabase/supabase-js';

// Helper to get environment variables from different possible sources
const getEnv = (key: string): string => {
  try {
    // @ts-ignore
    return (typeof process !== 'undefined' && (process.env?.[key] || process.env?.[`VITE_${key}`])) || 
           // @ts-ignore
           (typeof import.meta !== 'undefined' && (import.meta.env?.[key] || import.meta.env?.[`VITE_${key}`])) || 
           '';
  } catch {
    return '';
  }
};

const SUPABASE_URL = getEnv('SUPABASE_URL');
const SUPABASE_KEY = getEnv('SUPABASE_ANON_KEY');

// Strict check to avoid "Failed to fetch" on placeholder URLs
const isConfigured = 
  SUPABASE_URL && 
  SUPABASE_URL.startsWith('http') && 
  !SUPABASE_URL.includes('YOUR_PROJECT') && 
  SUPABASE_KEY && 
  SUPABASE_KEY !== 'your-anon-key' &&
  SUPABASE_KEY !== 'local-placeholder';

const finalUrl = isConfigured ? SUPABASE_URL : 'https://local-mode.supabase.co';
const finalKey = isConfigured ? SUPABASE_KEY : 'local-placeholder';

export const supabase = createClient(finalUrl, finalKey);

// Export a flag to check if we should even bother with remote calls
export const isSupabaseConfigured = isConfigured;