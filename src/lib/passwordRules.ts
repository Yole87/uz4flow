/**
 * Regras centralizadas de senha do sistema.
 * Usadas em telas de cadastro, troca de senha e recuperação.
 */

export const PASSWORD_MIN_LENGTH = 8;

export const PASSWORD_HELP_TEXT =
  "Use pelo menos 8 caracteres, com letra maiúscula, letra minúscula, número e símbolo (!@#$...).";

export const PASSWORD_HELP_SHORT = "Mín. 8 caracteres com maiúscula, minúscula, número e símbolo.";

export interface PasswordChecks {
  length: boolean;
  upper: boolean;
  lower: boolean;
  number: boolean;
  symbol: boolean;
}

export function checkPassword(password: string): PasswordChecks {
  return {
    length: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /\d/.test(password),
    symbol: /[!@#$%^&*(),.?":{}|<>_\-+=/\\[\];'`~]/.test(password),
  };
}

export function isPasswordValid(password: string): boolean {
  const c = checkPassword(password);
  return c.length && c.upper && c.lower && c.number && c.symbol;
}

/**
 * Mensagem amigável em PT-BR descrevendo o que está faltando.
 * Retorna null quando a senha está boa.
 */
export function getPasswordError(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "A senha precisa ter pelo menos 8 caracteres.";
  const c = checkPassword(password);
  const missing: string[] = [];
  if (!c.upper) missing.push("uma letra maiúscula");
  if (!c.lower) missing.push("uma letra minúscula");
  if (!c.number) missing.push("um número");
  if (!c.symbol) missing.push("um símbolo (!@#$...)");
  if (missing.length === 0) return null;
  return `Falta incluir: ${missing.join(", ")}.`;
}
