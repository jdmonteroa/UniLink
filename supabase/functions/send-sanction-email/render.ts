// Funciones puras (sin APIs de Deno) para poder probarlas con vitest.

export interface SanctionPayload {
  name: string;
  event_title: string;
  reason: string;
  strike_count: number;
  limit: number;
  remaining: number;
  blocked: boolean;
}

export type TemplateVars = Record<string, string | number | boolean>;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Reemplaza {{variable}} (escapando el HTML) y resuelve los bloques
 * <!--IF:variable-->…<!--/IF:variable--> y <!--IFNOT:variable-->…<!--/IFNOT:variable-->.
 */
export function renderTemplate(html: string, vars: TemplateVars): string {
  const truthy = (key: string) => Boolean(vars[key]);
  return html
    .replace(/<!--IF:(\w+)-->([\s\S]*?)<!--\/IF:\1-->/g, (_m, key: string, body: string) => (truthy(key) ? body : ''))
    .replace(/<!--IFNOT:(\w+)-->([\s\S]*?)<!--\/IFNOT:\1-->/g, (_m, key: string, body: string) => (truthy(key) ? '' : body))
    .replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, key: string) => (key in vars ? escapeHtml(String(vars[key])) : ''));
}

export function sanctionVars(p: SanctionPayload): TemplateVars {
  const remaining = Math.max(p.remaining, 0);
  return {
    nombre: p.name,
    evento: p.event_title,
    motivo: p.reason,
    sanciones: p.strike_count,
    limite: p.limit,
    restantes: remaining,
    restantes_texto: remaining === 1 ? '1 sanción más' : `${remaining} sanciones más`,
    restantes_sufijo: remaining === 1 ? '' : 'n',
    bloqueada: p.blocked,
  };
}

export function sanctionSubject(p: SanctionPayload): string {
  return p.blocked
    ? 'Tu cuenta de UniLink fue bloqueada'
    : `Recibiste una sanción en UniLink (${p.strike_count} de ${p.limit})`;
}
