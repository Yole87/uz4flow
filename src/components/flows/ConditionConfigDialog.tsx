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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { GitBranch, Loader2, Plus, Trash2 } from "lucide-react";

interface SubCondition {
  logic: "and" | "or";
  variable: string;
  operator: string;
  value: string;
}

interface ConditionItem {
  variable: string;
  operator: string;
  value: string;
  subconditions?: SubCondition[];
}

interface ConditionConfig {
  variable: string;
  operator: string;
  value: string;
  conditions?: ConditionItem[];
}

interface ConditionConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: ConditionConfig | null;
  availableVariables: string[];
  onSave: (config: ConditionConfig) => void;
  onDelete?: () => void;
  saving?: boolean;
}

const OPERATORS = [
  { value: "equals", label: "É igual a" },
  { value: "not_equals", label: "Não é igual a" },
  { value: "contains", label: "Contém" },
  { value: "not_contains", label: "Não contém" },
  { value: "starts_with", label: "Começa com" },
  { value: "ends_with", label: "Termina com" },
  { value: "greater_than", label: "Maior que" },
  { value: "less_than", label: "Menor que" },
  { value: "is_empty", label: "Está vazio" },
  { value: "is_not_empty", label: "Não está vazio" },
  { value: "regex", label: "Expressão regular (regex)" },
];

function needsValueForOp(op: string) {
  return !["is_empty", "is_not_empty"].includes(op);
}

export function ConditionConfigDialog({
  open,
  onOpenChange,
  config,
  availableVariables,
  onSave,
  onDelete,
  saving,
}: ConditionConfigDialogProps) {
  const [conditions, setConditions] = useState<ConditionItem[]>([]);

  useEffect(() => {
    if (!open) return;
    if (config?.conditions && config.conditions.length > 0) {
      setConditions(config.conditions.map(c => ({ ...c, subconditions: c.subconditions || [] })));
    } else if (config?.variable) {
      // Legacy single condition format
      setConditions([{ variable: config.variable, operator: config.operator || "equals", value: config.value || "", subconditions: [] }]);
    } else {
      setConditions([{ variable: "", operator: "equals", value: "", subconditions: [] }]);
    }
  }, [config, open]);

  const updateCondition = (idx: number, field: keyof ConditionItem, val: string) => {
    setConditions(prev => prev.map((c, i) => i === idx ? { ...c, [field]: val } : c));
  };

  const addSubcondition = (idx: number) => {
    setConditions(prev => prev.map((c, i) => i === idx ? {
      ...c,
      subconditions: [...(c.subconditions || []), { logic: "and", variable: "", operator: "equals", value: "" }]
    } : c));
  };

  const updateSubcondition = (cIdx: number, sIdx: number, field: keyof SubCondition, val: string) => {
    setConditions(prev => prev.map((c, i) => {
      if (i !== cIdx) return c;
      const subs = [...(c.subconditions || [])];
      subs[sIdx] = { ...subs[sIdx], [field]: val };
      return { ...c, subconditions: subs };
    }));
  };

  const removeSubcondition = (cIdx: number, sIdx: number) => {
    setConditions(prev => prev.map((c, i) => {
      if (i !== cIdx) return c;
      return { ...c, subconditions: (c.subconditions || []).filter((_, j) => j !== sIdx) };
    }));
  };

  const isValid = conditions.length > 0 && conditions.every(c =>
    c.variable.trim() && (!needsValueForOp(c.operator) || c.value.trim())
  );

  const handleSave = () => {
    if (!isValid) return;
    // Save in both old format (for backwards compat in ConditionNode preview) and new format
    const first = conditions[0];
    onSave({
      variable: first.variable.trim(),
      operator: first.operator,
      value: first.value.trim(),
      conditions: conditions.map(c => ({
        variable: c.variable.trim(),
        operator: c.operator,
        value: c.value.trim(),
        subconditions: (c.subconditions || []).filter(s => s.variable.trim()),
      })),
    } as any);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-amber-500" />
            Configurar Condição IF/ELSE
          </DialogTitle>
          <DialogDescription>
            Defina as condições que determinam o caminho do fluxo
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {conditions.map((cond, cIdx) => (
            <div key={cIdx} className="p-3 border border-border/60 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Condição {cIdx + 1}
                </span>
                {conditions.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConditions(prev => prev.filter((_, i) => i !== cIdx))}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Variable */}
              <div className="space-y-1">
                <Label className="text-xs">Variável *</Label>
                <Input
                  placeholder="Ex: nome, email, idade"
                  value={cond.variable}
                  onChange={(e) => updateCondition(cIdx, "variable", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                  className="h-8 text-sm"
                />
                {availableVariables.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {availableVariables.map((v) => (
                      <Badge key={v} variant="outline" className="cursor-pointer hover:bg-muted text-xs" onClick={() => updateCondition(cIdx, "variable", v)}>
                        {`{{${v}}}`}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Operator */}
              <div className="space-y-1">
                <Label className="text-xs">Operador</Label>
                <Select value={cond.operator} onValueChange={(v) => updateCondition(cIdx, "operator", v)}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {OPERATORS.map((op) => (
                      <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Value */}
              {needsValueForOp(cond.operator) && (
                <div className="space-y-1">
                  <Label className="text-xs">Valor *</Label>
                  <Input placeholder="Ex: sim, 18" value={cond.value} onChange={(e) => updateCondition(cIdx, "value", e.target.value)} className="h-8 text-sm" />
                </div>
              )}

              {/* Subconditions */}
              {(cond.subconditions || []).map((sub, sIdx) => (
                <div key={sIdx} className="ml-4 pl-3 border-l-2 border-amber-500/30 space-y-2">
                  <div className="flex items-center gap-2">
                    <Select value={sub.logic} onValueChange={(v) => updateSubcondition(cIdx, sIdx, "logic", v)}>
                      <SelectTrigger className="h-7 w-16 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="and">E</SelectItem>
                        <SelectItem value="or">OU</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input placeholder="Variável" value={sub.variable} onChange={(e) => updateSubcondition(cIdx, sIdx, "variable", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))} className="h-7 text-xs flex-1" />
                    <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeSubcondition(cIdx, sIdx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="flex gap-2">
                    <Select value={sub.operator} onValueChange={(v) => updateSubcondition(cIdx, sIdx, "operator", v)}>
                      <SelectTrigger className="h-7 text-xs flex-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {needsValueForOp(sub.operator) && (
                      <Input placeholder="Valor" value={sub.value} onChange={(e) => updateSubcondition(cIdx, sIdx, "value", e.target.value)} className="h-7 text-xs flex-1" />
                    )}
                  </div>
                </div>
              ))}

              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => addSubcondition(cIdx)}>
                <Plus className="h-3 w-3 mr-1" /> Subcondição
              </Button>
            </div>
          ))}

          {conditions.length < 5 && (
            <Button variant="outline" size="sm" className="w-full" onClick={() => setConditions(prev => [...prev, { variable: "", operator: "equals", value: "", subconditions: [] }])}>
              <Plus className="h-3 w-3 mr-1" /> Adicionar Nova Condição
            </Button>
          )}

          {/* Preview */}
          <div className="p-3 bg-muted/50 rounded-lg">
            <p className="text-xs text-muted-foreground mb-1">Preview:</p>
            {conditions.map((c, i) => (
              <p key={i} className="text-xs">
                {i > 0 && <span className="text-amber-400 font-medium">E </span>}
                Se <code className="text-amber-400">{`{{${c.variable || "?"}}}`}</code>{" "}
                <span className="text-muted-foreground">{OPERATORS.find(o => o.value === c.operator)?.label.toLowerCase() || "?"}</span>{" "}
                {needsValueForOp(c.operator) && <code className="text-primary">{c.value || "?"}</code>}
                {(c.subconditions || []).map((s, j) => (
                  <span key={j}>
                    {" "}<span className="text-amber-400 font-medium">{s.logic === "or" ? "OU" : "E"}</span>{" "}
                    <code className="text-amber-400">{`{{${s.variable || "?"}}}`}</code>{" "}
                    <span className="text-muted-foreground">{OPERATORS.find(o => o.value === s.operator)?.label.toLowerCase() || "?"}</span>{" "}
                    {needsValueForOp(s.operator) && <code className="text-primary">{s.value || "?"}</code>}
                  </span>
                ))}
              </p>
            ))}
            <div className="flex gap-4 mt-2 text-xs">
              <span className="text-emerald-400">✓ Sim → próximo nó</span>
              <span className="text-red-400">✗ Não → outro caminho</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-between gap-2">
          <div>
            {onDelete && (
              <Button variant="destructive" size="sm" onClick={onDelete}>Excluir nó</Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving || !isValid}>
              {saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
