import { createClient } from '@supabase/supabase-js';

// Use process.env to access environment variables instead of import.meta.env to resolve TypeScript errors
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

// Create client only if credentials exist to avoid immediate fetch errors with placeholder strings
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co', 
  SUPABASE_KEY || 'placeholder'
);