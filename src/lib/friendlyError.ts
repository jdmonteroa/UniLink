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
  if (msg.includes('user is banned') || msg.includes('banned'))
    return 'Tu cuenta está bloqueada por acumular sanciones. Si crees que es un error, contacta a los administradores.';
  if (msg.includes('different from the old password'))
    return 'Elige una contraseña distinta a la anterior.';
  if (msg.includes('weak') && msg.includes('password'))
    return 'Esa contraseña es muy fácil de adivinar. Elige otra más segura.';
  if (msg.includes('password should be at least') || msg.includes('password is too short'))
    return 'La contraseña debe tener al menos 8 caracteres, con letras y números.';
  if (msg.includes('auth session missing') || msg.includes('session not found') || msg.includes('otp_expired') || msg.includes('token has expired'))
    return 'El enlace venció o ya se usó. Pide uno nuevo.';
  if (msg.includes('rate limit') || msg.includes('too many requests'))
    return 'Demasiados intentos. Espera un minuto e inténtalo de nuevo.';
  if (msg.includes('could not find the function') || msg.includes('does not exist'))
    return 'A tu base de datos le falta una actualización. Corre supabase/setup.sql en el SQL Editor de Supabase.';
  if (msg.includes('row-level security') || msg.includes('permission denied'))
    return 'Supabase rechazó la operación por permisos (RLS). Corre supabase/setup.sql en el SQL Editor.';
  return raw;
}
