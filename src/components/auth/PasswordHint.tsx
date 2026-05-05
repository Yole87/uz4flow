import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { checkPassword } from "@/lib/passwordRules";

interface PasswordHintProps {
  password: string;
  className?: string;
}

const items: Array<{ key: keyof ReturnType<typeof checkPassword>; label: string }> = [
  { key: "length", label: "Pelo menos 8 caracteres" },
  { key: "upper", label: "1 letra maiúscula (A-Z)" },
  { key: "lower", label: "1 letra minúscula (a-z)" },
  { key: "number", label: "1 número (0-9)" },
  { key: "symbol", label: "1 símbolo (!@#$...)" },
];

/**
 * Bloco padrão de orientações de senha — mostra cada requisito
 * com ícone verde/vermelho/cinza para deixar claro o que falta.
 */
export function PasswordHint({ password, className }: PasswordHintProps) {
  const checks = checkPassword(password);
  const showState = password.length > 0;

  return (
    <ul
      className={cn(
        "mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1 text-xs",
        className
      )}
      aria-label="Requisitos de senha"
    >
      {items.map(({ key, label }) => {
        const ok = checks[key];
        return (
          <li
            key={key}
            className={cn(
              "flex items-center gap-1.5 transition-colors",
              ok ? "text-success" : showState ? "text-destructive" : "text-muted-foreground"
            )}
          >
            {ok ? (
              <Check className="w-3.5 h-3.5 shrink-0" />
            ) : (
              <X className="w-3.5 h-3.5 shrink-0" />
            )}
            <span>{label}</span>
          </li>
        );
      })}
    </ul>
  );
}
