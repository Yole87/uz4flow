import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Save, MessageSquare } from "lucide-react";

const VARIABLES = ["{{nome}}", "{{valor}}", "{{plano}}", "{{vencimento}}", "{{link_pagamento}}", "{{motivo}}"];

export function BillingTemplatesTab() {
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["billing-templates"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("billing_message_templates")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await (supabase as any)
        .from("billing_message_templates")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-templates"] });
      toast.success("Template atualizado!");
      setEditingId(null);
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const handleSaveText = (id: string) => {
    updateMutation.mutate({ id, updates: { message_template: editText } });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-sm text-muted-foreground">Variáveis disponíveis:</span>
        {VARIABLES.map((v) => (
          <Badge key={v} variant="secondary" className="font-mono text-xs">{v}</Badge>
        ))}
      </div>

      {templates.map((tpl: any) => (
        <Card key={tpl.id}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 text-primary" />
              <div>
                <CardTitle className="text-base">{tpl.label}</CardTitle>
                <Badge variant="outline" className="text-xs font-mono mt-1">{tpl.event_type}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Ativo</span>
                <Switch
                  checked={tpl.is_active}
                  onCheckedChange={(val) => updateMutation.mutate({ id: tpl.id, updates: { is_active: val } })}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">WhatsApp</span>
                <Switch
                  checked={tpl.send_via_whatsapp}
                  onCheckedChange={(val) => updateMutation.mutate({ id: tpl.id, updates: { send_via_whatsapp: val } })}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {editingId === tpl.id ? (
              <div className="space-y-2">
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={4}
                  className="font-mono text-sm"
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => handleSaveText(tpl.id)} disabled={updateMutation.isPending}>
                    <Save className="w-4 h-4 mr-1" /> Salvar
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancelar</Button>
                </div>
              </div>
            ) : (
              <p
                className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors whitespace-pre-wrap"
                onClick={() => { setEditingId(tpl.id); setEditText(tpl.message_template); }}
              >
                {tpl.message_template}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
