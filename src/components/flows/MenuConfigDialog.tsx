import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, Loader2, GripVertical } from "lucide-react";

export interface MenuConfig {
  message: string;
  menu_type: string;
  options: string[];
  error_enabled: boolean;
  error_message: string;
}

interface MenuConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: MenuConfig | null;
  saving: boolean;
  onSave: (config: MenuConfig) => void;
}

export function MenuConfigDialog({
  open,
  onOpenChange,
  config,
  saving,
  onSave,
}: MenuConfigDialogProps) {
  const [message, setMessage] = useState("");
  const [menuType, setMenuType] = useState("numbered");
  const [options, setOptions] = useState<string[]>(["", "", ""]);
  const [errorEnabled, setErrorEnabled] = useState(false);
  const [errorMessage, setErrorMessage] = useState("Opção inválida. Digite o número correspondente.");

  useEffect(() => {
    if (open && config) {
      setMessage(config.message || "");
      setMenuType(config.menu_type || "numbered");
      setOptions(config.options?.length >= 2 ? config.options : ["", "", ""]);
      setErrorEnabled(config.error_enabled || false);
      setErrorMessage(config.error_message || "Opção inválida. Digite o número correspondente.");
    } else if (open) {
      setMessage("");
      setMenuType("numbered");
      setOptions(["", "", ""]);
      setErrorEnabled(false);
      setErrorMessage("Opção inválida. Digite o número correspondente.");
    }
  }, [open, config]);

  const addOption = () => {
    if (options.length < 10) {
      setOptions([...options, ""]);
    }
  };

  const removeOption = (index: number) => {
    if (options.length <= 2) return;
    setOptions(options.filter((_, i) => i !== index));
  };

  const updateOption = (index: number, value: string) => {
    const updated = [...options];
    updated[index] = value;
    setOptions(updated);
  };

  const getOptionLabel = (o: string | { label: string; value: string }): string =>
    typeof o === "string" ? o : o?.label || "";

  const handleSave = () => {
    const filledOptions = options.filter((o) => getOptionLabel(o).trim());
    if (filledOptions.length < 2) {
      return;
    }
    onSave({
      message,
      menu_type: menuType,
      options: filledOptions.map((o) => getOptionLabel(o)),
      error_enabled: errorEnabled,
      error_message: errorMessage,
    });
  };

  const filledCount = options.filter((o) => getOptionLabel(o).trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Menu</DialogTitle>
          <DialogDescription>
            Configure as opções do menu interativo. O contato responde com o número da opção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Message */}
          <div className="space-y-2">
            <Label>Mensagem de explicação do menu</Label>
            <Textarea
              placeholder="Escolha uma opção digitando o número correspondente:"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Texto enviado antes das opções. Use {"{{pushName}}"} para o nome do contato.
            </p>
          </div>

          {/* Menu Type */}
          <div className="space-y-2">
            <Label>Tipo de Menu</Label>
            <Select value={menuType} onValueChange={setMenuType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="numbered">Texto Numerado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Opções do Menu</Label>
              <span className="text-xs text-muted-foreground">{filledCount} opções</span>
            </div>

            {options.map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                  <span className="text-sm font-bold text-indigo-400 w-5 text-center">{i + 1}</span>
                </div>
                <Input
                  placeholder={`Opção ${i + 1}`}
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  className="flex-1"
                />
                {options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 h-8 w-8"
                    onClick={() => removeOption(i)}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}

            <Button
              variant="outline"
              size="sm"
              onClick={addOption}
              disabled={options.length >= 10}
              className="w-full"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Adicionar Opção
            </Button>
          </div>

          {/* Error Config */}
          <div className="space-y-3 border-t border-border/50 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="error-toggle">Mensagem de erro customizada</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Enviada quando o contato digita uma opção inválida
                </p>
              </div>
              <Switch
                id="error-toggle"
                checked={errorEnabled}
                onCheckedChange={setErrorEnabled}
              />
            </div>

            {errorEnabled && (
              <Textarea
                placeholder="Opção inválida. Por favor, digite o número correspondente."
                value={errorMessage}
                onChange={(e) => setErrorMessage(e.target.value)}
                rows={2}
              />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving || filledCount < 2} onClick={handleSave}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
