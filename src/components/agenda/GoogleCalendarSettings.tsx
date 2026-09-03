import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CalendarIcon,
  CheckCircle2,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Loader2,
  Trash2,
  Unplug,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import { useGoogleCalendarCredentials } from "@/hooks/useGoogleCalendarCredentials";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const REDIRECT_URI = "https://yjynquqwhnorsgzsakep.supabase.co/functions/v1/gdrive-oauth-callback";

interface GoogleCalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleCalendarSettings({ open, onOpenChange }: GoogleCalendarSettingsProps) {
  const { data: org } = useUserOrganization();
  const queryClient = useQueryClient();
  const { isConnected, checkingConnection, connect, connecting, accountEmail } = useGoogleCalendar();
  const { status, loading: loadingCreds, saving, deleting, saveCredentials, deleteCredentials } = useGoogleCalendarCredentials();

  // Credential form state
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [showChangeForm, setShowChangeForm] = useState(false);

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!org?.id) throw new Error("No organization");
      const { error } = await supabase
        .from("mcp_connections")
        .update({ is_active: false })
        .eq("organization_id", org.id)
        .eq("provider", "google_calendar");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-calendar-connection", org?.id] });
      toast.success("Google Calendar desconectado");
    },
    onError: (err: Error) => toast.error(err.message || "Erro ao desconectar"),
  });

  const handleCopyRedirectUri = () => {
    navigator.clipboard.writeText(REDIRECT_URI);
    toast.success("URI copiado!");
  };

  const handleSave = async () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Preencha o Client ID e o Client Secret");
      return;
    }
    await saveCredentials(clientId.trim(), clientSecret.trim());
    setClientId("");
    setClientSecret("");
    setShowChangeForm(false);
  };

  const handleDelete = async () => {
    if (!confirm("Tem certeza que deseja remover as credenciais? O Google Calendar será desconectado.")) return;
    await deleteCredentials();
  };

  const credentialsConfigured = status?.configured === true;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configurações do Google Calendar</SheetTitle>
          <SheetDescription>
            Gerencie as credenciais OAuth e a conexão da sua conta Google Calendar.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* ── Section 1: Credenciais do Google Cloud ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Credenciais do Google Cloud</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Para usar o Google Calendar, você precisa criar um aplicativo OAuth no Google Cloud Console e informar as credenciais abaixo.
            </p>

            {/* Redirect URI */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">URI de Redirecionamento Autorizado</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={REDIRECT_URI}
                  className="text-xs font-mono bg-muted/40 h-8"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={handleCopyRedirectUri}
                  title="Copiar URI"
                >
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Credential status */}
            {loadingCreds ? (
              <div className="flex items-center gap-2 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Verificando credenciais...</span>
              </div>
            ) : credentialsConfigured && !showChangeForm ? (
              <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
                  <span className="text-sm font-medium text-green-600 dark:text-green-400">Credenciais configuradas</span>
                </div>
                <p className="text-xs text-muted-foreground font-mono pl-6">
                  {status?.client_id_masked}
                </p>
                {status?.updated_at && (
                  <p className="text-xs text-muted-foreground pl-6">
                    Atualizado em {new Date(status.updated_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                  </p>
                )}
                <div className="flex gap-2 pl-6 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => { setShowChangeForm(true); setClientId(""); setClientSecret(""); }}
                  >
                    Alterar credenciais
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={handleDelete}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    Remover
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="gcal-client-id" className="text-xs">Client ID</Label>
                  <Input
                    id="gcal-client-id"
                    placeholder="123456789-abc.apps.googleusercontent.com"
                    value={clientId}
                    onChange={(e) => setClientId(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gcal-client-secret" className="text-xs">Client Secret</Label>
                  <div className="relative">
                    <Input
                      id="gcal-client-secret"
                      type={showSecret ? "text" : "password"}
                      placeholder="GOCSPX-..."
                      value={clientSecret}
                      onChange={(e) => setClientSecret(e.target.value)}
                      className="text-sm pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowSecret((v) => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1 gap-2"
                    size="sm"
                    onClick={handleSave}
                    disabled={saving}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    Salvar credenciais
                  </Button>
                  {showChangeForm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowChangeForm(false)}
                    >
                      Cancelar
                    </Button>
                  )}
                </div>
                <a
                  href="https://console.cloud.google.com/apis/credentials"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  <ExternalLink className="h-3 w-3" />
                  Como criar um app no Google Cloud?
                </a>
              </div>
            )}
          </div>

          <Separator />

          {/* ── Section 2: Conexão ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Conexão</h3>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CalendarIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Google Calendar</p>
                  {checkingConnection ? (
                    <p className="text-xs text-muted-foreground">Verificando...</p>
                  ) : isConnected ? (
                    <>
                      <Badge variant="outline" className="gap-1 text-xs mt-1 border-green-500/30 text-green-500">
                        <CheckCircle2 className="h-3 w-3" /> Conectado
                      </Badge>
                      {accountEmail && (
                        <p className="text-xs text-muted-foreground mt-1 break-all">
                          Conectado como: <span className="font-medium text-foreground">{accountEmail}</span>
                        </p>
                      )}
                    </>
                  ) : (
                    <Badge variant="outline" className="text-xs mt-1 text-muted-foreground">
                      Desconectado
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {checkingConnection ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : isConnected ? (
              <Button
                variant="outline"
                className="w-full gap-2 text-destructive hover:text-destructive"
                onClick={() => disconnectMutation.mutate()}
                disabled={disconnectMutation.isPending}
              >
                {disconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Unplug className="h-4 w-4" />
                )}
                Desconectar
              </Button>
            ) : credentialsConfigured ? (
              <Button className="w-full gap-2" onClick={() => connect()} disabled={connecting}>
                <CalendarIcon className="h-4 w-4" />
                {connecting ? "Redirecionando..." : "Conectar Google Calendar"}
              </Button>
            ) : (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="w-full">
                      <Button className="w-full gap-2" disabled>
                        <CalendarIcon className="h-4 w-4" />
                        Conectar Google Calendar
                      </Button>
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    Configure as credenciais acima primeiro
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
