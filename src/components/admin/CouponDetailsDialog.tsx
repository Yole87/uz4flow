import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { format, formatDistanceToNow, isPast, isFuture } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Tag, Users, Clock, Percent, DollarSign, Calendar, Target } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  name: string;
  description: string | null;
  discount_type: "percentage" | "fixed_amount";
  discount_value: number;
  applies_to: "all_plans" | "specific_plans";
  applicable_plan_ids: string[] | null;
  max_uses_total: number | null;
  current_uses: number;
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  is_first_purchase: boolean;
  created_at: string;
}

interface Redemption {
  id: string;
  organization_id: string;
  discount_applied: number;
  original_price: number;
  final_price: number;
  redeemed_at: string;
  organization?: {
    name: string;
  };
}

interface CouponDetailsDialogProps {
  coupon: Coupon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CouponDetailsDialog({
  coupon,
  open,
  onOpenChange,
}: CouponDetailsDialogProps) {
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSaved, setTotalSaved] = useState(0);

  useEffect(() => {
    if (coupon && open) {
      fetchRedemptions();
    }
  }, [coupon, open]);

  const fetchRedemptions = async () => {
    if (!coupon) return;
    setLoading(true);

    try {
      const { data, error } = await supabase
        .from("coupon_redemptions")
        .select("*, organization:organizations(name)")
        .eq("coupon_id", coupon.id)
        .order("redeemed_at", { ascending: false })
        .limit(20);

      if (error) throw error;

      const typedData = (data || []).map((r) => ({
        ...r,
        organization: Array.isArray(r.organization) ? r.organization[0] : r.organization,
      }));

      setRedemptions(typedData);
      setTotalSaved(typedData.reduce((acc, r) => acc + Number(r.discount_applied), 0));
    } catch (error) {
      console.error("Error fetching redemptions:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCouponStatus = (): "active" | "inactive" | "expired" | "scheduled" => {
    if (!coupon) return "inactive";
    if (!coupon.is_active) return "inactive";
    if (coupon.expires_at && isPast(new Date(coupon.expires_at))) return "expired";
    if (coupon.starts_at && isFuture(new Date(coupon.starts_at))) return "scheduled";
    if (coupon.max_uses_total && coupon.current_uses >= coupon.max_uses_total) return "expired";
    return "active";
  };

  const getStatusBadge = () => {
    const status = getCouponStatus();
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

  const getUsageProgress = () => {
    if (!coupon || !coupon.max_uses_total) return 0;
    return (coupon.current_uses / coupon.max_uses_total) * 100;
  };

  if (!coupon) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tag className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-mono">{coupon.code}</DialogTitle>
                <p className="text-sm text-muted-foreground">{coupon.name}</p>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  {coupon.discount_type === "percentage" ? (
                    <Percent className="h-4 w-4" />
                  ) : (
                    <DollarSign className="h-4 w-4" />
                  )}
                  <span className="text-xs">Desconto</span>
                </div>
                <p className="text-xl font-bold">
                  {coupon.discount_type === "percentage"
                    ? `${coupon.discount_value}%`
                    : `R$ ${coupon.discount_value.toFixed(2)}`}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-xs">Usos</span>
                </div>
                <p className="text-xl font-bold">
                  {coupon.current_uses}
                  {coupon.max_uses_total && (
                    <span className="text-sm font-normal text-muted-foreground">
                      /{coupon.max_uses_total}
                    </span>
                  )}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <DollarSign className="h-4 w-4" />
                  <span className="text-xs">Total economizado</span>
                </div>
                <p className="text-xl font-bold">R$ {totalSaved.toFixed(2)}</p>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Validade</span>
                </div>
                <p className="text-sm font-medium">
                  {coupon.expires_at
                    ? isPast(new Date(coupon.expires_at))
                      ? "Expirado"
                      : formatDistanceToNow(new Date(coupon.expires_at), {
                          addSuffix: true,
                          locale: ptBR,
                        })
                    : "Sem limite"}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Usage Progress */}
          {coupon.max_uses_total && (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-muted-foreground">Progresso de uso</span>
                <span className="font-medium">{Math.round(getUsageProgress())}%</span>
              </div>
              <Progress value={getUsageProgress()} className="h-2" />
            </div>
          )}

          <Separator />

          {/* Details */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Período de Validade
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Início</span>
                  <span>
                    {coupon.starts_at
                      ? format(new Date(coupon.starts_at), "dd/MM/yyyy", { locale: ptBR })
                      : "Imediato"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Expiração</span>
                  <span>
                    {coupon.expires_at
                      ? format(new Date(coupon.expires_at), "dd/MM/yyyy", { locale: ptBR })
                      : "Sem limite"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Criado em</span>
                  <span>
                    {format(new Date(coupon.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </span>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h4 className="text-sm font-medium flex items-center gap-2">
                <Target className="h-4 w-4" />
                Restrições
              </h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Aplica-se a</span>
                  <span>
                    {coupon.applies_to === "all_plans" ? "Todos os planos" : "Planos específicos"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Primeira compra</span>
                  <span>{coupon.is_first_purchase ? "Sim" : "Não"}</span>
                </div>
              </div>
            </div>
          </div>

          {coupon.description && (
            <>
              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">Descrição</h4>
                <p className="text-sm text-muted-foreground">{coupon.description}</p>
              </div>
            </>
          )}

          <Separator />

          {/* Redemptions History */}
          <div>
            <h4 className="text-sm font-medium mb-4 flex items-center gap-2">
              <Users className="h-4 w-4" />
              Últimos usos ({redemptions.length})
            </h4>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : redemptions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum uso registrado ainda
              </p>
            ) : (
              <div className="space-y-2">
                {redemptions.map((redemption) => (
                  <div
                    key={redemption.id}
                    className="flex items-center justify-between p-3 bg-muted rounded-lg"
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {redemption.organization?.name || "Organização removida"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(redemption.redeemed_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm text-success">
                        -R$ {Number(redemption.discount_applied).toFixed(2)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        R$ {Number(redemption.original_price).toFixed(2)} → R${" "}
                        {Number(redemption.final_price).toFixed(2)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
