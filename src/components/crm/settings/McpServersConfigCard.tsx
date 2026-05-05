import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Server,
  Plus,
  Trash2,
  Edit2,
  Save,
  X,
  Loader2,
  Check,
  AlertCircle,
  Wifi,
  WifiOff,
  ShieldAlert,
  Zap,
  Eye,
  EyeOff,
} from "lucide-react";

interface McpServerConfig {
  id: string;
  organization_id: string;
  name: string;
  server_url: string;
  tool_name: string;
  description: string | null;
  is_active: boolean;
  auth_type: string;
  auth_token: string | null;
  custom_headers: Record<string, string> | null;
  created_at: string;
  updated_at: string;
}

interface FormData {
  name: string;
  server_url: string;
  tool_name: string;
  description: string;
  auth_type: string;
  auth_token: string;
  custom_headers: string;
}

const emptyForm: FormData = {
  name: "",
  server_url: "",
  tool_name: "",
  description: "",
  auth_type: "none",
  auth_token: "",
  custom_headers: "",
};

export function McpServersConfigCard() {
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  const organizationId = organization?.id;

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);
  const [showToken, setShowToken] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; tools?: { name: string; description: string }[]; error?: string } | null>(null);

  const { data: servers = [], isLoading } = useQuery({
    queryKey: ["mcp-server-configs", organizationId],
    queryFn: async () => {
      if (!organizationId) return [];
      const { data, error } = await supabase
        .from("mcp_server_configs" as any)
        .select("*")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as McpServerConfig[];
    },
    enabled: !!organizationId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!organizationId) throw new Error("Sem organização");
      if (!form.name || !form.server_url || !form.tool_name) {
        throw new Error("Preencha nome, URL e nome da tool");
      }

      let customHeadersParsed = null;
      if (form.auth_type === "custom_headers" && form.custom_headers.trim()) {
        try {
          customHeadersParsed = JSON.parse(form.custom_headers);
        } catch {
          throw new Error("Headers customizados devem ser um JSON válido");
        }
      }

      const payload = {
        organization_id: organizationId,
        name: form.name,
        server_url: form.server_url,
        tool_name: form.tool_name,
        description: form.description || null,
        auth_type: form.auth_type,
        auth_token: form.auth_type === "api_key" ? form.auth_token || null : null,
        custom_headers: customHeadersParsed,
      };

      if (editingId) {
        const { error } = await supabase
          .from("mcp_server_configs" as any)
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("mcp_server_configs" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-server-configs"] });
      toast.success(editingId ? "Servidor atualizado!" : "Servidor adicionado!");
      closeDialog();
    },
    onError: () => {
      toast.error("Erro ao salvar servidor");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("mcp_server_configs" as any)
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-server-configs"] });
    },
    onError: () => {
      toast.error("Erro ao alterar status");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("mcp_server_configs" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mcp-server-configs"] });
      toast.success("Servidor removido!");
    },
    onError: () => {
      toast.error("Erro ao remover servidor");
    },
  });

  const testMutation = useMutation({
    mutationFn: async () => {
      if (!form.server_url) throw new Error("Informe a URL do servidor");

      let customHeadersParsed = null;
      if (form.auth_type === "custom_headers" && form.custom_headers.trim()) {
        try {
          customHeadersParsed = JSON.parse(form.custom_headers);
        } catch {
          throw new Error("Headers customizados devem ser um JSON válido");
        }
      }

      const { data, error } = await supabase.functions.invoke("mcp-test-connection", {
        body: {
          server_url: form.server_url,
          auth_type: form.auth_type,
          auth_token: form.auth_type === "api_key" ? form.auth_token : undefined,
          custom_headers: customHeadersParsed,
        },
      });

      if (error) throw error;
      return data as { success: boolean; tools?: { name: string; description: string }[]; error?: string };
    },
    onSuccess: (data) => {
      setTestResult(data);
      if (data.success) {
        toast.success(`Conexão OK! ${data.tools?.length || 0} ferramenta(s) encontrada(s).`);
      } else {
        toast.error(data.error || "Falha ao conectar");
      }
    },
    onError: (err: any) => {
      setTestResult({ success: false, error: "Erro ao testar conexão" });
      toast.error("Erro ao testar conexão");
    },
  });

  const closeDialog = () => {
    setForm(emptyForm);
    setDialogOpen(false);
    setEditingId(null);
    setShowToken(false);
    setTestResult(null);
  };

  const openNewDialog = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowToken(false);
    setTestResult(null);
    setDialogOpen(true);
  };

  const startEditing = (server: McpServerConfig) => {
    setForm({
      name: server.name,
      server_url: server.server_url,
      tool_name: server.tool_name,
      description: server.description || "",
      auth_type: server.auth_type || "none",
      auth_token: server.auth_token || "",
      custom_headers: server.custom_headers ? JSON.stringify(server.custom_headers, null, 2) : "",
    });
    setEditingId(server.id);
    setShowToken(false);
    setTestResult(null);
    setDialogOpen(true);
  };

  const activeCount = servers.filter((s) => s.is_active).length;

  if (isLoading) {
    return (
      <Card className="bg-card/50 border-accent/20">
        <CardHeader>
          <Skeleton className="h-6 w-48 bg-muted" />
          <Skeleton className="h-4 w-full mt-2 bg-muted" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-10 w-full bg-muted" />
          <Skeleton className="h-10 w-full bg-muted" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="bg-card/50 border-accent/20">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-accent" />
              <CardTitle className="text-foreground">Servidores MCP Externos</CardTitle>
            </div>
            <Badge
              variant="outline"
              className={
                activeCount > 0
                  ? "border-emerald-500/50 text-emerald-500"
                  : "border-muted text-muted-foreground"
              }
            >
              {activeCount > 0 ? (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  {activeCount} ativo{activeCount > 1 ? "s" : ""}
                </>
              ) : (
                <>
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Nenhum configurado
                </>
              )}
            </Badge>
          </div>
          <CardDescription className="text-muted-foreground">
            Configure servidores MCP externos para conectar o Sistema de WhatsApp AI a ferramentas de IA.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {servers.length > 0 && (
            <div className="rounded-lg border border-border divide-y divide-border">
              {servers.map((server) => (
                <div key={server.id} className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      {server.is_active ? (
                        <Wifi className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm font-medium text-foreground truncate">
                        {server.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Switch
                        checked={server.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: server.id, is_active: checked })
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => startEditing(server)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        onClick={() => deleteMutation.mutate(server.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <Badge variant="outline" className="text-xs font-mono">
                      {server.tool_name}
                    </Badge>
                    {server.auth_type !== "none" && (
                      <Badge variant="outline" className="text-xs border-amber-500/50 text-amber-500">
                        <ShieldAlert className="h-2.5 w-2.5 mr-0.5" />
                        {server.auth_type === "api_key" ? "API Key" : "Custom Headers"}
                      </Badge>
                    )}
                    <span className="truncate max-w-[150px] sm:max-w-[250px]">{server.server_url}</span>
                  </div>
                  {server.description && (
                    <p className="text-xs text-muted-foreground">{server.description}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {servers.length === 0 && (
            <div className="p-4 rounded-lg border border-dashed border-border bg-muted/20 text-center">
              <p className="text-sm text-muted-foreground">
                Nenhum servidor MCP configurado. Adicione um para conectar o Sistema de WhatsApp AI a ferramentas externas.
              </p>
            </div>
          )}

          <Button
            variant="outline"
            className="w-full border-dashed"
            onClick={openNewDialog}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Servidor MCP
          </Button>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) closeDialog(); }}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Server className="h-5 w-5 text-accent" />
              <DialogTitle className="text-foreground">
                {editingId ? "Editar Servidor MCP" : "Novo Servidor MCP"}
              </DialogTitle>
            </div>
            <DialogDescription className="text-muted-foreground">
              Configure a conexão com um servidor MCP externo via SSE.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Name */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Nome</Label>
              <Input
                placeholder='Ex: "Servidor Jurídico"'
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="bg-muted border-border text-foreground"
              />
            </div>

            {/* URL */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs">URL SSE do Servidor</Label>
              <Input
                placeholder="https://meu-servidor.com/sse"
                value={form.server_url}
                onChange={(e) => setForm({ ...form, server_url: e.target.value })}
                className="bg-muted border-border text-foreground font-mono text-sm"
              />
              <Alert className="border-amber-500/30 bg-amber-500/5">
                <ShieldAlert className="h-4 w-4 text-amber-500" />
                <AlertDescription className="text-xs text-muted-foreground">
                  Use apenas servidores MCP que você confia e verificou. Servidores maliciosos podem acessar dados sensíveis.
                </AlertDescription>
              </Alert>
            </div>

            {/* Tool Name */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Nome da Tool</Label>
              <Input
                placeholder="Ex: process_message"
                value={form.tool_name}
                onChange={(e) => setForm({ ...form, tool_name: e.target.value })}
                className="bg-muted border-border text-foreground font-mono text-sm"
              />
            </div>

            {/* Auth Type */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Autenticação</Label>
              <Select
                value={form.auth_type}
                onValueChange={(val) => setForm({ ...form, auth_type: val })}
              >
                <SelectTrigger className="bg-muted border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhuma</SelectItem>
                  <SelectItem value="api_key">Access token / API key</SelectItem>
                  <SelectItem value="custom_headers">Custom headers</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* API Key field */}
            {form.auth_type === "api_key" && (
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Token / API Key</Label>
                <div className="relative">
                  <Input
                    type={showToken ? "text" : "password"}
                    placeholder="sk-..."
                    value={form.auth_token}
                    onChange={(e) => setForm({ ...form, auth_token: e.target.value })}
                    className="bg-muted border-border text-foreground font-mono text-sm pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowToken(!showToken)}
                  >
                    {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Custom Headers field */}
            {form.auth_type === "custom_headers" && (
              <div className="space-y-2">
                <Label className="text-foreground text-xs">Headers (JSON)</Label>
                <Textarea
                  placeholder={'{\n  "Authorization": "Bearer sk-...",\n  "X-Custom": "value"\n}'}
                  value={form.custom_headers}
                  onChange={(e) => setForm({ ...form, custom_headers: e.target.value })}
                  className="bg-muted border-border text-foreground resize-none font-mono text-xs"
                  rows={4}
                />
              </div>
            )}

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-foreground text-xs">Descrição (opcional)</Label>
              <Textarea
                placeholder="Descreva o que este servidor faz..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="bg-muted border-border text-foreground resize-none"
                rows={2}
              />
            </div>

            {/* Test Connection */}
            <div className="space-y-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !form.server_url}
              >
                {testMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Testar Conexão
              </Button>

              {testResult && (
                <div className={`p-3 rounded-lg border text-xs ${
                  testResult.success
                    ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                    : "border-destructive/30 bg-destructive/5 text-destructive"
                }`}>
                  {testResult.success ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-1 font-medium">
                        <Check className="h-3.5 w-3.5" />
                        Conexão bem-sucedida!
                      </div>
                      {testResult.tools && testResult.tools.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <span className="text-muted-foreground">Ferramentas disponíveis:</span>
                          {testResult.tools.map((t) => (
                            <div key={t.name} className="flex items-center gap-1 pl-2">
                              <Badge variant="outline" className="text-xs font-mono">
                                {t.name}
                              </Badge>
                              {t.description && (
                                <span className="text-muted-foreground truncate">{t.description}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1">
                      <AlertCircle className="h-3.5 w-3.5" />
                      {testResult.error}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="w-full sm:flex-1"
              >
                {saveMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                ) : (
                  <Save className="h-4 w-4 mr-1" />
                )}
                {editingId ? "Atualizar" : "Adicionar"}
              </Button>
              <Button variant="ghost" onClick={closeDialog} className="w-full sm:w-auto">
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
