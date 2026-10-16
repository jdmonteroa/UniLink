import { describe, it, expect } from 'vitest';
import { cn, formatRelativeTime } from './utils';

describe('Utilidades de UniLink', () => {
  it('combina clases CSS con tailwind-merge y clsx correctamente', () => {
    const result = cn('px-4 py-2', true && 'bg-blue-500', false && 'text-red-500', 'px-6');
    // px-6 should override px-4
    expect(result).toBe('py-2 bg-blue-500 px-6');
  });

  it('formatea fechas relativas en español', () => {
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('Ahora');
  });
});
