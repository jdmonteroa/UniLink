/** Regla de contraseña de UniLink (registro y recuperación): 8+ caracteres, con letras y números. */
export const PASSWORD_MIN = 8;

export const passwordChecks = (password: string) => ({
  length: password.length >= PASSWORD_MIN,
  letters: /[A-Za-z]/.test(password),
  numbers: /\d/.test(password),
});

/** Devuelve el motivo si la contraseña no cumple la regla, o null si está bien. */
export function passwordProblem(password: string): string | null {
  const c = passwordChecks(password);
  return c.length && c.letters && c.numbers ? null : `La contraseña debe tener al menos ${PASSWORD_MIN} caracteres, con letras y números.`;
}
