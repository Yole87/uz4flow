import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { upsertColumn, deleteColumn, reorderColumns } from "@/services/prospectSourceService";
import type { ProspectSource, ProspectColumn } from "@/types/prospect";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertTriangle,
  Copy,
  Check,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  GripVertical,
  X,
} from "lucide-react";
import { toast } from "sonner";

const SUPABASE_FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL?.replace(".supabase.co", ".supabase.co/functions/v1") ?? ""}`;

interface ColumnsConfigProps {
  source: ProspectSource;
  columns: ProspectColumn[];
}

interface SelectOption {
  label: string;
  color: string;
}

function normalizeSelectOptions(options: any): SelectOption[] {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (typeof opt === "string") {
      return { label: opt, color: "#6366f1" };
    }
    if (opt && typeof opt === "object" && typeof opt.label === "string") {
      return { label: opt.label, color: opt.color || "#6366f1" };
    }
    return { label: String(opt), color: "#6366f1" };
  });
}

function TagInput({
  options,
  onChange,
}: {
  options: SelectOption[];
  onChange: (opts: SelectOption[]) => void;
}) {
  const [input, setInput] = useState("");
  const [color, setColor] = useState("#6366f1");

  const addOption = () => {
    const val = input.trim();
    if (!val) return;
    if (options.some((o) => o.label.toLowerCase() === val.toLowerCase())) {
      toast.error("Opção já existe");
      return;
    }
    onChange([...options, { label: val, color }]);
    setInput("");
    setColor("#6366f1");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <span
            key={opt.label}
            style={{
              backgroundColor: `${opt.color}15`,
              color: opt.color,
              borderColor: `${opt.color}40`,
            }}
            className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs border"
          >
            {opt.label}
            <input
              type="color"
              value={opt.color}
              onChange={(e) => {
                const newColor = e.target.value;
                onChange(
                  options.map((o) =>
                    o.label === opt.label ? { ...o, color: newColor } : o
                  )
                );
              }}
              className="w-3.5 h-3.5 p-0 border-0 rounded-full cursor-pointer overflow-hidden shrink-0"
              style={{ backgroundColor: opt.color }}
              title="Mudar cor"
            />
            <button
              type="button"
              onClick={() => onChange(options.filter((o) => o.label !== opt.label))}
              className="hover:text-destructive transition-colors ml-0.5"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-1.5 items-center">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addOption();
            }
          }}
          placeholder="Nova opção..."
          className="h-7 text-xs bg-background border-border"
        />
        <input
          type="color"
          value={color}
          onChange={(e) => setColor(e.target.value)}
          className="w-7 h-7 p-0 border border-border rounded cursor-pointer shrink-0"
          title="Escolher cor da opção"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={addOption}
          className="h-7 px-2 border-border text-xs"
        >
          Add
        </Button>
      </div>
    </div>
  );
}

interface ColumnRowProps {
  col: ProspectColumn;
  index: number;
  total: number;
  onMoveUp: (id: string) => void;
  onMoveDown: (id: string) => void;
  onSave: (col: ProspectColumn) => void;
  onDelete: (id: string) => void;
}

function ColumnRow({ col, index, total, onMoveUp, onMoveDown, onSave, onDelete }: ColumnRowProps) {
  const [label, setLabel] = useState(col.label);
  const [keyName, setKeyName] = useState(col.key_name);
  const [keyDirty, setKeyDirty] = useState(false);
  const [colType, setColType] = useState<"text" | "select">(col.col_type);
  const [selectOptions, setSelectOptions] = useState<SelectOption[]>(
    normalizeSelectOptions(col.select_options)
  );
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleBlurSave = useCallback(() => {
    onSave({ ...col, label, key_name: keyName, col_type: colType, select_options: selectOptions });
  }, [col, label, keyName, colType, selectOptions, onSave]);

  return (
    <div className="rounded-lg border border-border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        {/* Drag handle (decorative — reorder via buttons) */}
        <GripVertical className="h-4 w-4 text-muted-foreground shrink-0 cursor-grab" />

        {/* Up / Down */}
        <div className="flex flex-col gap-0.5">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => onMoveUp(col.id)}
            className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors"
            aria-label="Mover coluna para cima"
          >
            <ChevronUp className="h-3 w-3" />
          </button>
          <button
            type="button"
            disabled={index === total - 1}
            onClick={() => onMoveDown(col.id)}
            className="h-4 w-4 flex items-center justify-center rounded hover:bg-muted disabled:opacity-30 transition-colors"
            aria-label="Mover coluna para baixo"
          >
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>

        {/* Label */}
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground mb-1 block">Rótulo</Label>
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onBlur={handleBlurSave}
            placeholder="Nome exibido na tabela"
            className="h-8 text-sm bg-background border-border"
          />
        </div>

        {/* Key name */}
        <div className="flex-1 min-w-0">
          <Label className="text-xs text-muted-foreground mb-1 block">Chave (ID do campo)</Label>
          <Tooltip>
            <TooltipTrigger asChild>
              <Input
                value={keyName}
                onChange={(e) => { setKeyName(e.target.value); setKeyDirty(true); }}
                onBlur={handleBlurSave}
                placeholder="ex: nome, whatsapp"
                className="h-8 text-sm bg-background border-border font-mono"
              />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs text-xs">
              Este valor deve ser igual ao ID do campo no Elementor
            </TooltipContent>
          </Tooltip>
          {keyDirty && (
            <p className="text-xs text-warning mt-1 flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Alterar a chave pode quebrar o mapeamento de dados existentes
            </p>
          )}
        </div>

        {/* Type */}
        <div className="w-36 shrink-0">
          <Label className="text-xs text-muted-foreground mb-1 block">Tipo</Label>
          <Select
            value={colType}
            onValueChange={(v) => {
              const newType = v as "text" | "select";
              setColType(newType);
              onSave({ ...col, label, key_name: keyName, col_type: newType, select_options: selectOptions });
            }}
          >
            <SelectTrigger className="h-8 text-sm bg-background border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto livre</SelectItem>
              <SelectItem value="select">Seleção</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Delete */}
        {!confirmDelete ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
            onClick={() => setConfirmDelete(true)}
            aria-label="Excluir campo"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <div className="flex gap-1 shrink-0">
            <Button
              type="button"
              size="sm"
              variant="destructive"
              className="h-7 px-2 text-xs"
              onClick={() => { setConfirmDelete(false); onDelete(col.id); }}
            >
              Confirmar
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => setConfirmDelete(false)}
            >
              Cancelar
            </Button>
          </div>
        )}
      </div>

      {/* Select options */}
      {colType === "select" && (
        <div className="ml-10 pl-1">
          <Label className="text-xs text-muted-foreground mb-1 block">Opções de seleção</Label>
          <TagInput
            options={selectOptions}
            onChange={(opts) => {
              setSelectOptions(opts);
              onSave({ ...col, label, key_name: keyName, col_type: colType, select_options: opts });
            }}
          />
        </div>
      )}
    </div>
  );
}

export function ColumnsConfig({ source, columns }: ColumnsConfigProps) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${SUPABASE_FUNCTIONS_URL}/prospect-webhook?token=${source.webhook_token}`;

  const copyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const upsertMutation = useMutation({
    mutationFn: upsertColumn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prospect-columns", source.id] }),
    onError: () => toast.error("Erro ao salvar campo"),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteColumn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prospect-columns", source.id] });
      toast.success("Campo removido");
    },
    onError: () => toast.error("Erro ao remover campo"),
  });

  const reorderMutation = useMutation({
    mutationFn: reorderColumns,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["prospect-columns", source.id] }),
    onError: () => toast.error("Erro ao reordenar colunas"),
  });

  const sorted = [...columns].sort((a, b) => a.col_order - b.col_order);

  const handleMoveUp = (id: string) => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx <= 0) return;
    const updates = sorted.map((c, i) => {
      if (i === idx - 1) return { id: c.id, col_order: idx };
      if (i === idx) return { id: c.id, col_order: idx - 1 };
      return { id: c.id, col_order: i };
    });
    reorderMutation.mutate(updates);
  };

  const handleMoveDown = (id: string) => {
    const idx = sorted.findIndex((c) => c.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    const updates = sorted.map((c, i) => {
      if (i === idx) return { id: c.id, col_order: idx + 1 };
      if (i === idx + 1) return { id: c.id, col_order: idx };
      return { id: c.id, col_order: i };
    });
    reorderMutation.mutate(updates);
  };

  const handleAddColumn = () => {
    const nextOrder = sorted.length;
    upsertMutation.mutate({
      source_id: source.id,
      key_name: `campo_${nextOrder + 1}`,
      label: `Campo ${nextOrder + 1}`,
      col_type: "text",
      select_options: [],
      col_order: nextOrder,
    });
  };

  return (
    <div className="space-y-6">
      {/* Webhook URL */}
      <Card className="border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-foreground">URL do Webhook</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex gap-2">
            <Input
              readOnly
              value={webhookUrl}
              className="bg-muted border-border font-mono text-xs text-muted-foreground"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={copyUrl}
              className="border-border shrink-0"
              aria-label="Copiar URL do webhook"
            >
              {copied ? (
                <Check className="h-4 w-4 text-success" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Cole esta URL no campo Webhook do seu formulário Elementor
          </p>
        </CardContent>
      </Card>

      {/* Warning */}
      <Alert className="border-warning/40 bg-warning/5">
        <AlertTriangle className="h-4 w-4 text-warning" />
        <AlertDescription className="text-sm text-foreground">
          <strong>Atenção:</strong> o nome do campo (chave) deve ser idêntico ao ID do campo no Elementor.
          Nomes diferentes causarão falha no mapeamento dos dados.
        </AlertDescription>
      </Alert>

      {/* Column list */}
      <Card className="border-border">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-base text-foreground">
            Campos ({sorted.length})
          </CardTitle>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleAddColumn}
            disabled={upsertMutation.isPending}
            className="border-border hover:border-accent/50"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Adicionar campo
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum campo configurado. Adicione campos para mapear os dados do formulário.
            </p>
          ) : (
            sorted.map((col, idx) => (
              <ColumnRow
                key={col.id}
                col={col}
                index={idx}
                total={sorted.length}
                onMoveUp={handleMoveUp}
                onMoveDown={handleMoveDown}
                onSave={(updated) => upsertMutation.mutate(updated)}
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
