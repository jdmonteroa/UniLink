import { describe, expect, it } from 'vitest';
import { passwordChecks, passwordProblem, PASSWORD_MIN } from './password';

describe('regla de contraseña', () => {
  it('acepta 8+ caracteres con letras y números', () => {
    expect(passwordProblem('Unilink2026')).toBeNull();
    expect(passwordProblem('abcdefg1')).toBeNull();
  });

  it('rechaza lo corto, sin letras o sin números', () => {
    expect(passwordProblem('Ab1')).toMatch(/8 caracteres/);
    expect(passwordProblem('12345678')).not.toBeNull();
    expect(passwordProblem('soloLetrasAqui')).not.toBeNull();
    expect(passwordProblem('')).not.toBeNull();
  });

  it('el límite es exactamente PASSWORD_MIN', () => {
    expect(PASSWORD_MIN).toBe(8);
    expect(passwordProblem('abcdef1')).not.toBeNull(); // 7
    expect(passwordProblem('abcdefg1')).toBeNull(); // 8
  });

  it('passwordChecks marca cada requisito por separado', () => {
    expect(passwordChecks('abc')).toEqual({ length: false, letters: true, numbers: false });
    expect(passwordChecks('12345678')).toEqual({ length: true, letters: false, numbers: true });
  });
});
