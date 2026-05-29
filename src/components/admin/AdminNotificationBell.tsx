import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Bell, AlertTriangle, Check, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface NotifLog {
  id: string;
  event_type: string;
  recipient_name: string | null;
  recipient_phone: string;
  status: string;
  error_message: string | null;
  created_at: string;
  read_at: string | null;
}

const EVENT_LABELS: Record<string, string> = {
  signup_free: "Novo cadastro grátis",
  free_plan_expiring: "Plano grátis vencendo",
  upgrade_free_to_paid: "Upgrade para pago",
  plan_change: "Mudança de plano",
  payment_received: "Pagamento recebido",
  cancel_refund: "Reembolso",
  cancel_unpaid: "Cancelamento por inadimplência",
  affiliate_signup_request: "Pedido de afiliação",
  affiliate_new_referral: "Novo indicado",
  affiliate_payout_request: "Pedido de saque",
  delivery_callback: "Confirmação de entrega",
};

const SHOW_READ_KEY = "admin_notif_show_read";
const AUTO_CLEAR_KEY = "admin_notif_auto_clear";

export function AdminNotificationBell() {
  const navigate = useNavigate();
  const [logs, setLogs] = useState<NotifLog[]>([]);
  const [open, setOpen] = useState(false);
  const [showRead, setShowRead] = useState<boolean>(() => localStorage.getItem(SHOW_READ_KEY) === "1");
  const [autoClear, setAutoClear] = useState<boolean>(() => localStorage.getItem(AUTO_CLEAR_KEY) === "1");
  const autoClearTimer = useRef<number | null>(null);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from("admin_notification_logs")
      .select("id, event_type, recipient_name, recipient_phone, status, error_message, created_at, read_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (data) setLogs(data as NotifLog[]);
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 30_000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  useEffect(() => {
    localStorage.setItem(SHOW_READ_KEY, showRead ? "1" : "0");
  }, [showRead]);
  useEffect(() => {
    localStorage.setItem(AUTO_CLEAR_KEY, autoClear ? "1" : "0");
  }, [autoClear]);

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    const previous = logs;
    setLogs((prev) => prev.map((l) => (l.read_at ? l : { ...l, read_at: now })));
    const { error } = await supabase
      .from("admin_notification_logs")
      .update({ read_at: now })
      .is("read_at", null);
    if (error) {
      setLogs(previous);
      toast.error("Não foi possível marcar todas como lidas. Tente novamente.");
    }
  }, [logs]);

  const markOneRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    const previous = logs;
    setLogs((prev) => prev.map((l) => (l.id === id ? { ...l, read_at: now } : l)));
    const { error } = await supabase
      .from("admin_notification_logs")
      .update({ read_at: now })
      .eq("id", id);
    if (error) {
      setLogs(previous);
      toast.error("Não foi possível marcar como lida. Tente novamente.");
    }
  }, [logs]);

  // Auto-clear ao abrir (após 2s) — só dispara uma vez por abertura
  const autoClearedForOpen = useRef(false);
  useEffect(() => {
    if (!open) {
      autoClearedForOpen.current = false;
      return;
    }
    if (open && autoClear && !autoClearedForOpen.current) {
      autoClearedForOpen.current = true;
      autoClearTimer.current = window.setTimeout(() => {
        markAllRead();
      }, 2000);
    }
    return () => {
      if (autoClearTimer.current) {
        window.clearTimeout(autoClearTimer.current);
        autoClearTimer.current = null;
      }
    };
  }, [open, autoClear, markAllRead]);

  const visibleLogs = showRead ? logs : logs.filter((l) => !l.read_at);
  const failedUnreadCount = logs.filter((l) => l.status === "failed" && !l.read_at).length;

  const handleSeeAll = () => {
    setOpen(false);
    navigate("/admin/notifications");
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative overflow-visible [clip-path:none] rounded-lg text-sidebar-foreground/70 hover:text-sidebar-foreground"
        >
          <Bell className="w-5 h-5" />
          {failedUnreadCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 z-10 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-sidebar bg-destructive px-1.5 text-xs font-bold leading-none text-destructive-foreground shadow-sm">
              {failedUnreadCount > 99 ? "99+" : failedUnreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="border-b border-border">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold">Notificações</span>
            <Button variant="ghost" size="sm" onClick={handleSeeAll} className="h-auto py-1 px-2 text-xs">
              Ver todas
            </Button>
          </div>
          <div className="px-4 pb-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Switch
                  id="bell-show-read"
                  checked={showRead}
                  onCheckedChange={setShowRead}
                />
                <Label htmlFor="bell-show-read" className="text-xs cursor-pointer">
                  Mostrar lidas
                </Label>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={markAllRead}
                disabled={!logs.some((l) => !l.read_at)}
                className="h-auto py-1 px-2 text-xs gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Marcar todas
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="bell-auto-clear"
                checked={autoClear}
                onCheckedChange={setAutoClear}
              />
              <Label htmlFor="bell-auto-clear" className="text-xs cursor-pointer text-muted-foreground">
                Ocultar automaticamente ao acessar
              </Label>
            </div>
          </div>
        </div>
        <ScrollArea className="max-h-80">
          {visibleLogs.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground text-center">
              {showRead ? "Nenhuma notificação ainda" : "Nenhuma notificação não lida"}
            </p>
          ) : (
            visibleLogs.map((l) => (
              <div
                key={l.id}
                className={cn(
                  "group flex gap-3 px-4 py-3 border-b border-border/50 last:border-0 transition-opacity",
                  l.status === "failed" && !l.read_at && "bg-destructive/5",
                  l.read_at && "opacity-60"
                )}
              >
                {l.status === "failed" ? (
                  <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-destructive" />
                ) : (
                  <Bell className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <div className="text-xs font-semibold truncate flex-1">
                      {EVENT_LABELS[l.event_type] || l.event_type}
                    </div>
                    {l.read_at && <Check className="w-3 h-3 text-muted-foreground shrink-0" />}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                    {l.recipient_name || l.recipient_phone}
                  </p>
                  {l.error_message && (
                    <p className="text-xs text-destructive line-clamp-1 mt-0.5">{l.error_message}</p>
                  )}
                  <span className="text-xs text-muted-foreground/60 mt-1 block">
                    {formatDistanceToNow(new Date(l.created_at), { addSuffix: true, locale: ptBR })}
                  </span>
                </div>
                {!l.read_at && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => markOneRead(l.id)}
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    aria-label="Marcar como lida"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                )}
              </div>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
