import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, MessageSquare, Workflow, CheckCircle2, Clock, Trash2 } from "lucide-react";
import { CRMCredentialsTab } from "./CRMCredentialsTab";
import { FlowsCredentialsTab } from "./FlowsCredentialsTab";
import { useAuth } from "@/lib/auth";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface Instance {
  id: string;
  name: string;
  provider: string;
  openbot_instance_id: string | null;
  has_openbot_api_key: boolean;
  api_url: string | null;
}

interface Props {
  instance: Instance;
}

export function InstanceDetailCard({ instance }: Props) {
  const { user } = useAuth();
  const isComplete = !!instance.openbot_instance_id && instance.has_openbot_api_key;
  // Auto-expand when credentials are missing — strong visual hint
  const [open, setOpen] = useState(!isComplete);
  const queryClient = useQueryClient();

  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const crmWebhookUrl = `${baseUrl}/functions/v1/crm-openbot-inbound?instance_id=${instance.id}`;
  const flowsWebhookUrl = `${baseUrl}/functions/v1/openbot-webhook?user_id=${user?.id}&instance_id=${instance.id}`;

  const handleDelete = async () => {
    try {
      const { error } = await supabase.from("instances").delete().eq("id", instance.id);
      if (error) throw error;
      toast.success("Instância removida!");
      queryClient.invalidateQueries({ queryKey: ["settings-instances"] });
    } catch {
      toast.error("Erro ao remover instância");
    }
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <Card className={isComplete ? "border-border" : "border-warning/40 bg-warning/5"}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-between text-left group" title={isComplete ? "Instância configurada" : "Aguardando credenciais do Sistema de WhatsApp AI. Clique para configurar."}>
              <div className="flex items-center gap-3">
                {isComplete ? (
                  <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
                ) : (
                  <Clock className="h-5 w-5 text-warning shrink-0 animate-pulse" />
                )}
                <div>
                  <CardTitle className="text-sm sm:text-base">{instance.name}</CardTitle>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {instance.provider === "meta_official" ? "API Oficial da Meta" : "QR Code"}
                    </Badge>
                    {instance.openbot_instance_id ? (
                      <Badge variant="outline" className="text-xs font-mono border-success/50 text-success">
                        {instance.openbot_instance_id}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs border-warning/60 text-warning">
                        Configurar credenciais
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
        </CardHeader>

        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <Tabs defaultValue="crm" className="w-full">
              <TabsList className="w-full grid grid-cols-2">
                <TabsTrigger value="crm" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <MessageSquare className="h-4 w-4" />
                  Credenciais CRM
                </TabsTrigger>
                <TabsTrigger value="flows" className="flex items-center gap-1.5 text-xs sm:text-sm">
                  <Workflow className="h-4 w-4" />
                  Conectores e Fluxos
                </TabsTrigger>
              </TabsList>

              <TabsContent value="crm" className="mt-4">
                <CRMCredentialsTab
                  instanceId={instance.id}
                  instanceName={instance.name}
                  provider={instance.provider}
                  webhookUrl={crmWebhookUrl}
                />
              </TabsContent>

              <TabsContent value="flows" className="mt-4">
                <FlowsCredentialsTab
                  instanceId={instance.id}
                  webhookUrl={flowsWebhookUrl}
                />
              </TabsContent>
            </Tabs>

            {/* Delete instance */}
            <div className="pt-4 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Remover Instância
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Remover instância "{instance.name}"?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. Todos os contatos e conversas vinculados a esta instância serão desvinculados.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                      Remover
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
