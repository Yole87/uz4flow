import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, TestTube, Eye, EyeOff, CheckCircle, XCircle } from "lucide-react";

export function BillingConfigTab() {
  const queryClient = useQueryClient();
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  const { data: config, isLoading } = useQuery({
    queryKey: ["billing-openbot-config"],
    queryFn: async () => {
      const { data: keySetting } = await (supabase as any)
        .from("saas_settings")
        .select("value")
        .eq("key", "billing_openbot_api_key_encrypted")
        .single();

      return { hasApiKey: !!keySetting?.value };
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!apiKey.trim()) throw new Error("API Key é obrigatória");

      const { error } = await supabase.functions.invoke("manage-integration", {
        body: {
          action: "save-billing-openbot-key",
          api_key: apiKey.trim(),
        },
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["billing-openbot-config"] });
      toast.success("API Key salva com sucesso!");
      setApiKey("");
    },
    onError: (e: any) => toast.error(`Erro: ${e.message}`),
  });

  const handleTest = async () => {
    if (!testPhone.trim()) {
      toast.error("Informe um número de teste");
      return;
    }

    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("billing-notify", {
        body: {
          event_type: "payment_approved",
          organization_id: "00000000-0000-0000-0000-000000000000",
          metadata: {
            nome: "Teste",
            valor: 99.90,
            plano: "Plano Teste",
            vencimento: new Date().toLocaleDateString("pt-BR"),
          },
          test_phone: testPhone.replace(/\D/g, ""),
        },
      });

      if (error) throw error;
      toast.success("Mensagem de teste enviada!");
    } catch (e: any) {
      toast.error(`Erro no teste: ${e.message}`);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Configuração do WhatsApp AI
            {config?.hasApiKey ? (
              <CheckCircle className="w-5 h-5 text-primary" />
            ) : (
              <XCircle className="w-5 h-5 text-destructive" />
            )}
          </CardTitle>
          <CardDescription>
            Configure a API Key do WhatsApp AI dedicada para envio de notificações de cobrança.
            Esta chave é separada das instâncias dos clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>API Key do WhatsApp AI</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder={config?.hasApiKey ? "••••••••••••••••" : "Cole sua API Key aqui"}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                  onClick={() => setShowKey(!showKey)}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !apiKey.trim()}>
                <Save className="w-4 h-4 mr-1" /> Salvar
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {config?.hasApiKey ? "✅ API Key configurada" : "⚠️ API Key não configurada — notificações não serão enviadas"}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Teste de Envio</CardTitle>
          <CardDescription>
            Envie uma mensagem de teste para verificar se a integração está funcionando.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Número de Teste (com DDI)</Label>
            <div className="flex gap-2">
              <Input
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                placeholder="5511999999999"
              />
              <Button onClick={handleTest} disabled={testing || !testPhone.trim()} variant="outline">
                <TestTube className="w-4 h-4 mr-1" /> Testar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
