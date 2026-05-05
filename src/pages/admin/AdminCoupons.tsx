import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Search,
  Plus,
  MoreVertical,
  Copy,
  Edit,
  Trash2,
  Eye,
  ToggleLeft,
  ToggleRight,
  Tag,
  Percent,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CouponFormDialog } from "@/components/admin/CouponFormDialog";
import { CouponDetailsDialog } from "@/components/admin/CouponDetailsDialog";
import { EmptyState } from "@/components/ui/empty-state";

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  applies_to: "all_plans" | "specific_plans";
  applicable_plan_ids: string[] | null;
  min_plan_price: number | null;
  max_uses_total: number | null;
  max_uses_per_user: number | null;
  current_uses: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  is_first_purchase: boolean;
  created_at: string;
}

export default function AdminCoupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive" | "expired">("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "percentage" | "fixed_amount">("all");
  const { toast } = useToast();

  // Dialogs
  const [formOpen, setFormOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [selectedCoupon, setSelectedCoupon] = useState<Coupon | null>(null);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    try {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Type cast the data to match our interface
      const typedData = (data || []).map((c) => ({
        ...c,
        discount_type: c.discount_type as "percentage" | "fixed_amount",
        applies_to: c.applies_to as "all_plans" | "specific_plans",
      }));

      setCoupons(typedData);
    } catch (error) {
      console.error("Error fetching coupons:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os cupons",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const { error } = await supabase
        .from("coupons")
        .update({ is_active: !coupon.is_active })
        .eq("id", coupon.id);

      if (error) throw error;

      toast({
        title: coupon.is_active ? "Cupom desativado" : "Cupom ativado",
        description: `${coupon.code} foi ${coupon.is_active ? "desativado" : "ativado"}`,
      });

      fetchCoupons();
    } catch (error) {
      console.error("Error toggling coupon:", error);
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o cupom",
        variant: "destructive",
      });
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!confirm(`Tem certeza que deseja excluir o cupom ${coupon.code}?`)) return;

    try {
      const { error } = await supabase.from("coupons").delete().eq("id", coupon.id);

      if (error) throw error;

      toast({
        title: "Cupom excluído",
        description: `${coupon.code} foi removido`,
      });

      fetchCoupons();
    } catch (error) {
      console.error("Error deleting coupon:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o cupom",
        variant: "destructive",
      });
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Código copiado!",
      description: code,
    });
  };

  const getCouponStatus = (coupon: Coupon): "active" | "inactive" | "expired" | "scheduled" => {
    if (!coupon.is_active) return "inactive";
    if (coupon.expires_at && isPast(new Date(coupon.expires_at))) return "expired";
    if (coupon.starts_at && isFuture(new Date(coupon.starts_at))) return "scheduled";
    if (coupon.max_uses_total && coupon.current_uses >= coupon.max_uses_total) return "expired";
    return "active";
  };

  const getStatusBadge = (coupon: Coupon) => {
    const status = getCouponStatus(coupon);
    switch (status) {
      case "active":
        return <Badge className="bg-success text-success-foreground">Ativo</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inativo</Badge>;
      case "expired":
        return <Badge variant="destructive">Expirado</Badge>;
      case "scheduled":
        return <Badge variant="outline">Agendado</Badge>;
    }
  };

  const getExpirationText = (coupon: Coupon) => {
    if (!coupon.expires_at) return "Sem expiração";
    const date = new Date(coupon.expires_at);
    if (isPast(date)) return "Expirado";
    return `Expira ${formatDistanceToNow(date, { addSuffix: true, locale: ptBR })}`;
  };

  const getUsageProgress = (coupon: Coupon) => {
    if (!coupon.max_uses_total) return 0;
    return (coupon.current_uses / coupon.max_uses_total) * 100;
  };

  const filteredCoupons = coupons.filter((coupon) => {
    // Search filter
    const matchesSearch =
      coupon.code.toLowerCase().includes(search.toLowerCase()) ||
      coupon.name.toLowerCase().includes(search.toLowerCase());

    // Status filter
    const status = getCouponStatus(coupon);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "active" && status === "active") ||
      (statusFilter === "inactive" && status === "inactive") ||
      (statusFilter === "expired" && (status === "expired" || status === "scheduled"));

    // Type filter
    const matchesType =
      typeFilter === "all" || coupon.discount_type === typeFilter;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Calculate stats
  const stats = {
    total: coupons.length,
    active: coupons.filter((c) => getCouponStatus(c) === "active").length,
    totalRedemptions: coupons.reduce((acc, c) => acc + c.current_uses, 0),
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Cupons de Desconto</h1>
            <p className="text-muted-foreground">Gerencie códigos promocionais</p>
          </div>
          <Button onClick={() => { setSelectedCoupon(null); setFormOpen(true); }}>
            <Plus className="w-4 h-4 mr-2" />
            Novo Cupom
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Tag className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total de cupons</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <ToggleRight className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.active}</p>
                  <p className="text-sm text-muted-foreground">Cupons ativos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <Percent className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.totalRedemptions}</p>
                  <p className="text-sm text-muted-foreground">Total de usos</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por código ou nome..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="inactive">Inativos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os tipos</SelectItem>
              <SelectItem value="percentage">Porcentagem</SelectItem>
              <SelectItem value="fixed_amount">Valor fixo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Coupons List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : filteredCoupons.length === 0 ? (
          <EmptyState
            variant="card"
            icon={Tag}
            title={search || statusFilter !== "all" || typeFilter !== "all" ? "Nenhum cupom encontrado" : "Nenhum cupom criado"}
            description={search || statusFilter !== "all" || typeFilter !== "all" ? "Ajuste os filtros ou tente uma busca diferente." : "Crie códigos promocionais para oferecer descontos aos seus clientes."}
            action={!search && statusFilter === "all" && typeFilter === "all" ? { label: "Novo cupom", icon: Plus, onClick: () => { setSelectedCoupon(null); setFormOpen(true); } } : undefined}
          />
        ) : (
          <div className="grid gap-4">
            {filteredCoupons.map((coupon) => (
              <Card key={coupon.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="flex items-center gap-2">
                          {coupon.discount_type === "percentage" ? (
                            <Percent className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <DollarSign className="h-4 w-4 text-muted-foreground" />
                          )}
                          <code className="text-lg font-bold font-mono">{coupon.code}</code>
                        </div>
                        {getStatusBadge(coupon)}
                        {coupon.is_first_purchase && (
                          <Badge variant="outline">1ª compra</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        {coupon.discount_type === "percentage"
                          ? `${coupon.discount_value}% de desconto`
                          : `R$ ${coupon.discount_value.toFixed(2)} de desconto`}
                        {" • "}
                        {coupon.name}
                      </p>

                      {coupon.max_uses_total && (
                        <div className="mb-2">
                          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                            <span>
                              {coupon.current_uses}/{coupon.max_uses_total} usos
                            </span>
                            <span>{Math.round(getUsageProgress(coupon))}%</span>
                          </div>
                          <Progress value={getUsageProgress(coupon)} className="h-1.5" />
                        </div>
                      )}

                      <p className="text-xs text-muted-foreground">
                        {getExpirationText(coupon)}
                        {" • "}
                        Criado em {format(new Date(coupon.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyCode(coupon.code)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => { setSelectedCoupon(coupon); setDetailsOpen(true); }}>
                            <Eye className="w-4 h-4 mr-2" />
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => { setSelectedCoupon(coupon); setFormOpen(true); }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleActive(coupon)}>
                            {coupon.is_active ? (
                              <>
                                <ToggleLeft className="w-4 h-4 mr-2" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <ToggleRight className="w-4 h-4 mr-2" />
                                Ativar
                              </>
                            )}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => deleteCoupon(coupon)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <CouponFormDialog
        coupon={selectedCoupon}
        open={formOpen}
        onOpenChange={setFormOpen}
        onSuccess={fetchCoupons}
      />

      <CouponDetailsDialog
        coupon={selectedCoupon}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </AdminLayout>
  );
}
