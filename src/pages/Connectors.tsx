import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Plug, Copy, ExternalLink, MoreVertical, Trash2, Edit, Power, PowerOff, History } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useEffectiveUserId } from "@/hooks/useEffectiveUserId";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { LimitAlert } from "@/components/LimitAlert";
import { useOrganizationLimits } from "@/hooks/useOrganizationLimits";
import { useWebhookUrls } from "@/hooks/useWebhookUrls";
import { EmptyState } from "@/components/ui/empty-state";

interface Connector {
  id: string;
  name: string;
  description: string | null;
  source_type: string;
  webhook_token: string;
  is_active: boolean;
  sample_payload: Record<string, unknown> | null;
  field_mappings: unknown[] | null;
  created_at: string;
}

import { SOURCE_LABELS, SOURCE_COLORS } from "@/lib/provider-colors";

export default function Connectors() {
  const [connectors, setConnectors] = useState<Connector[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [connectorToDelete, setConnectorToDelete] = useState<string | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();
  const { effectiveUserId } = useEffectiveUserId();
  const navigate = useNavigate();
  const { hasFeature, loading: limitsLoading } = useOrganizationLimits();
  const { getConnectorUrl, baseUrl: webhookBaseUrlRaw, loading: webhookLoading } = useWebhookUrls();

  const canCreateConnector = !limitsLoading && hasFeature("automations");
  const connectorLimitReached = !limitsLoading && !hasFeature("automations");

  const webhookBaseUrl = webhookBaseUrlRaw ? `${webhookBaseUrlRaw}/external-webhook` : "";

  useEffect(() => {
    if (effectiveUserId) {
      fetchConnectors();
    }
  }, [effectiveUserId]);

  async function fetchConnectors() {
    try {
      const { data, error } = await supabase
        .from("webhook_connectors")
        .select("*")
        .eq("user_id", effectiveUserId!)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setConnectors((data as Connector[]) || []);
    } catch (error) {
      console.error("Error fetching connectors:", error);
      toast({
        title: "Erro ao carregar conectores",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function toggleActive(id: string, currentValue: boolean) {
    try {
      const { error } = await supabase
        .from("webhook_connectors")
        .update({ is_active: !currentValue })
        .eq("id", id);

      if (error) throw error;

      setConnectors(prev =>
        prev.map(c => (c.id === id ? { ...c, is_active: !currentValue } : c))
      );

      toast({
        title: !currentValue ? "Conector ativado" : "Conector desativado",
      });
    } catch (error) {
      console.error("Error toggling connector:", error);
      toast({
        title: "Erro ao atualizar conector",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase
        .from("webhook_connectors")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setConnectors(prev => prev.filter(c => c.id !== id));
      toast({ title: "Conector excluído com sucesso" });
    } catch (error) {
      console.error("Error deleting connector:", error);
      toast({
        title: "Erro ao excluir conector",
        variant: "destructive",
      });
    } finally {
      setDeleteDialogOpen(false);
      setConnectorToDelete(null);
    }
  }

  function copyWebhookUrl(token: string) {
    const url = getConnectorUrl(token);
    navigator.clipboard.writeText(url);
    toast({ title: "URL copiada para a área de transferência" });
  }

  function getConnectorStatus(connector: Connector): { label: string; variant: "default" | "secondary" | "outline" } {
    if (!connector.field_mappings || connector.field_mappings.length === 0) {
      return { label: "Aguardando configuração", variant: "outline" };
    }
    if (!connector.is_active) {
      return { label: "Inativo", variant: "secondary" };
    }
    return { label: "Ativo", variant: "default" };
  }

  if (loading) {
    return (
      <AppLayout title="Conectores" description="Receba webhooks de plataformas externas">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout title="Conectores" description="Receba webhooks de plataformas externas">
      <div className="space-y-6">
        {/* Limit Alert */}
        <LimitAlert feature="automations" />

        {/* Action Button */}
        <div className="flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <span>
                <Button 
                  onClick={() => navigate("/connectors/new")} 
                  className="gap-2 w-full sm:w-auto"
                  disabled={connectorLimitReached}
                >
                  <Plus className="h-4 w-4" />
                  Novo Conector
                </Button>
              </span>
            </TooltipTrigger>
            {connectorLimitReached && (
              <TooltipContent>
                <p>Você atingiu o limite de conectores do seu plano</p>
              </TooltipContent>
            )}
          </Tooltip>
        </div>

        {/* Empty State */}
        {connectors.length === 0 ? (
          <EmptyState
            variant="card"
            icon={Plug}
            title="Nenhuma integração conectada"
            description="Conecte WhatsApp, Instagram ou plataformas de vendas (Kiwify, Hotmart, etc.) para enviar mensagens automáticas quando uma venda for realizada."
            action={{
              label: connectorLimitReached ? "Limite atingido" : "Adicionar conector",
              onClick: () => !connectorLimitReached && navigate("/connectors/new"),
              icon: Plus,
            }}
          />
        ) : (
          /* Connectors Grid */
          <div className="grid gap-3 sm:gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connectors.map(connector => {
              const status = getConnectorStatus(connector);
              return (
                <Card key={connector.id} className="relative">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className={SOURCE_COLORS[connector.source_type] || SOURCE_COLORS.custom}>
                          {SOURCE_LABELS[connector.source_type] || connector.source_type}
                        </Badge>
                        <Badge variant={status.variant}>{status.label}</Badge>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/connectors/${connector.id}`)}>
                            <Edit className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate(`/connectors/${connector.id}/history`)}>
                            <History className="h-4 w-4 mr-2" />
                            Histórico
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setConnectorToDelete(connector.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardTitle className="text-lg mt-2">{connector.name}</CardTitle>
                    {connector.description && (
                      <CardDescription>{connector.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Webhook URL */}
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        URL do Webhook
                      </label>
                      <div className="flex items-center gap-2 min-w-0">
                        <code className="flex-1 text-xs bg-muted px-2 py-1.5 rounded truncate">
                          {webhookBaseUrl}?token=****{connector.webhook_token.slice(-4)}
                        </code>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8 shrink-0"
                          onClick={() => copyWebhookUrl(connector.webhook_token)}
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {/* Toggle Active */}
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm">
                        {connector.is_active ? (
                          <Power className="h-4 w-4 text-success" />
                        ) : (
                          <PowerOff className="h-4 w-4 text-muted-foreground" />
                        )}
                        <span className="text-muted-foreground">
                          {connector.is_active ? "Ativo" : "Inativo"}
                        </span>
                      </div>
                      <Switch
                        checked={connector.is_active}
                        onCheckedChange={() => toggleActive(connector.id, connector.is_active)}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conector?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os eventos recebidos por este conector
              também serão excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => connectorToDelete && handleDelete(connectorToDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
