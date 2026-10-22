import { describe, expect, it } from 'vitest';
import { friendlyError } from './friendlyError';

describe('friendlyError', () => {
  it('traduce los errores del flujo de contraseña', () => {
    expect(friendlyError({ message: 'New password should be different from the old password.' })).toBe('Elige una contraseña distinta a la anterior.');
    expect(friendlyError({ message: 'Password is known to be weak and easy to guess' })).toMatch(/muy fácil de adivinar/);
    expect(friendlyError({ message: 'Password should be at least 6 characters.' })).toMatch(/8 caracteres/);
    expect(friendlyError({ message: 'Auth session missing!' })).toMatch(/enlace venció/);
    expect(friendlyError({ message: 'Email link is invalid or has expired (otp_expired)' })).toMatch(/enlace venció/);
  });

  it('traduce límites de envío, red y cuenta bloqueada', () => {
    expect(friendlyError({ message: 'email rate limit exceeded' })).toMatch(/Demasiados intentos/);
    expect(friendlyError(new Error('Failed to fetch'))).toMatch(/No hay conexión/);
    expect(friendlyError({ message: 'User is banned' })).toMatch(/bloqueada/);
    expect(friendlyError({ message: 'Invalid login credentials' })).toBe('Correo o contraseña incorrectos.');
  });

  it('devuelve el texto original o el de respaldo cuando no hay traducción', () => {
    expect(friendlyError({ message: 'algo raro' })).toBe('algo raro');
    expect(friendlyError(null, 'respaldo')).toBe('respaldo');
    expect(friendlyError('')).toBe('Ocurrió un error inesperado.');
  });
});
