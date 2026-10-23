import { createClient } from '@supabase/supabase-js';

// Variables de entorno públicas de Vite (.env)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() || '';
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() || '';

/**
 * true cuando el .env tiene credenciales reales. Si es false, la app solo
 * funciona en "modo demo" (datos locales, nada se guarda).
 */
export const isSupabaseConfigured =
  Boolean(supabaseUrl && supabaseAnonKey) &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('your-project-ref');

if (!isSupabaseConfigured) {
  console.warn(
    '[UniLink] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY no están configuradas en .env. La app corre en modo demo.'
  );
}

/**
 * Cliente de Supabase único para toda la app.
 * Solo usa la anon key: toda la seguridad vive en las políticas RLS.
 */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

// friendlyError vive en su propio archivo (sin dependencias) para poder probarlo; se reexporta aquí
// para que el resto de la app siga importándolo desde '@/lib/supabaseClient'.
export { friendlyError } from './friendlyError';
