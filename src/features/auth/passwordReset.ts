import { supabase, isSupabaseConfigured, friendlyError } from '@/lib/supabaseClient';
import { passwordProblem } from '@/lib/password';
import type { ActionResult } from '@/features/auth/authStore';

/** Ruta pública a la que llega la persona desde el enlace del correo. */
export const RESET_PATH = '/restablecer';

/** Mensaje al pedir el enlace. Es el mismo exista o no la cuenta, para no revelar quién está registrado. */
export const RESET_SENT_MESSAGE =
  'Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también tu carpeta de spam; el enlace vence pronto.';

const NOT_CONFIGURED = 'Supabase no está configurado en el archivo .env. Agrega tus llaves para recuperar contraseñas.';

/** URL absoluta a la que Supabase redirige tras abrir el enlace (debe estar en la lista de Redirect URLs). */
export function resetRedirectUrl(): string {
  const envBase = import.meta.env.VITE_APP_URL as string | undefined;
  const base = envBase || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base.replace(/\/+$/, '')}${RESET_PATH}`;
}

/** Pide a Supabase que mande el correo de "restablecer contraseña". */
export async function requestPasswordReset(email: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { success: false, message: NOT_CONFIGURED };
  const clean = email.trim().toLowerCase();
  if (!clean.includes('@')) return { success: false, message: 'Escribe tu correo institucional.' };

  const { error } = await supabase.auth.resetPasswordForEmail(clean, { redirectTo: resetRedirectUrl() });
  if (error) return { success: false, message: friendlyError(error, 'No se pudo enviar el correo. Inténtalo de nuevo.') };
  return { success: true, message: RESET_SENT_MESSAGE };
}

/** Guarda la contraseña nueva (la sesión de recuperación ya está abierta) y cierra las demás sesiones. */
export async function updatePassword(newPassword: string): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { success: false, message: NOT_CONFIGURED };
  const problem = passwordProblem(newPassword);
  if (problem) return { success: false, message: problem };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { success: false, message: friendlyError(error, 'No se pudo cambiar la contraseña.') };

  // Por seguridad, si alguien más tenía la cuenta abierta en otro dispositivo, deja de tener acceso.
  try {
    await supabase.auth.signOut({ scope: 'others' });
  } catch {
    // no es crítico: la contraseña ya cambió
  }
  return { success: true };
}

export type LinkProblem = 'expired' | 'invalid' | null;

/**
 * Cuando el enlace del correo ya venció o ya se usó, Supabase redirige con el error en el hash de la
 * URL (p. ej. #error=access_denied&error_code=otp_expired). Devuelve qué pasó, o null si no hay error.
 */
export function parseAuthLinkError(hash: string): LinkProblem {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (!params.get('error') && !params.get('error_code')) return null;
  const detail = `${params.get('error_code') ?? ''} ${params.get('error_description') ?? ''}`.toLowerCase();
  return detail.includes('expired') ? 'expired' : 'invalid';
}

/** Espera (hasta `timeoutMs`) a que Supabase termine de leer el enlace y abra la sesión de recuperación. */
export async function waitForRecoverySession(timeoutMs = 4000): Promise<boolean> {
  const started = Date.now();
  for (;;) {
    const { data } = await supabase.auth.getSession();
    if (data.session) return true;
    if (Date.now() - started >= timeoutMs) return false;
    await new Promise((r) => setTimeout(r, 250));
  }
}
