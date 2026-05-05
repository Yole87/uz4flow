import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Search, 
  MoreVertical, 
  Eye, 
  Ban, 
  CheckCircle,
  Building2,
  Gift,
  Trash2,
  // Edit removed - unused
  Download,
  RefreshCw,
  LogIn,
  AlertTriangle,
  KeyRound,
  UserSearch,
  AlertCircle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { OrganizationDetailsDialog } from "@/components/admin/OrganizationDetailsDialog";
import { ManualSubscriptionDialog } from "@/components/admin/ManualSubscriptionDialog";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useImpersonation } from "@/hooks/useImpersonation";
import { AdminResetPasswordDialog } from "@/components/admin/AdminResetPasswordDialog";

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
  owner_email?: string;
  subscription?: {
    status: string;
    current_period_end?: string | null;
    plan?: {
      name: string;
      price?: number;
    };
  };
  _isLead?: boolean;
  _leadEmail?: string;
  _leadUserId?: string;
}

type StatusFilter = "all" | "active" | "blocked" | "no_subscription" | "lead" | "paused" | "refunded" | "charged_back" | "cancelled";

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

export default function AdminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  const initialFilter = (searchParams.get("filter") as StatusFilter) || "all";
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialFilter);
  const [creatingOrg, setCreatingOrg] = useState(false);
  const [leadsFailed, setLeadsFailed] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { startImpersonation } = useImpersonation();

  // Email search dialog
  const [emailSearchOpen, setEmailSearchOpen] = useState(false);
  const [emailSearchQuery, setEmailSearchQuery] = useState("");
  const [emailSearchLoading, setEmailSearchLoading] = useState(false);
  const [emailSearchResult, setEmailSearchResult] = useState<any>(null);

  // Dialogs
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [manualSubOpen, setManualSubOpen] = useState(false);
  const [resetPwOpen, setResetPwOpen] = useState(false);
  const [selectedOrg, setSelectedOrg] = useState<Organization | null>(null);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel('organizations_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'organizations' }, () => fetchAll())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const orgsResult = await supabase
        .from("organizations")
        .select(`*, subscription:subscriptions(status, current_period_end, plan:subscription_plans(name, price))`)
        .order("created_at", { ascending: false });

      if (orgsResult.error) throw orgsResult.error;

      // Fetch leads + allUsersMap separately so org list always loads
      let allUsersMap: Record<string, string> = {};
      let leadsRaw: any[] = [];
      let leadsError = false;
      try {
        const leadsResult = await supabase.functions.invoke("admin-list-leads");
        if (leadsResult.error) throw leadsResult.error;
        allUsersMap = leadsResult.data?.allUsersMap || {};
        leadsRaw = leadsResult.data?.leads || [];
      } catch (e) {
        console.warn("Failed to fetch leads/email map:", e);
        leadsError = true;
      }
      setLeadsFailed(leadsError);

      const formattedOrgs: Organization[] = (orgsResult.data || []).map(org => ({
        ...org,
        subscription: Array.isArray(org.subscription) ? org.subscription[0] : org.subscription,
        owner_email: allUsersMap[org.owner_user_id] || undefined,
      }));

      const leads: Organization[] = leadsRaw.map((lead: any) => ({
        id: `lead_${lead.id}`,
        name: lead.full_name || lead.email,
        slug: "—",
        is_active: false,
        blocked_at: null,
        block_reason: null,
        created_at: lead.created_at,
        owner_user_id: lead.id,
        owner_email: lead.email,
        _isLead: true,
        _leadEmail: lead.email,
        _leadUserId: lead.id,
      }));

      setOrganizations([...formattedOrgs, ...leads]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({ title: "Erro", description: "Não foi possível carregar os dados", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleBlock = async (org: Organization) => {
    try {
      const isBlocking = !org.blocked_at;
      const { error } = await supabase
        .from("organizations")
        .update({
          blocked_at: isBlocking ? new Date().toISOString() : null,
          block_reason: isBlocking ? "Bloqueado pelo administrador" : null,
          is_active: !isBlocking,
        })
        .eq("id", org.id);

      if (error) throw error;
      toast({
        title: isBlocking ? "Organização bloqueada" : "Organização desbloqueada",
        description: `${org.name} foi ${isBlocking ? "bloqueada" : "desbloqueada"} com sucesso`,
      });
      fetchAll();
    } catch (error) {
      console.error("Error toggling block:", error);
      toast({ title: "Erro", description: "Não foi possível atualizar a organização", variant: "destructive" });
    }
  };

  const handleLeadGrantSubscription = async (lead: Organization) => {
    setCreatingOrg(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-leads", {
        body: {
          action: "create-org-for-lead",
          user_id: lead._leadUserId,
          email: lead._leadEmail,
        },
      });

      if (error) throw error;

      const newOrg: Organization = {
        id: data.organization.id,
        name: data.organization.name,
        slug: "",
        is_active: true,
        blocked_at: null,
        block_reason: null,
        created_at: new Date().toISOString(),
        owner_user_id: lead._leadUserId!,
      };

      setSelectedOrg(newOrg);
      setManualSubOpen(true);

      toast({ title: "Organização criada", description: "Agora selecione o plano para liberar a assinatura." });
      fetchAll();
    } catch (error: any) {
      console.error("Error creating org for lead:", error);
      toast({ title: "Erro", description: error.message || "Não foi possível criar a organização", variant: "destructive" });
    } finally {
      setCreatingOrg(false);
    }
  };

  const handleEmailSearch = async () => {
    if (!emailSearchQuery.trim()) return;
    setEmailSearchLoading(true);
    setEmailSearchResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-leads", {
        body: { action: "search-user-by-email", email: emailSearchQuery.trim() },
      });
      if (error) throw error;
      setEmailSearchResult(data);
    } catch (e: any) {
      const isNetworkError = !e?.status && !e?.data;
      toast({ 
        title: "Erro na busca", 
        description: isNetworkError 
          ? "Não foi possível conectar ao servidor. Verifique sua conexão ou tente pelo domínio correto." 
          : (e.message || "Falha ao buscar usuário"), 
        variant: "destructive" 
      });
    } finally {
      setEmailSearchLoading(false);
    }
  };

  const handleCreateOrgFromSearch = async () => {
    if (!emailSearchResult?.user) return;
    setCreatingOrg(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-list-leads", {
        body: {
          action: "create-org-for-lead",
          user_id: emailSearchResult.user.id,
          email: emailSearchResult.user.email,
        },
      });
      if (error) throw error;

      const newOrg: Organization = {
        id: data.organization.id,
        name: data.organization.name,
        slug: "",
        is_active: true,
        blocked_at: null,
        block_reason: null,
        created_at: new Date().toISOString(),
        owner_user_id: emailSearchResult.user.id,
      };

      setEmailSearchOpen(false);
      setEmailSearchResult(null);
      setEmailSearchQuery("");
      setSelectedOrg(newOrg);
      setManualSubOpen(true);
      toast({ title: "Organização criada", description: "Agora selecione o plano." });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao criar organização", variant: "destructive" });
    } finally {
      setCreatingOrg(false);
    }
  };

  const exportCSV = () => {
    const headers = ["Nome", "E-mail", "Slug", "Plano", "Status", "Valor", "Período", "Criado em"];
    const rows = filteredOrganizations.map((org) => [
      org.name,
      org.owner_email || org._leadEmail || "—",
      org.slug,
      org._isLead ? "Sem plano" : (org.subscription?.plan?.name || "Sem plano"),
      getStatusLabel(org),
      org.subscription?.plan?.price ? formatCurrency(org.subscription.plan.price) : "—",
      org.subscription?.current_period_end ? format(new Date(org.subscription.current_period_end), "dd/MM/yyyy") : "—",
      format(new Date(org.created_at), "dd/MM/yyyy"),
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `clientes-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    toast({ title: "Exportado", description: "Lista exportada com sucesso" });
  };

  const getUnifiedStatus = (org: Organization): StatusFilter => {
    if (org._isLead) return "lead";
    if (org.blocked_at) return "blocked";
    if (!org.subscription) return "no_subscription";
    const s = org.subscription.status;
    if (s === "active" && org.is_active) return "active";
    if (s === "paused") return "paused";
    if (s === "refunded") return "refunded";
    if (s === "charged_back") return "charged_back";
    if (s === "cancelled") return "cancelled";
    return "no_subscription";
  };

  const getStatusLabel = (org: Organization): string => {
    const labels: Record<StatusFilter, string> = {
      all: "",
      active: "Ativo",
      blocked: "Bloqueado",
      no_subscription: "Sem assinatura",
      lead: "Sem plano",
      paused: "Pausada",
      refunded: "Reembolsado",
      charged_back: "Chargeback",
      cancelled: "Cancelada",
    };
    return labels[getUnifiedStatus(org)] || "—";
  };

  const filteredOrganizations = organizations.filter((org) => {
    const matchesSearch =
      org.name.toLowerCase().includes(search.toLowerCase()) ||
      org.slug.toLowerCase().includes(search.toLowerCase()) ||
      (org._leadEmail?.toLowerCase().includes(search.toLowerCase()) ?? false) ||
      (org.owner_email?.toLowerCase().includes(search.toLowerCase()) ?? false);

    const matchesStatus = statusFilter === "all" || getUnifiedStatus(org) === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // Pagination — 10 per page
  const PAGE_SIZE = 10;
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(filteredOrganizations.length / PAGE_SIZE));

  // Reset to page 1 when filters/search change or data length changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, filteredOrganizations.length]);

  const safePage = Math.min(currentPage, totalPages);
  const paginatedOrganizations = filteredOrganizations.slice(
    (safePage - 1) * PAGE_SIZE,
    safePage * PAGE_SIZE
  );

  const getStatusBadge = (org: Organization) => {
    const status = getUnifiedStatus(org);
    switch (status) {
      case "active":
        return <Badge className="bg-success text-success-foreground">Ativo</Badge>;
      case "paused":
        return <Badge variant="secondary">Pausada</Badge>;
      case "refunded":
        return <Badge className="bg-warning/20 text-warning border-warning/40">Reembolsado</Badge>;
      case "charged_back":
        return <Badge variant="destructive">Chargeback</Badge>;
      case "cancelled":
        return <Badge variant="secondary">Cancelada</Badge>;
      case "blocked":
        return <Badge variant="destructive">Bloqueado</Badge>;
      case "lead":
        return <Badge variant="outline" className="border-warning text-warning">Sem plano</Badge>;
      case "no_subscription":
      default:
        return <Badge variant="secondary">Sem assinatura</Badge>;
    }
  };

  const isExpiringSoon = (endDate: string | null | undefined) => {
    if (!endDate) return false;
    const end = new Date(endDate);
    const now = new Date();
    const days = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return days <= 7 && days > 0;
  };

  const leadsCount = organizations.filter(o => o._isLead).length;
  const orgsCount = organizations.filter(o => !o._isLead).length;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Clientes</h1>
            <p className="text-muted-foreground">
              {orgsCount} organizações · {leadsCount} leads pendentes
              {leadsFailed && " (⚠ falha ao carregar leads)"}
              {(search || statusFilter !== "all") && ` · ${filteredOrganizations.length} resultado${filteredOrganizations.length !== 1 ? "s" : ""}`}
            </p>
          </div>
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => { setLoading(true); fetchAll(); }}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button variant="outline" onClick={exportCSV}>
              <Download className="w-4 h-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </div>

        {/* Leads error banner */}
        {leadsFailed && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-warning/40 bg-warning/10 text-sm">
            <AlertCircle className="w-5 h-5 text-warning flex-shrink-0" />
            <span className="text-foreground">Não foi possível carregar a lista de leads. Use a busca por e-mail para encontrar usuários diretamente.</span>
            <Button size="sm" variant="outline" onClick={() => setEmailSearchOpen(true)} className="ml-auto">
              <UserSearch className="w-4 h-4 mr-1" />
              Buscar por e-mail
            </Button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, slug ou e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && search.includes("@") && filteredOrganizations.length === 0) {
                  setEmailSearchQuery(search.trim());
                  setEmailSearchOpen(true);
                  handleEmailSearch();
                }
              }}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="paused">Pausados</SelectItem>
              <SelectItem value="refunded">Reembolsados</SelectItem>
              <SelectItem value="charged_back">Chargeback</SelectItem>
              <SelectItem value="cancelled">Cancelados</SelectItem>
              <SelectItem value="blocked">Bloqueados</SelectItem>
              <SelectItem value="no_subscription">Sem assinatura</SelectItem>
              <SelectItem value="lead">Sem plano (Leads)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Auto-suggest global email search when local list is empty and search looks like email */}
        {!loading && search.includes("@") && filteredOrganizations.length === 0 && (
          <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 text-sm">
            <UserSearch className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <span className="text-foreground flex-1">
              Nenhum cliente encontrado com esse e-mail nesta lista. Buscar em todos os usuários do sistema?
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEmailSearchQuery(search.trim());
                setEmailSearchResult(null);
                setEmailSearchOpen(true);
              }}
            >
              Buscar globalmente
            </Button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredOrganizations.length === 0 ? (
          <div className="text-center py-12">
            <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">
              Nenhum resultado encontrado
            </h3>
            <p className="text-muted-foreground">
              {search ? "Tente uma busca diferente" : "Ainda não há dados"}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente / Lead</TableHead>
                  <TableHead>Plano</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Criado em</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedOrganizations.map((org) => (
                  <TableRow key={org.id} className={org._isLead ? "bg-warning/5" : undefined}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{org.name}</div>
                        <div className="text-sm text-muted-foreground">
                          {org.owner_email || org._leadEmail || org.slug}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {org._isLead ? "—" : (org.subscription?.plan?.name || "—")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(org)}
                        {!org._isLead && isExpiringSoon(org.subscription?.current_period_end) && (
                          <AlertTriangle className="w-4 h-4 text-warning" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {!org._isLead && org.subscription?.current_period_end ? (
                        <div>
                          <div className="text-sm">
                            Até {format(new Date(org.subscription.current_period_end), "dd/MM/yyyy", { locale: ptBR })}
                          </div>
                          {isExpiringSoon(org.subscription.current_period_end) && (
                            <div className="text-xs text-warning">Expira em breve</div>
                          )}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {!org._isLead && org.subscription?.plan?.price
                        ? formatCurrency(org.subscription.plan.price)
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {format(new Date(org.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      {org._isLead ? (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={creatingOrg}>
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleLeadGrantSubscription(org)}>
                              <Gift className="w-4 h-4 mr-2" />
                              Liberar assinatura
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => { setSelectedOrg(org); setDetailsOpen(true); }}>
                              <Eye className="w-4 h-4 mr-2" />
                              Ver detalhes
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => {
                                startImpersonation(org.id, org.name);
                                navigate("/dashboard");
                              }}
                            >
                              <LogIn className="w-4 h-4 mr-2" />
                              Acessar como cliente
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => { setSelectedOrg(org); setResetPwOpen(true); }}>
                              <KeyRound className="w-4 h-4 mr-2" />
                              Alterar senha
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setSelectedOrg(org); setManualSubOpen(true); }}>
                              <Gift className="w-4 h-4 mr-2" />
                              Liberar assinatura
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleBlock(org)}>
                              {org.blocked_at ? (
                                <><CheckCircle className="w-4 h-4 mr-2" />Desbloquear</>
                              ) : (
                                <><Ban className="w-4 h-4 mr-2" />Bloquear</>
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => { setSelectedOrg(org); setDetailsOpen(true); }}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="w-4 h-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredOrganizations.length > PAGE_SIZE && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <div className="text-sm text-muted-foreground">
              Mostrando {(safePage - 1) * PAGE_SIZE + 1}–
              {Math.min(safePage * PAGE_SIZE, filteredOrganizations.length)} de{" "}
              {filteredOrganizations.length}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
              >
                Anterior
              </Button>
              <span className="text-sm text-foreground px-2">
                Página {safePage} de {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
              >
                Próxima
              </Button>
            </div>
          </div>
        )}
      </div>

      <OrganizationDetailsDialog
        organization={selectedOrg}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
        onUpdate={fetchAll}
      />

      <ManualSubscriptionDialog
        organization={selectedOrg}
        open={manualSubOpen}
        onOpenChange={setManualSubOpen}
        onSuccess={fetchAll}
      />

      {selectedOrg && (
        <AdminResetPasswordDialog
          open={resetPwOpen}
          onOpenChange={setResetPwOpen}
          userId={selectedOrg.owner_user_id}
          userEmail={selectedOrg.owner_email || selectedOrg._leadEmail || selectedOrg.name}
        />
      )}

      {/* Email Search Dialog */}
      <Dialog open={emailSearchOpen} onOpenChange={setEmailSearchOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Buscar usuário por e-mail</DialogTitle>
            <DialogDescription>
              Encontre um usuário diretamente no sistema de autenticação.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Input
              placeholder="email@exemplo.com"
              value={emailSearchQuery}
              onChange={(e) => setEmailSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleEmailSearch()}
            />
            <Button onClick={handleEmailSearch} disabled={emailSearchLoading}>
              {emailSearchLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {emailSearchResult && !emailSearchResult.found && (
            <div className="p-3 rounded-lg border border-border bg-muted/30 text-sm text-muted-foreground">
              Nenhum usuário encontrado com este e-mail.
            </div>
          )}

          {emailSearchResult?.found && emailSearchResult.user && (
            <div className="p-4 rounded-lg border border-border space-y-2">
              <div className="font-medium">{emailSearchResult.user.email}</div>
              {emailSearchResult.user.full_name && (
                <div className="text-sm text-muted-foreground">{emailSearchResult.user.full_name}</div>
              )}
              <div className="text-xs text-muted-foreground">
                Criado em: {format(new Date(emailSearchResult.user.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
              </div>
              {emailSearchResult.user.has_organization ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">Já possui organização</Badge>
                  {emailSearchResult.user.organization_id && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => {
                        setEmailSearchOpen(false);
                        const org = organizations.find(o => o.id === emailSearchResult.user.organization_id);
                        if (org) {
                          setSelectedOrg(org);
                          setDetailsOpen(true);
                        } else {
                          setSearch(emailSearchResult.user.email);
                        }
                      }}
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      Ver organização
                    </Button>
                  )}
                </div>
              ) : (
                <Badge variant="outline" className="border-warning text-warning">Sem organização</Badge>
              )}
            </div>
          )}

          <DialogFooter>
            {emailSearchResult?.found && !emailSearchResult.user.has_organization && (
              <Button onClick={handleCreateOrgFromSearch} disabled={creatingOrg}>
                <Gift className="w-4 h-4 mr-2" />
                Criar organização e liberar plano
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
