import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Building2,
  Users,
  CreditCard,
  BarChart3,
  Trash2,
  Edit,
  Save,
  X,
  AlertTriangle,
  Ban,
  RotateCcw,
} from "lucide-react";

interface Organization {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
  blocked_at: string | null;
  block_reason: string | null;
  created_at: string;
  notes?: string | null;
  owner_user_id: string;
}

interface Subscription {
  id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  mp_subscription_id: string | null;
  plan: {
    id: string;
    name: string;
    price: number;
  } | null;
}

interface Member {
  id: string;
  user_id: string;
  role: string;
  created_at: string;
  full_name?: string | null;
  phone?: string | null;
}

interface Payment {
  id: string;
  amount: number;
  status: string;
  paid_at: string | null;
  created_at: string;
  mp_payment_method: string | null;
  mp_payment_id: string | null;
  refunded_amount: number;
}

interface UsageSummary {
  flows_count: number;
  connectors_count: number;
  rules_count: number;
  templates_count: number;
  events_count: number;
  storage_used_mb: number;
}

interface OrganizationDetailsDialogProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
}

export function OrganizationDetailsDialog({
  organization,
  open,
  onOpenChange,
  onUpdate,
}: OrganizationDetailsDialogProps) {
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  
  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  
  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  
  // Refund dialog
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [refundPaymentId, setRefundPaymentId] = useState<string | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundLoading, setRefundLoading] = useState(false);
  
  // Cancel subscription
  const [cancelLoading, setCancelLoading] = useState(false);

  useEffect(() => {
    if (organization && open) {
      fetchDetails();
      setEditName(organization.name);
      setEditNotes(organization.notes || "");
    }
  }, [organization, open]);

  const fetchDetails = async () => {
    if (!organization) return;
    setLoading(true);

    try {
      // Fetch subscription
      const { data: subData } = await supabase
        .from("subscriptions")
        .select("*, plan:subscription_plans(id, name, price)")
        .eq("organization_id", organization.id)
        .maybeSingle();
      
      if (subData) {
        setSubscription({
          ...subData,
          plan: Array.isArray(subData.plan) ? subData.plan[0] : subData.plan
        });
      }

      // Fetch members with full_name from profiles
      const { data: membersData } = await supabase
        .from("organization_members")
        .select("*")
        .eq("organization_id", organization.id);

      const memberUserIds = (membersData || []).map((m) => m.user_id);
      let profilesMap: Record<string, { full_name: string | null; phone: string | null }> = {};
      if (memberUserIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, phone")
          .in("user_id", memberUserIds);
        profilesMap = Object.fromEntries(
          (profilesData || []).map((p) => [p.user_id, { full_name: p.full_name, phone: p.phone }])
        );
      }
      setMembers(
        (membersData || []).map((m) => ({
          ...m,
          full_name: profilesMap[m.user_id]?.full_name ?? null,
          phone: profilesMap[m.user_id]?.phone ?? null,
        }))
      );

      // Fetch payments
      const { data: paymentsData } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: false })
        .limit(10);
      
      setPayments(paymentsData || []);

      // Fetch usage: prefer summary, fall back to live counts
      const { data: usageData } = await supabase
        .from("usage_summary")
        .select("*")
        .eq("organization_id", organization.id)
        .order("period_end", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (usageData) {
        setUsage({
          flows_count: usageData.flows_count || 0,
          connectors_count: usageData.connectors_count || 0,
          rules_count: usageData.rules_count || 0,
          templates_count: usageData.templates_count || 0,
          events_count: usageData.events_count || 0,
          storage_used_mb: Number(usageData.storage_used_mb) || 0,
        });
      } else {
        // Live counts via parallel head queries
        const memberIdsForCount = memberUserIds;
        const inFilter = memberIdsForCount.length > 0 ? memberIdsForCount : ["00000000-0000-0000-0000-000000000000"];
        const [flowsRes, instancesRes, rulesRes, templatesRes, eventsRes, contactsRes] = await Promise.all([
          supabase.from("flows").select("id", { count: "exact", head: true }).in("user_id", inFilter),
          supabase.from("instances").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
          supabase.from("routing_rules").select("id", { count: "exact", head: true }).in("user_id", inFilter),
          supabase.from("message_templates").select("id", { count: "exact", head: true }).in("user_id", inFilter),
          supabase.from("events").select("id", { count: "exact", head: true }).in("user_id", inFilter),
          supabase.from("contacts").select("id", { count: "exact", head: true }).eq("organization_id", organization.id),
        ]);
        setUsage({
          flows_count: flowsRes.count || 0,
          connectors_count: instancesRes.count || 0,
          rules_count: rulesRes.count || 0,
          templates_count: templatesRes.count || 0,
          events_count: eventsRes.count || 0,
          storage_used_mb: contactsRes.count || 0, // reaproveita o slot para Contatos
        });
      }
    } catch (error) {
      console.error("Error fetching details:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!organization) return;

    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          name: editName.trim(),
          notes: editNotes.trim() || null,
        })
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Salvo",
        description: "Organização atualizada com sucesso",
      });
      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar as alterações",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async () => {
    if (!organization || deleteConfirmText !== organization.name) return;

    try {
      // 1. First delete user from auth.users via edge function
      console.log(`[handleDelete] Deleting user ${organization.owner_user_id} from auth.users`);
      
      const { data: deleteUserResponse, error: deleteUserError } = await supabase.functions.invoke(
        "delete-user-account",
        {
          body: { userId: organization.owner_user_id },
        }
      );

      if (deleteUserError) {
        console.error("[handleDelete] Edge function error:", deleteUserError);
        throw new Error(deleteUserError.message || "Erro ao deletar usuário");
      }

      if (deleteUserResponse && !deleteUserResponse.success) {
        console.error("[handleDelete] Delete user failed:", deleteUserResponse.error);
        throw new Error(deleteUserResponse.error || "Erro ao deletar usuário");
      }

      console.log("[handleDelete] User deleted from auth.users, now deleting organization");

      // 2. Then delete the organization (CASCADE will clean up related tables)
      const { error } = await supabase
        .from("organizations")
        .delete()
        .eq("id", organization.id);

      if (error) throw error;

      toast({
        title: "Organização e usuário excluídos",
        description: `${organization.name} e o usuário associado foram removidos permanentemente`,
      });
      setShowDeleteConfirm(false);
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error deleting:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível excluir a organização",
        variant: "destructive",
      });
    }
  };

  const getStatusBadge = () => {
    if (organization?.blocked_at) {
      return <Badge variant="destructive">Bloqueado</Badge>;
    }
    if (!subscription || subscription.status !== "active") {
      return <Badge variant="secondary">Sem assinatura ativa</Badge>;
    }
    return <Badge className="bg-success text-success-foreground">Ativo</Badge>;
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-success text-success-foreground">Aprovado</Badge>;
      case "pending":
        return <Badge variant="secondary">Pendente</Badge>;
      case "rejected":
        return <Badge variant="destructive">Rejeitado</Badge>;
      case "refunded":
        return <Badge className="bg-warning text-warning-foreground">Reembolsado</Badge>;
      case "charged_back":
        return <Badge variant="destructive">Chargeback</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const handleCancelSubscription = async () => {
    if (!subscription) return;
    setCancelLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", {
        body: { action: "cancel-subscription", subscriptionId: subscription.id },
      });
      if (error) throw error;
      toast({ title: "Assinatura cancelada", description: "A assinatura foi cancelada com sucesso" });
      fetchDetails();
      onUpdate();
    } catch (e) {
      console.error("Cancel error:", e);
      toast({ title: "Erro", description: "Não foi possível cancelar a assinatura", variant: "destructive" });
    } finally {
      setCancelLoading(false);
    }
  };

  const handleRefund = async () => {
    if (!refundPaymentId) return;
    setRefundLoading(true);
    try {
      const body: Record<string, unknown> = { action: "refund-payment", paymentId: refundPaymentId };
      if (refundAmount && parseFloat(refundAmount) > 0) {
        body.amount = parseFloat(refundAmount);
      }
      const { data, error } = await supabase.functions.invoke("mercadopago-subscription", { body });
      if (error) throw error;
      toast({ title: "Reembolso processado", description: `Valor de R$ ${data?.amount?.toFixed(2) || "?"} reembolsado` });
      setShowRefundConfirm(false);
      setRefundPaymentId(null);
      setRefundAmount("");
      fetchDetails();
      onUpdate();
    } catch (e) {
      console.error("Refund error:", e);
      toast({ title: "Erro", description: "Não foi possível processar o reembolso", variant: "destructive" });
    } finally {
      setRefundLoading(false);
    }
  };

  if (!organization) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogTitle className="text-xl">{organization.name}</DialogTitle>
                  <p className="text-sm text-muted-foreground">{organization.slug}</p>
                </div>
              </div>
              {getStatusBadge()}
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <Tabs defaultValue="general" className="mt-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="general">Geral</TabsTrigger>
                <TabsTrigger value="subscription">Assinatura</TabsTrigger>
                <TabsTrigger value="usage">Uso</TabsTrigger>
                <TabsTrigger value="members">Membros</TabsTrigger>
                <TabsTrigger value="payments">Pagamentos</TabsTrigger>
              </TabsList>

              {/* General Tab */}
              <TabsContent value="general" className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-lg">Informações</CardTitle>
                    {!isEditing ? (
                      <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </Button>
                    ) : (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>
                          <X className="h-4 w-4 mr-2" />
                          Cancelar
                        </Button>
                        <Button size="sm" onClick={handleSave}>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar
                        </Button>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Nome</Label>
                        {isEditing ? (
                          <Input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                        ) : (
                          <p className="text-sm">{organization.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label>Slug</Label>
                        <p className="text-sm text-muted-foreground">{organization.slug}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Criado em</Label>
                        <p className="text-sm">
                          {format(new Date(organization.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label>Status</Label>
                        <div>{getStatusBadge()}</div>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>Notas internas</Label>
                      {isEditing ? (
                        <Textarea
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Adicione observações sobre este cliente..."
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          {organization.notes || "Nenhuma nota adicionada"}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-destructive/50">
                  <CardHeader>
                    <CardTitle className="text-lg text-destructive flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5" />
                      Zona de Perigo
                    </CardTitle>
                    <CardDescription>
                      Ações irreversíveis que afetam permanentemente esta organização
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button
                      variant="destructive"
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir organização
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Subscription Tab */}
              <TabsContent value="subscription" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Assinatura Atual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {subscription ? (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Plano</Label>
                            <p className="text-lg font-semibold">{subscription.plan?.name || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Status</Label>
                            <p>
                              <Badge
                                variant={subscription.status === "active" ? "default" : "secondary"}
                                className={subscription.status === "active" ? "bg-success text-success-foreground" : ""}
                              >
                                {subscription.status === "active" ? "Ativo" : subscription.status}
                              </Badge>
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-muted-foreground">Início do período</Label>
                            <p className="text-sm">
                              {subscription.current_period_start
                                ? format(new Date(subscription.current_period_start), "dd/MM/yyyy", { locale: ptBR })
                                : "-"}
                            </p>
                          </div>
                          <div>
                            <Label className="text-muted-foreground">Fim do período</Label>
                            <p className="text-sm">
                              {subscription.current_period_end
                                ? format(new Date(subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })
                                : "Sem expiração"}
                            </p>
                          </div>
                        </div>
                        <div>
                          <Label className="text-muted-foreground">Valor</Label>
                          <p className="text-2xl font-bold">
                            R$ {subscription.plan?.price?.toFixed(2) || "0,00"}
                            <span className="text-sm font-normal text-muted-foreground">/mês</span>
                          </p>
                        </div>
                        {subscription.status === "active" && subscription.mp_subscription_id && (
                          <Separator />
                        )}
                        {subscription.status === "active" && subscription.mp_subscription_id && (
                          <Button 
                            variant="destructive" 
                            size="sm"
                            onClick={handleCancelSubscription}
                            disabled={cancelLoading}
                          >
                            <Ban className="h-4 w-4 mr-2" />
                            {cancelLoading ? "Cancelando..." : "Cancelar Assinatura via MP"}
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhuma assinatura ativa</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Usage Tab */}
              <TabsContent value="usage" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Consumo Atual
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {usage ? (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{usage.flows_count}</p>
                          <p className="text-sm text-muted-foreground">Fluxos</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{usage.connectors_count}</p>
                          <p className="text-sm text-muted-foreground">Conectores</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{usage.rules_count}</p>
                          <p className="text-sm text-muted-foreground">Regras</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{usage.templates_count}</p>
                          <p className="text-sm text-muted-foreground">Templates</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{usage.events_count}</p>
                          <p className="text-sm text-muted-foreground">Eventos</p>
                        </div>
                        <div className="p-4 bg-muted rounded-lg text-center">
                          <p className="text-2xl font-bold">{usage.storage_used_mb}</p>
                          <p className="text-sm text-muted-foreground">Contatos</p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhum dado de uso disponível</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Members Tab */}
              <TabsContent value="members" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Membros ({members.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {members.length > 0 ? (
                      <div className="space-y-2">
                        {members.map((member) => (
                          <div
                            key={member.id}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div className="min-w-0">
                              <p className="font-medium truncate">
                                {member.full_name || "Sem nome cadastrado"}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {member.user_id}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                Desde {format(new Date(member.created_at), "dd/MM/yyyy", { locale: ptBR })}
                              </p>
                            </div>
                            <Badge variant="outline">{member.role}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhum membro encontrado</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Payments Tab */}
              <TabsContent value="payments" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Histórico de Pagamentos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {payments.length > 0 ? (
                      <div className="space-y-2">
                        {payments.map((payment) => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between p-3 bg-muted rounded-lg"
                          >
                            <div>
                              <p className="font-medium">
                                R$ {payment.amount.toFixed(2)}
                                {payment.refunded_amount > 0 && (
                                  <span className="text-xs text-warning ml-2">
                                    (reembolsado: R$ {payment.refunded_amount.toFixed(2)})
                                  </span>
                                )}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {format(new Date(payment.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                                {payment.mp_payment_method && ` • ${payment.mp_payment_method}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {getPaymentStatusBadge(payment.status || "pending")}
                              {payment.status === "approved" && payment.mp_payment_id && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setRefundPaymentId(payment.mp_payment_id!);
                                    setRefundAmount("");
                                    setShowRefundConfirm(true);
                                  }}
                                >
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                  Reembolsar
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-muted-foreground">Nenhum pagamento registrado</p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Excluir organização permanentemente?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Esta ação é <strong>irreversível</strong>. Todos os dados da organização serão
                excluídos permanentemente, incluindo:
              </p>
              <ul className="list-disc list-inside text-sm space-y-1">
                <li>Membros e permissões</li>
                <li>Assinaturas e pagamentos</li>
                <li>Dados de uso e histórico</li>
              </ul>
              <div className="pt-4">
                <Label>
                  Digite <strong>{organization.name}</strong> para confirmar:
                </Label>
                <Input
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder={organization.name}
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteConfirmText("")}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteConfirmText !== organization.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir permanentemente
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Refund Confirmation Dialog */}
      <AlertDialog open={showRefundConfirm} onOpenChange={setShowRefundConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <RotateCcw className="h-5 w-5" />
              Processar reembolso?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                O reembolso será processado via MercadoPago. A assinatura será pausada
                e a organização desativada.
              </p>
              <div className="pt-2">
                <Label>Valor do reembolso (deixe vazio para reembolso total):</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  placeholder="Reembolso total"
                  className="mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => { setRefundPaymentId(null); setRefundAmount(""); }}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRefund}
              disabled={refundLoading}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {refundLoading ? "Processando..." : "Confirmar Reembolso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
