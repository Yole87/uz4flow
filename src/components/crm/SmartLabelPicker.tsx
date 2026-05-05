import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tag, Plus, Loader2 } from "lucide-react";
import * as Icons from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useSmartLabels } from "@/hooks/useSmartLabels";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface SmartLabelPickerProps {
  contactId: string;
  selectedKeys: string[];
  triggerClassName?: string;
  align?: "start" | "center" | "end";
}

const PRESET_COLORS = [
  "#F59E0B", "#22C55E", "#3B82F6", "#A855F7", "#14B8A6",
  "#EF4444", "#EC4899", "#06B6D4", "#84CC16", "#71717a",
];

export function SmartLabelPicker({ contactId, selectedKeys, triggerClassName, align = "end" }: SmartLabelPickerProps) {
  const { labels, isLoading, toggleOnContact, create } = useSmartLabels();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [busy, setBusy] = useState(false);

  const handleToggle = async (key: string, enabled: boolean) => {
    setBusy(true);
    try {
      await toggleOnContact({ contactId, key, enabled });
    } finally {
      setBusy(false);
    }
  };

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await create({ name: newName.trim(), color: newColor });
      setNewName("");
      setCreating(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-7 gap-1.5 text-xs", triggerClassName)}
          aria-label="Etiquetas inteligentes"
        >
          <Tag className="h-3.5 w-3.5" />
          <span>Etiquetas</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-2 bg-popover border-border" sideOffset={6}>
        <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-2 py-1.5">
          Etiquetas
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto quantum-scrollbar">
            {labels.map((label) => {
              const Icon = (label.icon && (Icons as any)[label.icon]) as LucideIcon | undefined;
              const checked = selectedKeys.includes(label.key);
              return (
                <label
                  key={label.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={checked}
                    disabled={busy}
                    onCheckedChange={(v) => handleToggle(label.key, !!v)}
                  />
                  {Icon && (
                    <Icon className="h-3.5 w-3.5" style={{ color: label.color }} />
                  )}
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: label.color }}
                    aria-hidden="true"
                  />
                  <span className="flex-1 truncate text-foreground">{label.name}</span>
                  {label.is_system && (
                    <span className="text-[9px] text-muted-foreground uppercase">sys</span>
                  )}
                </label>
              );
            })}
          </div>
        )}

        <div className="border-t border-border mt-2 pt-2">
          {creating ? (
            <div className="space-y-2 px-1">
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nome da etiqueta"
                className="h-8 text-sm"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreate();
                  if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
              />
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setNewColor(c)}
                    className={cn(
                      "h-5 w-5 rounded-full border-2 transition-transform",
                      newColor === c ? "border-foreground scale-110" : "border-transparent"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Cor ${c}`}
                  />
                ))}
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleCreate} disabled={!newName.trim() || busy}>
                  Criar
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setCreating(false); setNewName(""); }}>
                  Cancelar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start gap-2 h-8 text-xs"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Nova etiqueta
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
