
import { createClient } from '@supabase/supabase-js';

// Accessing environment variables
const env = (import.meta as any).env || {};

// Cloud Supabase Credentials
const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co';
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || 'your-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
