
import { createClient } from '@supabase/supabase-js';

// These should be in .env file in production
// For now, these are placeholders. User must replace them or set Environment Variables in Vercel.

// Safely access env to prevent "Cannot read properties of undefined"
// In some environments, import.meta.env might not be defined during initial load or tests
const env = (import.meta as any).env || {};

const SUPABASE_URL = env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_KEY = env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
