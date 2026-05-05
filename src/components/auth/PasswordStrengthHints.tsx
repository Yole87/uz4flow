/**
 * Compatibility shim — re-exports the canonical password rules from
 * `@/lib/passwordRules` so todo o app valida senha do mesmo jeito.
 *
 * Para novas telas use `PasswordHint` + `isPasswordValid` diretamente.
 */
import { PasswordHint } from "./PasswordHint";
import { checkPassword, isPasswordValid } from "@/lib/passwordRules";

export interface PasswordChecks {
  length: boolean;
  uppercase: boolean;
  lowercase: boolean;
  number: boolean;
  special: boolean;
}

export function evaluatePassword(password: string): PasswordChecks {
  const c = checkPassword(password);
  return {
    length: c.length,
    uppercase: c.upper,
    lowercase: c.lower,
    number: c.number,
    special: c.symbol,
  };
}

export function isPasswordStrong(password: string): boolean {
  return isPasswordValid(password);
}

interface Props {
  password: string;
  className?: string;
}

export function PasswordStrengthHints({ password, className }: Props) {
  return <PasswordHint password={password} className={className} />;
}
