import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Send, Save, Info, UserPlus, Clock, ArrowUp, RefreshCw, CreditCard, XCircle, Ban, Handshake, Sparkles, Wallet, Link as LinkIcon, Copy, Eye, EyeOff, Loader2, Bell } from "lucide-react";
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
import { ACTIONS } from "@/lib/copy";

const EVENT_LABELS: Record<string, string> = {
  signup_free: "Novo cadastro grátis",
  free_plan_expiring: "Plano grátis vencendo",
  upgrade_free_to_paid: "Upgrade grátis → pago",
  plan_change: "Mudança de plano",
  payment_received: "Pagamento recebido",
  cancel_refund: "Cancelamento por reembolso",
  cancel_unpaid: "Cancelamento por inadimplência",
  affiliate_signup_request: "Pedido de afiliação",
  affiliate_new_referral: "Novo indicado por afiliado",
  affiliate_payout_request: "Pedido de saque de afiliado",
  delivery_callback: "Confirmação de entrega WhatsApp",
};

const EVENT_ICONS: Record<string, any> = {
  signup_free: UserPlus,
  free_plan_expiring: Clock,
  upgrade_free_to_paid: ArrowUp,
  plan_change: RefreshCw,
  payment_received: CreditCard,
  cancel_refund: XCircle,
  cancel_unpaid: Ban,
  affiliate_signup_request: Handshake,
  affiliate_new_referral: Sparkles,
  affiliate_payout_request: Wallet,
  delivery_callback: Bell,
};

function EventsTab() {
  const qc = useQueryClient();
  const { data: rules = [] } = useQuery({
    queryKey: ["admin-notif-rules"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_notification_rules").select("*").order("event_type");
      return (data || []) as any[];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: any) => {
      const { error } = await supabase.from("admin_notification_rules").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra atualizada");
      qc.invalidateQueries({ queryKey: ["admin-notif-rules"] });
    },
    onError: () => toast.error("Erro ao atualizar regra. Tente novamente."),
  });

  return (
    <Card className="quantum-glass">
      <CardHeader><CardTitle>Eventos do sistema</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
            <div>
              <div className="font-medium">{EVENT_LABELS[r.event_type] || r.event_type}</div>
              <div className="text-xs text-muted-foreground font-mono">{r.event_type}</div>
            </div>
            <div className="flex items-center gap-3">
              <Badge variant={r.enabled ? "default" : "outline"}>{r.enabled ? "Ativo" : "Desativado"}</Badge>
              <Switch checked={r.enabled} onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })} />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TemplatesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<any>(null);

  const { data: templates = [] } = useQuery({
    queryKey: ["admin-notif-templates"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_notification_templates").select("*").order("event_type");
      return (data || []) as any[];
    },
  });

  const save = useMutation({
    mutationFn: async (t: any) => {
      const { error } = await supabase.from("admin_notification_templates").update({
        name: t.name, body: t.body,
      }).eq("id", t.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template salvo");
      qc.invalidateQueries({ queryKey: ["admin-notif-templates"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const insertVar = (v: string) => {
    if (!editing) return;
    const ta = document.getElementById("tpl-body") as HTMLTextAreaElement;
    const start = ta?.selectionStart ?? editing.body.length;
    const end = ta?.selectionEnd ?? editing.body.length;
    const next = editing.body.slice(0, start) + `{${v}}` + editing.body.slice(end);
    setEditing({ ...editing, body: next });
  };

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card className="quantum-glass">
        <CardHeader><CardTitle>Templates</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {templates.map((t) => {
            const Icon = EVENT_ICONS[t.event_type] || Send;
            const selected = editing?.id === t.id;
            return (
              <button key={t.id} onClick={() => setEditing(t)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border-l-2 border-y border-r transition-all min-w-0 ${
                  selected
                    ? "border-l-primary border-y-primary/40 border-r-primary/40 bg-primary/10"
                    : "border-l-transparent border-y-border border-r-border hover:bg-accent/40 hover:border-l-primary/40"
                }`}>
                <div className="flex items-center gap-2 mb-1 min-w-0">
                  <Icon className={`w-4 h-4 shrink-0 ${selected ? "text-primary" : "text-muted-foreground"}`} />
                  <div className="font-semibold text-sm text-foreground truncate min-w-0">{EVENT_LABELS[t.event_type]}</div>
                </div>
                <div className="text-xs text-foreground/85 line-clamp-2 font-mono leading-snug">{t.body}</div>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card className="quantum-glass">
        <CardHeader><CardTitle>{editing ? "Editar template" : "Selecione um template"}</CardTitle></CardHeader>
        <CardContent>
          {!editing ? (
            <p className="text-sm text-muted-foreground">Clique num template à esquerda.</p>
          ) : (
            <div className="space-y-3">
              <div>
                <Label>Nome</Label>
                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
              </div>
              <div>
                <Label>Mensagem</Label>
                <Textarea id="tpl-body" rows={8} value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} className="font-mono text-sm" />
              </div>
              {editing.variables?.length > 0 && (
                <div>
                  <Label className="text-xs">Variáveis disponíveis (clique para inserir)</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {editing.variables.map((v: string) => (
                      <Badge key={v} variant="outline" className="cursor-pointer hover:bg-primary/20" onClick={() => insertVar(v)}>
                        {`{${v}}`}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <Button onClick={() => save.mutate(editing)} disabled={save.isPending} className="gradient-primary">
                <Save className="w-4 h-4 mr-2" />Salvar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function RecipientsTab() {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  const { data: recipients = [] } = useQuery({
    queryKey: ["admin-notif-recipients"],
    queryFn: async () => {
      const { data } = await supabase.from("admin_notification_recipients").select("*").order("created_at");
      return (data || []) as any[];
    },
  });

  const add = useMutation({
    mutationFn: async () => {
      if (!name || !phone) throw new Error("Preencha nome e telefone");
      const { error } = await supabase.from("admin_notification_recipients").insert({ name, phone, enabled: true });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Destinatário adicionado");
      setName(""); setPhone("");
      qc.invalidateQueries({ queryKey: ["admin-notif-recipients"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notification_recipients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Destinatário removido");
      qc.invalidateQueries({ queryKey: ["admin-notif-recipients"] });
    },
    onError: () => toast.error("Erro ao remover destinatário."),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, enabled }: any) => {
      const { error } = await supabase.from("admin_notification_recipients").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Destinatário atualizado");
      qc.invalidateQueries({ queryKey: ["admin-notif-recipients"] });
    },
    onError: () => toast.error("Erro ao atualizar destinatário."),
  });

  return (
    <Card className="quantum-glass">
      <CardHeader><CardTitle>Destinatários (máx. 3)</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {recipients.length < 3 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
            <Input placeholder="+55 11 91234-5678" value={phone} onChange={(e) => setPhone(e.target.value)} />
            <Button onClick={() => add.mutate()} disabled={add.isPending} className="gradient-primary">Adicionar</Button>
          </div>
        )}
        <Table>
          <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Telefone</TableHead><TableHead>Ativo</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {recipients.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{r.name}</TableCell>
                <TableCell className="font-mono text-xs">{r.phone}</TableCell>
                <TableCell><Switch checked={r.enabled} onCheckedChange={(v) => toggle.mutate({ id: r.id, enabled: v })} /></TableCell>
                <TableCell>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="icon" variant="ghost" aria-label="Remover destinatário">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remover destinatário</AlertDialogTitle>
                        <AlertDialogDescription>
                          {r.name} não receberá mais notificações administrativas. Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{ACTIONS.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => remove.mutate(r.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          Remover
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function ConnectionTab() {
  const qc = useQueryClient();
  const { data: config } = useQuery({
    queryKey: ["admin-notif-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("admin_notification_config")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
  });

  const DEFAULT_OPENBOT_URL = "https://api.digitalbotia.com.br/sendWebhook";
  const [baseUrl, setBaseUrl] = useState(DEFAULT_OPENBOT_URL);
  const [token, setToken] = useState("");
  const [showToken, setShowToken] = useState(false);
  const [tokenLoading, setTokenLoading] = useState(false);

  useEffect(() => {
    if (!config) return;
    setBaseUrl(config.openbot_base_url || DEFAULT_OPENBOT_URL);

    if (!config.openbot_token_encrypted) {
      setToken("");
      return;
    }

    // Decrypt the stored token so the admin always sees the current value.
    setTokenLoading(true);
    supabase.functions
      .invoke("admin-notify", { body: { action: "reveal_key" } })
      .then(({ data, error }) => {
        if (error || !data?.token) {
          setToken("");
          return;
        }
        setToken(data.token);
      })
      .finally(() => setTokenLoading(false));
  }, [config]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL || "https://deuhtstjhuvyugilnifg.supabase.co"}/functions/v1/admin-notify-webhook`;

  const encryptViaFn = async (value: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke("admin-notify", {
      body: { action: "store_key", key: value },
    });
    if (error || !data?.encrypted) throw new Error("Não foi possível salvar a credencial. Configure ENCRYPTION_KEY.");
    return data.encrypted;
  };

  const save = useMutation({
    mutationFn: async () => {
      if (!baseUrl.trim()) throw new Error("URL da API é obrigatória");
      if (!token.trim()) throw new Error("Token é obrigatório");
      const patch: any = {
        openbot_base_url: baseUrl.trim(),
        is_configured: true,
      };
      patch.openbot_token_encrypted = await encryptViaFn(token.trim());
      if (config?.id) {
        const { data, error } = await supabase
          .from("admin_notification_config")
          .update(patch)
          .eq("id", config.id)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("admin_notification_config")
          .insert(patch)
          .select("*")
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: async (savedConfig) => {
      qc.setQueryData(["admin-notif-config"], savedConfig);
      setBaseUrl(savedConfig?.openbot_base_url || DEFAULT_OPENBOT_URL);
      await qc.invalidateQueries({ queryKey: ["admin-notif-config"] });
      toast.success("Configuração salva com sucesso.");
    },
    onError: (e: any) => toast.error(e?.message || "Não foi possível salvar a configuração."),
  });

  const interpretTestResult = (d: any): { kind: "success" | "warning" | "error"; msg: string } => {
    if (!d) return { kind: "error", msg: "Resposta vazia do servidor." };

    if (d.skipped) {
      const reasonMap: Record<string, { kind: "warning" | "error"; msg: string }> = {
        openbot_not_configured: { kind: "warning", msg: "Configure a URL e o Token antes de testar." },
        rule_disabled: { kind: "warning", msg: "Este evento está desativado em Eventos." },
        no_recipients: { kind: "warning", msg: "Nenhum destinatário ativo. Cadastre em Destinatários." },
        no_template: { kind: "warning", msg: "Template do evento não foi encontrado." },
        decrypt_failed: { kind: "error", msg: "Token armazenado é inválido. Reinsira o token e salve novamente." },
      };
      return reasonMap[d.reason] ?? { kind: "warning", msg: `Envio ignorado: ${d.reason || "motivo desconhecido"}.` };
    }

    if (d.ok && Array.isArray(d.results) && d.results.length > 0) {
      const failed = d.results.filter((r: any) => r?.success === false);
      if (failed.length === d.results.length) {
        const errMsg = failed[0]?.response?.error || failed[0]?.error || "O Sistema de WhatsApp AI rejeitou o envio.";
        return { kind: "error", msg: `O Sistema de WhatsApp AI rejeitou o envio: ${String(errMsg).slice(0, 140)}` };
      }
      const ok = d.results.length - failed.length;
      if (failed.length > 0) {
        return { kind: "warning", msg: `Enviado para ${ok} de ${d.results.length} destinatário(s).` };
      }
      return { kind: "success", msg: `Teste enviado para ${ok} destinatário(s).` };
    }

    return { kind: "success", msg: "Teste processado com sucesso." };
  };

  const test = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-notify", {
        body: { event_type: "signup_free", test: true, variables: { user_name: "Teste", user_email: "teste@ex.com", date: new Date().toLocaleString("pt-BR") } },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      const r = interpretTestResult(d);
      if (r.kind === "success") toast.success(r.msg);
      else if (r.kind === "warning") toast.warning(r.msg);
      else toast.error(r.msg);
    },
    onError: (e: any) => toast.error(e?.message || "Falha ao enviar teste."),
  });

  const copyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    toast.success("URL do webhook copiada!");
  };

  const canSave = baseUrl.trim().length > 0 && token.trim().length > 0 && !tokenLoading;

  return (
    <Card className="quantum-glass max-w-2xl">
      <CardHeader>
        <CardTitle>Conexão com o Sistema de WhatsApp AI</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Configure a URL da API e o Token de autenticação. O envio segue o protocolo oficial do Sistema de WhatsApp AI.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>URL da API</Label>
          <Input placeholder={DEFAULT_OPENBOT_URL} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
          <p className="text-xs text-muted-foreground mt-1">
            Endpoint padrão do Sistema de WhatsApp AI. Já vem preenchido — altere apenas se usar uma instância dedicada.
          </p>
        </div>

        <div>
          <Label>Token (apiKey)</Label>
          <div className="relative">
            <Input
              type={showToken ? "text" : "password"}
              placeholder={tokenLoading ? "Carregando token salvo..." : "Cole seu token aqui"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              disabled={tokenLoading}
              className="pr-10 font-mono"
              autoComplete="off"
              spellCheck={false}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 [clip-path:none]"
              onClick={() => setShowToken((v) => !v)}
              disabled={tokenLoading}
              aria-label={showToken ? "Ocultar token" : "Mostrar token"}
            >
              {tokenLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : showToken ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Enviado no corpo da requisição como <code className="px-1 py-0.5 rounded bg-muted">apiKey</code> junto com <code className="px-1 py-0.5 rounded bg-muted">phone</code> e <code className="px-1 py-0.5 rounded bg-muted">message</code>.
          </p>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
          <Label className="flex items-center gap-1.5 text-primary font-semibold">
            <LinkIcon className="w-4 h-4" />
            Webhook de retorno (cole no painel do Sistema de WhatsApp AI)
          </Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="bg-background/50 font-mono text-xs text-foreground" />
            <Button variant="outline" size="sm" onClick={copyWebhook} className="shrink-0">
              <Copy className="w-3.5 h-3.5 mr-1" /> Copiar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">O Sistema de WhatsApp AI enviará confirmações de entrega/leitura para este endpoint.</p>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={() => save.mutate()} disabled={save.isPending || !canSave} className="gradient-primary"><Save className="w-4 h-4 mr-2" />Salvar</Button>
          <Button onClick={() => test.mutate()} disabled={test.isPending} variant="outline"><Send className="w-4 h-4 mr-2" />Enviar teste</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function LogsTab() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");

  const { data: logs = [] } = useQuery({
    queryKey: ["admin-notif-logs"],
    staleTime: 30000,
    queryFn: async () => {
      const { data } = await supabase.from("admin_notification_logs").select("*").order("created_at", { ascending: false }).limit(100);
      return (data || []) as any[];
    },
  });

  const markAll = async () => {
    const previous = qc.getQueryData(["admin-notif-logs"]);
    // Otimista: marca todas como lidas instantaneamente
    qc.setQueryData(["admin-notif-logs"], (old: any[] | undefined) =>
      (old || []).map((l) => (l.read_at ? l : { ...l, read_at: new Date().toISOString() }))
    );
    const { error } = await supabase
      .from("admin_notification_logs")
      .update({ read_at: new Date().toISOString() })
      .is("read_at", null);
    if (error) {
      qc.setQueryData(["admin-notif-logs"], previous);
      toast.error("Não foi possível marcar como lidas. Tente novamente.");
      return;
    }
    toast.success("Todas marcadas como lidas.");
    qc.invalidateQueries({ queryKey: ["admin-notif-logs"] });
  };

  const markOne = async (id: string) => {
    const previous = qc.getQueryData(["admin-notif-logs"]);
    qc.setQueryData(["admin-notif-logs"], (old: any[] | undefined) =>
      (old || []).map((l) => (l.id === id ? { ...l, read_at: new Date().toISOString() } : l))
    );
    const { error } = await supabase
      .from("admin_notification_logs")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id);
    if (error) {
      qc.setQueryData(["admin-notif-logs"], previous);
      toast.error("Não foi possível marcar como lida. Tente novamente.");
      return;
    }
    qc.invalidateQueries({ queryKey: ["admin-notif-logs"] });
  };

  const filtered = logs.filter((l) =>
    filter === "all" ? true : filter === "unread" ? !l.read_at : !!l.read_at,
  );
  const unreadCount = logs.filter((l) => !l.read_at).length;

  return (
    <Card className="quantum-glass">
      <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle>Logs de envio (últimos 100)</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "unread", "read"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs transition-colors ${
                  filter === f ? "bg-primary text-primary-foreground" : "hover:bg-accent/40"
                }`}
              >
                {f === "all" ? "Todas" : f === "unread" ? `Não lidas (${unreadCount})` : "Lidas"}
              </button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={markAll} disabled={unreadCount === 0}>
            Marcar todas como lidas
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Evento</TableHead>
              <TableHead>Destinatário</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Lida</TableHead>
              <TableHead>Erro</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((l) => (
              <TableRow key={l.id} className={l.read_at ? "opacity-60" : ""}>
                <TableCell className="text-xs">{new Date(l.created_at).toLocaleString("pt-BR")}</TableCell>
                <TableCell className="text-xs">{EVENT_LABELS[l.event_type] || l.event_type}</TableCell>
                <TableCell className="text-xs">{l.recipient_name} <span className="font-mono text-muted-foreground">{l.recipient_phone}</span></TableCell>
                <TableCell><Badge variant={l.status === "sent" ? "default" : "destructive"}>{l.status}</Badge></TableCell>
                <TableCell>
                  {l.read_at ? (
                    <Badge variant="outline" className="text-xs">Lida</Badge>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => markOne(l.id)} className="h-auto py-1 px-2 text-xs">
                      Marcar
                    </Button>
                  )}
                </TableCell>
                <TableCell className="text-xs text-destructive max-w-xs truncate">{l.error_message}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export default function AdminNotifications() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Notificações</h1>
          <p className="text-muted-foreground mt-1">Central de mensagens automáticas via Sistema de WhatsApp AI</p>
        </div>
        <Tabs defaultValue="events" className="space-y-4">
          <TabsList>
            <TabsTrigger value="events">Eventos</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="recipients">Destinatários</TabsTrigger>
            <TabsTrigger value="connection">Conexão</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>
          <TabsContent value="events"><EventsTab /></TabsContent>
          <TabsContent value="templates"><TemplatesTab /></TabsContent>
          <TabsContent value="recipients"><RecipientsTab /></TabsContent>
          <TabsContent value="connection"><ConnectionTab /></TabsContent>
          <TabsContent value="logs"><LogsTab /></TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
