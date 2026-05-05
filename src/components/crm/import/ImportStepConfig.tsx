import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Plus } from "lucide-react";
import { useState, KeyboardEvent } from "react";
import type { ImportConfig } from "@/hooks/useImportContacts";

interface Props {
  organizationId: string;
  config: ImportConfig;
  onChange: (config: Partial<ImportConfig>) => void;
}

export function ImportStepConfig({ organizationId, config, onChange }: Props) {
  const [tagInput, setTagInput] = useState("");

  const { data: stages } = useQuery({
    queryKey: ["import-stages", organizationId],
    queryFn: async () => {
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("is_default", true)
        .maybeSingle();
      if (!pipeline) return [];
      const { data } = await supabase
        .from("stages")
        .select("id, name, color, order_index")
        .eq("pipeline_id", pipeline.id)
        .order("order_index");
      return data || [];
    },
    enabled: !!organizationId,
  });

  const { data: members } = useQuery({
    queryKey: ["import-members", organizationId],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id, first_name, last_name")
        .eq("organization_id", organizationId)
        .eq("is_active", true);
      return data || [];
    },
    enabled: !!organizationId,
  });

  const addTag = (val: string) => {
    const t = val.trim();
    if (!t) return;
    if (config.default_tags.includes(t)) return;
    onChange({ default_tags: [...config.default_tags, t] });
  };

  const removeTag = (t: string) => {
    onChange({ default_tags: config.default_tags.filter((x) => x !== t) });
  };

  const handleTagKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(tagInput);
      setTagInput("");
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Label className="text-xs uppercase tracking-wide">
          Se o telefone já existir
        </Label>
        <RadioGroup
          value={config.dedupe_strategy}
          onValueChange={(v) =>
            onChange({ dedupe_strategy: v as ImportConfig["dedupe_strategy"] })
          }
          className="space-y-2"
        >
          <div className="flex items-start gap-3 rounded-md border border-border/50 p-3 hover:bg-muted/20">
            <RadioGroupItem value="skip" id="skip" className="mt-0.5" />
            <Label htmlFor="skip" className="font-normal cursor-pointer flex-1">
              <div className="font-medium text-sm">Pular</div>
              <div className="text-xs text-muted-foreground">
                Ignora a linha — mantém o contato existente intacto
              </div>
            </Label>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-border/50 p-3 hover:bg-muted/20">
            <RadioGroupItem value="update" id="update" className="mt-0.5" />
            <Label htmlFor="update" className="font-normal cursor-pointer flex-1">
              <div className="font-medium text-sm">Atualizar dados</div>
              <div className="text-xs text-muted-foreground">
                Sobrescreve nome, e-mail e tags do contato existente
              </div>
            </Label>
          </div>
          <div className="flex items-start gap-3 rounded-md border border-border/50 p-3 hover:bg-muted/20">
            <RadioGroupItem value="create_new" id="create_new" className="mt-0.5" />
            <Label htmlFor="create_new" className="font-normal cursor-pointer flex-1">
              <div className="font-medium text-sm">
                Criar novo <span className="text-amber-500">(não recomendado)</span>
              </div>
              <div className="text-xs text-muted-foreground">
                Cria duplicata com sufixo no telefone
              </div>
            </Label>
          </div>
        </RadioGroup>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">Estágio inicial</Label>
          <Select
            value={config.default_stage_id ?? "__none__"}
            onValueChange={(v) =>
              onChange({ default_stage_id: v === "__none__" ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem estágio" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem estágio</SelectItem>
              {stages?.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">Responsável</Label>
          <Select
            value={config.default_assignee_id ?? "__none__"}
            onValueChange={(v) =>
              onChange({ default_assignee_id: v === "__none__" ? null : v })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Sem responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Sem responsável</SelectItem>
              {members?.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.first_name} {m.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">DDI padrão</Label>
          <Input
            value={config.default_country_code}
            onChange={(e) =>
              onChange({
                default_country_code: e.target.value.replace(/\D/g, "").slice(0, 3) || "55",
              })
            }
            placeholder="55"
            maxLength={3}
          />
          <p className="text-xs text-muted-foreground">
            Aplicado a telefones sem código do país
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide">Origem</Label>
          <Input
            value={config.source}
            onChange={(e) => onChange({ source: e.target.value.slice(0, 100) })}
            placeholder="Ex: Planilha Marketing Q1"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide">Tags a aplicar</Label>
        <div className="flex gap-2">
          <Input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={handleTagKey}
            placeholder="Digite e pressione Enter"
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={() => {
              addTag(tagInput);
              setTagInput("");
            }}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        {config.default_tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {config.default_tags.map((t) => (
              <Badge key={t} variant="secondary" className="gap-1">
                {t}
                <button
                  onClick={() => removeTag(t)}
                  className="hover:text-destructive transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
