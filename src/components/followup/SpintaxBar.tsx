import { Button } from "@/components/ui/button";
import { Variable } from "lucide-react";

interface SpintaxBarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  onInsert: (variable: string) => void;
}

const VARIABLES = [
  { label: "{{NOME}}", description: "Nome do contato" },
  { label: "{{TELEFONE}}", description: "Telefone do contato" },
];

export function SpintaxBar({ textareaRef, onInsert }: SpintaxBarProps) {
  const insertAtCursor = (variable: string) => {
    const el = textareaRef.current;
    if (!el) {
      onInsert(variable);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const end = el.selectionEnd ?? start;
    const before = el.value.substring(0, start);
    const after = el.value.substring(end);
    const newValue = before + variable + after;
    onInsert(newValue);
    // Restore focus & cursor position after React re-render
    setTimeout(() => {
      el.focus();
      const pos = start + variable.length;
      el.setSelectionRange(pos, pos);
    }, 0);
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs text-muted-foreground flex items-center gap-1">
        <Variable className="h-3 w-3" /> Variáveis:
      </span>
      {VARIABLES.map((v) => (
        <Button
          key={v.label}
          type="button"
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => insertAtCursor(v.label)}
          title={v.description}
        >
          {v.label}
        </Button>
      ))}
    </div>
  );
}
