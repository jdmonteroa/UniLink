import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  configured: true,
  auth: {
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
  },
}));

// El cliente real de Supabase no se carga en las pruebas: se simula (friendlyError sí es el real).
vi.mock('@/lib/supabaseClient', async () => {
  const { friendlyError } = await import('@/lib/friendlyError');
  return {
    supabase: { auth: h.auth },
    friendlyError,
    get isSupabaseConfigured() {
      return h.configured;
    },
  };
});

import {
  RESET_SENT_MESSAGE,
  parseAuthLinkError,
  requestPasswordReset,
  resetRedirectUrl,
  updatePassword,
  waitForRecoverySession,
} from './passwordReset';

beforeEach(() => {
  h.configured = true;
  h.auth.resetPasswordForEmail.mockReset().mockResolvedValue({ error: null });
  h.auth.updateUser.mockReset().mockResolvedValue({ error: null });
  h.auth.signOut.mockReset().mockResolvedValue({ error: null });
  h.auth.getSession.mockReset().mockResolvedValue({ data: { session: null } });
  vi.stubGlobal('window', { location: { origin: 'https://app.test' } });
  vi.stubEnv('VITE_APP_URL', '');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('resetRedirectUrl', () => {
  it('usa el origen de la página si no hay VITE_APP_URL', () => {
    expect(resetRedirectUrl()).toBe('https://app.test/restablecer');
  });

  it('usa VITE_APP_URL y quita la diagonal final', () => {
    vi.stubEnv('VITE_APP_URL', 'https://unilinksystem.vercel.app/');
    expect(resetRedirectUrl()).toBe('https://unilinksystem.vercel.app/restablecer');
  });
});

describe('requestPasswordReset', () => {
  it('manda el correo normalizado con la dirección de regreso', async () => {
    const res = await requestPasswordReset('  Ana.Lopez@EDU.uaa.mx ');
    expect(h.auth.resetPasswordForEmail).toHaveBeenCalledWith('ana.lopez@edu.uaa.mx', { redirectTo: 'https://app.test/restablecer' });
    expect(res).toEqual({ success: true, message: RESET_SENT_MESSAGE });
  });

  it('el mensaje de éxito no revela si la cuenta existe', () => {
    expect(RESET_SENT_MESSAGE).toMatch(/^Si ese correo tiene una cuenta/);
  });

  it('no llama a Supabase si falta el correo o el entorno no está configurado', async () => {
    expect((await requestPasswordReset('sin-arroba')).success).toBe(false);
    h.configured = false;
    expect((await requestPasswordReset('a@edu.uaa.mx')).success).toBe(false);
    expect(h.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });

  it('traduce el límite de envíos', async () => {
    h.auth.resetPasswordForEmail.mockResolvedValue({ error: { message: 'email rate limit exceeded' } });
    const res = await requestPasswordReset('a@edu.uaa.mx');
    expect(res.success).toBe(false);
    expect(res.message).toMatch(/Demasiados intentos/);
  });
});

describe('updatePassword', () => {
  it('rechaza una contraseña débil sin llamar a Supabase', async () => {
    const res = await updatePassword('corta1');
    expect(res.success).toBe(false);
    expect(h.auth.updateUser).not.toHaveBeenCalled();
  });

  it('guarda la contraseña y cierra las demás sesiones', async () => {
    const res = await updatePassword('NuevaClave2026');
    expect(h.auth.updateUser).toHaveBeenCalledWith({ password: 'NuevaClave2026' });
    expect(h.auth.signOut).toHaveBeenCalledWith({ scope: 'others' });
    expect(res.success).toBe(true);
  });

  it('si cerrar las otras sesiones falla, el cambio de contraseña igual cuenta', async () => {
    h.auth.signOut.mockRejectedValue(new Error('red caída'));
    expect((await updatePassword('NuevaClave2026')).success).toBe(true);
  });

  it('traduce "misma contraseña" y enlace vencido', async () => {
    h.auth.updateUser.mockResolvedValue({ error: { message: 'New password should be different from the old password.' } });
    expect((await updatePassword('NuevaClave2026')).message).toBe('Elige una contraseña distinta a la anterior.');
    h.auth.updateUser.mockResolvedValue({ error: { message: 'Auth session missing!' } });
    expect((await updatePassword('NuevaClave2026')).message).toMatch(/enlace venció/);
    expect(h.auth.signOut).not.toHaveBeenCalled();
  });
});

describe('parseAuthLinkError', () => {
  it('no hay error en un enlace bueno o sin hash', () => {
    expect(parseAuthLinkError('')).toBeNull();
    expect(parseAuthLinkError('#access_token=abc&refresh_token=def&type=recovery')).toBeNull();
  });

  it('distingue enlace vencido de enlace inválido', () => {
    expect(parseAuthLinkError('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired')).toBe('expired');
    expect(parseAuthLinkError('#error=access_denied&error_description=Something+else')).toBe('invalid');
  });
});

describe('waitForRecoverySession', () => {
  it('es true en cuanto hay sesión', async () => {
    h.auth.getSession.mockResolvedValue({ data: { session: { user: { id: 'u1' } } } });
    expect(await waitForRecoverySession(500)).toBe(true);
  });

  it('es false si la sesión nunca llega', async () => {
    expect(await waitForRecoverySession(300)).toBe(false);
    expect(h.auth.getSession.mock.calls.length).toBeGreaterThan(1);
  });
});
