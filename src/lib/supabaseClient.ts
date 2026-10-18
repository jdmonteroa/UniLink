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

/** Traduce errores comunes de Supabase/Postgres a mensajes claros en español. */
export function friendlyError(err: unknown, fallback = 'Ocurrió un error inesperado.'): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
  if (!raw) return fallback;
  const msg = raw.toLowerCase();

  if (msg.includes('failed to fetch') || msg.includes('networkerror'))
    return 'No hay conexión con Supabase. Revisa tu internet y la URL en .env.';
  if (msg.includes('invalid login credentials')) return 'Correo o contraseña incorrectos.';
  if (msg.includes('email not confirmed'))
    return 'Aún no confirmas tu correo. Revisa tu bandeja de entrada (y spam) y abre el enlace de confirmación.';
  if (msg.includes('user already registered')) return 'Ese correo ya tiene cuenta. Inicia sesión.';
  if (msg.includes('database error saving new user') || msg.includes('no pertenece a una universidad'))
    return 'Tu correo no pertenece a una universidad registrada. Usa tu correo institucional.';
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
  if (msg.includes('could not find the function') || msg.includes('does not exist'))
    return 'A tu base de datos le falta una actualización. Corre supabase/setup.sql en el SQL Editor de Supabase.';
  if (msg.includes('row-level security') || msg.includes('permission denied'))
    return 'Supabase rechazó la operación por permisos (RLS). Corre supabase/setup.sql en el SQL Editor.';
  return raw;
}
