import { useState } from "react";
import { useMetaTemplates } from "@/hooks/useMetaTemplates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Loader2, FileText } from "lucide-react";

interface Props {
  instanceId: string;
}

export function MetaTemplatesSection({ instanceId }: Props) {
  const { templates, isLoading, addTemplate, deleteTemplate } = useMetaTemplates(instanceId);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");

  const handleAdd = () => {
    if (!name.trim()) { toast.error("Nome do modelo é obrigatório"); return; }
    addTemplate.mutate(
      { template_name: name.trim(), template_message: message.trim() || undefined },
      {
        onSuccess: () => { setName(""); setMessage(""); toast.success("Template adicionado!"); },
        onError: () => toast.error("Erro ao adicionar template"),
      }
    );
  };

  const handleDelete = (id: string) => {
    deleteTemplate.mutate(id, {
      onSuccess: () => toast.success("Template removido!"),
      onError: () => toast.error("Erro ao remover template"),
    });
  };

  return (
    <div className="space-y-4 p-4 bg-muted/30 rounded-lg border border-border">
      <div className="flex items-center gap-2">
        <FileText className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold text-foreground">Modelos Meta (Templates)</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Cadastre os templates configurados na META. O nome do modelo é usado para enviar a mensagem.
      </p>

      {/* Add form */}
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <div className="space-y-1">
          <Label className="text-xs">Nome do Modelo *</Label>
          <Input value={name} onChange={(e) => setName(e.target.value)}
            placeholder="hello_world" className="text-sm" />
        </div>
        <div className="space-y-1 sm:col-span-1">
          <Label className="text-xs">Mensagem (opcional)</Label>
          <Textarea value={message} onChange={(e) => setMessage(e.target.value)}
            placeholder="Cole aqui o conteúdo do template para referência visual..."
            className="text-sm min-h-[60px] resize-none" rows={2} />
        </div>
        <div className="flex items-end">
          <Button size="sm" onClick={handleAdd} disabled={addTemplate.isPending}>
            {addTemplate.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : templates.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">Nenhum template cadastrado</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border border-border">
          {templates.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 gap-2">
              <div className="flex-1 min-w-0">
                <Badge variant="outline" className="text-xs font-mono">{t.template_name}</Badge>
                {t.template_message && (
                  <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{t.template_message}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => handleDelete(t.id)} disabled={deleteTemplate.isPending}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
