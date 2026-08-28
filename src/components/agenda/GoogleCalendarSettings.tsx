import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarIcon, CheckCircle2, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface GoogleCalendarSettingsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GoogleCalendarSettings({ open, onOpenChange }: GoogleCalendarSettingsProps) {
  const { data: org } = useUserOrganization();
  const queryClient = useQueryClient();
  const { isConnected, checkingConnection, connect, connecting } = useGoogleCalendar();

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Configurações do Google Calendar</SheetTitle>
          <SheetDescription>
            Gerencie a conexão da sua conta Google Calendar usada na Agenda.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
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
                  <Badge variant="outline" className="gap-1 text-xs mt-1 border-green-500/30 text-green-500">
                    <CheckCircle2 className="h-3 w-3" /> Conectado
                  </Badge>
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
          ) : (
            <Button className="w-full gap-2" onClick={() => connect()} disabled={connecting}>
              <CalendarIcon className="h-4 w-4" />
              {connecting ? "Redirecionando..." : "Conectar Google Calendar"}
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
