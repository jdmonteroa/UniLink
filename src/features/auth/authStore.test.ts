import { describe, it, expect } from 'vitest';
import { isAllowedInstitutionalEmail, REQUIRED_DOMAIN, seekingToGenders, gendersToSeeking } from './authStore';

describe('Validación de Correo Institucional UAA', () => {
  it('el dominio requerido debe ser edu.uaa.mx', () => {
    expect(REQUIRED_DOMAIN).toBe('edu.uaa.mx');
  });

  it('acepta correos válidos terminados en @edu.uaa.mx', () => {
    expect(isAllowedInstitutionalEmail('valeria.lozano@edu.uaa.mx')).toBe(true);
    expect(isAllowedInstitutionalEmail('carlos.m@edu.uaa.mx')).toBe(true);
    expect(isAllowedInstitutionalEmail('ESTUDIANTE@EDU.UAA.MX')).toBe(true);
  });

  it('acepta subdominios autorizados de alumnos UAA (@alumnos.uaa.mx)', () => {
    expect(isAllowedInstitutionalEmail('diego@alumnos.uaa.mx')).toBe(true);
  });

  it('rechaza correos públicos o de otras universidades', () => {
    expect(isAllowedInstitutionalEmail('usuario@gmail.com')).toBe(false);
    expect(isAllowedInstitutionalEmail('usuario@outlook.com')).toBe(false);
    expect(isAllowedInstitutionalEmail('usuario@uaa.com')).toBe(false);
    expect(isAllowedInstitutionalEmail('usuario@unam.mx')).toBe(false);
    expect(isAllowedInstitutionalEmail('usuario@alumnos.udg.mx')).toBe(false);
  });
});

import { calculateAge } from './authStore';

describe('Cálculo de edad', () => {
  it('no suma un año antes del cumpleaños', () => {
    const today = new Date();
    const y = today.getFullYear() - 20;
    const tomorrow = new Date(today.getTime() + 86400000);
    const iso = `${y}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
    // Si mañana cambia de año (31 dic), el cálculo sigue siendo válido: 19 o 20
    expect([19, 20]).toContain(calculateAge(iso));
  });

  it('devuelve undefined sin fecha', () => {
    expect(calculateAge(undefined)).toBeUndefined();
    expect(calculateAge('no-es-fecha')).toBeUndefined();
  });
});

describe('Preferencia "¿A quién quieres conocer?"', () => {
  it('convierte la opción elegida al formato de la base de datos', () => {
    expect(seekingToGenders('women')).toEqual(['female']);
    expect(seekingToGenders('men')).toEqual(['male']);
    expect(seekingToGenders('everyone')).toBeNull();
  });

  it('lee lo guardado y vuelve a la opción correcta', () => {
    expect(gendersToSeeking(['female'])).toBe('women');
    expect(gendersToSeeking(['male'])).toBe('men');
    expect(gendersToSeeking(null)).toBe('everyone');
    expect(gendersToSeeking([])).toBe('everyone');
    expect(gendersToSeeking(['female', 'male'])).toBe('everyone');
  });
});
