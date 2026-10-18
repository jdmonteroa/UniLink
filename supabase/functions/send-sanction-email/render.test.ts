import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { renderTemplate, sanctionSubject, sanctionVars, escapeHtml, type SanctionPayload } from './render';

const template = readFileSync(new URL('./sancion.html', import.meta.url), 'utf8');
const canonical = readFileSync(new URL('../../email-templates/sancion.html', import.meta.url), 'utf8');

const base: SanctionPayload = {
  name: 'Ana López',
  event_title: 'Fiesta en mi casa',
  reason: 'Lenguaje ofensivo.',
  strike_count: 2,
  limit: 5,
  remaining: 3,
  blocked: false,
};

describe('correo de sanción', () => {
  it('la copia de la función es idéntica a la plantilla oficial', () => {
    expect(template).toBe(canonical);
  });

  it('muestra el conteo y la advertencia antes del bloqueo', () => {
    const html = renderTemplate(template, sanctionVars(base));
    expect(html).toContain('Ana López');
    expect(html).toContain('Fiesta en mi casa');
    expect(html).toContain('Lenguaje ofensivo.');
    expect(html).toContain('2 <span');
    expect(html).toContain('3 sanciones más');
    expect(html).toContain('Aviso de sanción');
    expect(html).not.toContain('Tu cuenta fue <em');
    expect(html).not.toMatch(/\{\{|<!--IF/);
  });

  it('usa singular cuando queda una sola sanción', () => {
    const html = renderTemplate(template, sanctionVars({ ...base, strike_count: 4, remaining: 1 }));
    expect(html).toContain('Te queda <strong>1 sanción más</strong>');
  });

  it('usa plural cuando quedan varias', () => {
    const html = renderTemplate(template, sanctionVars(base));
    expect(html).toContain('Te quedan <strong>3 sanciones más</strong>');
  });

  it('avisa del bloqueo al llegar al límite', () => {
    const p = { ...base, strike_count: 5, remaining: 0, blocked: true };
    const html = renderTemplate(template, sanctionVars(p));
    expect(html).toContain('Cuenta bloqueada');
    expect(html).toContain('bloqueada.</em>');
    expect(html).toContain('bloqueada automáticamente');
    expect(html).not.toContain('Cuida lo que publicas');
    expect(sanctionSubject(p)).toBe('Tu cuenta de UniLink fue bloqueada');
  });

  it('el asunto lleva el conteo', () => {
    expect(sanctionSubject(base)).toBe('Recibiste una sanción en UniLink (2 de 5)');
  });

  it('escapa el HTML de lo que escribió el moderador o la persona', () => {
    const html = renderTemplate(template, sanctionVars({ ...base, reason: '<script>alert(1)</script>', event_title: 'A & "B"' }));
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('A &amp; &quot;B&quot;');
    expect(escapeHtml("'")).toBe('&#39;');
  });
});
