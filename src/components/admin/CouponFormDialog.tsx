import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Percent, DollarSign } from "lucide-react";
import { format, addMonths } from "date-fns";

interface Plan {
  id: string;
  name: string;
  price: number;
}

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
  starts_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  is_first_purchase: boolean;
}

interface CouponFormDialogProps {
  coupon: Coupon | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const generateCode = (): string => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

export function CouponFormDialog({
  coupon,
  open,
  onOpenChange,
  onSuccess,
}: CouponFormDialogProps) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [discountType, setDiscountType] = useState<"percentage" | "fixed_amount">("percentage");
  const [discountValue, setDiscountValue] = useState("");
  const [appliesTo, setAppliesTo] = useState<"all_plans" | "specific_plans">("all_plans");
  const [selectedPlanIds, setSelectedPlanIds] = useState<string[]>([]);
  const [maxUsesTotal, setMaxUsesTotal] = useState("");
  const [maxUsesPerUser, setMaxUsesPerUser] = useState("1");
  const [startsAt, setStartsAt] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [isFirstPurchase, setIsFirstPurchase] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPlans();
      if (coupon) {
        populateForm(coupon);
      } else {
        resetForm();
      }
    }
  }, [open, coupon]);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (c: Coupon) => {
    setCode(c.code);
    setName(c.name);
    setDescription(c.description || "");
    setDiscountType(c.discount_type);
    setDiscountValue(c.discount_value.toString());
    setAppliesTo(c.applies_to);
    setSelectedPlanIds(c.applicable_plan_ids || []);
    setMaxUsesTotal(c.max_uses_total?.toString() || "");
    setMaxUsesPerUser(c.max_uses_per_user?.toString() || "1");
    setStartsAt(c.starts_at ? format(new Date(c.starts_at), "yyyy-MM-dd") : "");
    setExpiresAt(c.expires_at ? format(new Date(c.expires_at), "yyyy-MM-dd") : "");
    setIsActive(c.is_active);
    setIsFirstPurchase(c.is_first_purchase);
  };

  const resetForm = () => {
    setCode(generateCode());
    setName("");
    setDescription("");
    setDiscountType("percentage");
    setDiscountValue("");
    setAppliesTo("all_plans");
    setSelectedPlanIds([]);
    setMaxUsesTotal("");
    setMaxUsesPerUser("1");
    setStartsAt("");
    setExpiresAt(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
    setIsActive(true);
    setIsFirstPurchase(false);
  };

  const handleSubmit = async () => {
    if (!code.trim() || !name.trim() || !discountValue) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha o código, nome e valor do desconto",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const couponData = {
        code: code.toUpperCase().trim(),
        name: name.trim(),
        description: description.trim() || null,
        discount_type: discountType,
        discount_value: parseFloat(discountValue),
        applies_to: appliesTo,
        applicable_plan_ids: appliesTo === "specific_plans" ? selectedPlanIds : [],
        max_uses_total: maxUsesTotal ? parseInt(maxUsesTotal) : null,
        max_uses_per_user: maxUsesPerUser ? parseInt(maxUsesPerUser) : 1,
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
        expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        is_active: isActive,
        is_first_purchase: isFirstPurchase,
      };

      if (coupon) {
        // Update
        const { error } = await supabase
          .from("coupons")
          .update(couponData)
          .eq("id", coupon.id);

        if (error) throw error;

        // Audit log
        await supabase.from("admin_audit_logs").insert({
          actor_user_id: (await supabase.auth.getUser()).data.user?.id,
          action: "update_coupon",
          target_type: "coupon",
          target_id: coupon.id,
          metadata: { code: couponData.code },
        });

        toast({
          title: "Cupom atualizado",
          description: `${code} foi salvo com sucesso`,
        });
      } else {
        // Create
        const { error } = await supabase.from("coupons").insert(couponData);

        if (error) {
          if (error.code === "23505") {
            throw new Error("Este código já existe. Escolha outro.");
          }
          throw error;
        }

        // Audit log
        await supabase.from("admin_audit_logs").insert({
          actor_user_id: (await supabase.auth.getUser()).data.user?.id,
          action: "create_coupon",
          target_type: "coupon",
          metadata: { code: couponData.code },
        });

        toast({
          title: "Cupom criado",
          description: `${code} foi adicionado com sucesso`,
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving coupon:", error);
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Não foi possível salvar o cupom",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const togglePlan = (planId: string) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId) ? prev.filter((id) => id !== planId) : [...prev, planId]
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{coupon ? "Editar Cupom" : "Novo Cupom"}</DialogTitle>
          <DialogDescription>
            {coupon
              ? "Atualize as informações do cupom de desconto"
              : "Crie um novo código promocional para seus clientes"}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Basic Info */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Informações Básicas</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Código do cupom</Label>
                  <div className="flex gap-2">
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      placeholder="DESCONTO20"
                      className="font-mono uppercase"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={() => setCode(generateCode())}
                      title="Gerar código"
                    >
                      <Sparkles className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Nome interno</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Black Friday 2024"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detalhes sobre este cupom..."
                  rows={2}
                />
              </div>
            </div>

            <Separator />

            {/* Discount */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Desconto</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de desconto</Label>
                  <Select value={discountType} onValueChange={(v) => setDiscountType(v as typeof discountType)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">
                        <div className="flex items-center gap-2">
                          <Percent className="h-4 w-4" />
                          Porcentagem
                        </div>
                      </SelectItem>
                      <SelectItem value="fixed_amount">
                        <div className="flex items-center gap-2">
                          <DollarSign className="h-4 w-4" />
                          Valor fixo
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Valor</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                      {discountType === "percentage" ? "%" : "R$"}
                    </span>
                    <Input
                      type="number"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(e.target.value)}
                      placeholder={discountType === "percentage" ? "20" : "50.00"}
                      className="pl-10"
                      min="0"
                      max={discountType === "percentage" ? "100" : undefined}
                      step={discountType === "percentage" ? "1" : "0.01"}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Aplica-se a</Label>
                <Select value={appliesTo} onValueChange={(v) => setAppliesTo(v as typeof appliesTo)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all_plans">Todos os planos</SelectItem>
                    <SelectItem value="specific_plans">Planos específicos</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {appliesTo === "specific_plans" && (
                <div className="space-y-2">
                  <Label>Selecione os planos</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {plans.map((plan) => (
                      <div
                        key={plan.id}
                        className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedPlanIds.includes(plan.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:border-primary/50"
                        }`}
                        onClick={() => togglePlan(plan.id)}
                      >
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selectedPlanIds.includes(plan.id)}
                            onCheckedChange={() => togglePlan(plan.id)}
                          />
                          <div>
                            <p className="text-sm font-medium">{plan.name}</p>
                            <p className="text-xs text-muted-foreground">
                              R$ {plan.price.toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Limits */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Limites</h4>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Máximo de usos total</Label>
                  <Input
                    type="number"
                    value={maxUsesTotal}
                    onChange={(e) => setMaxUsesTotal(e.target.value)}
                    placeholder="Ilimitado"
                    min="1"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Máximo por usuário</Label>
                  <Input
                    type="number"
                    value={maxUsesPerUser}
                    onChange={(e) => setMaxUsesPerUser(e.target.value)}
                    placeholder="1"
                    min="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data de início</Label>
                  <Input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Data de expiração</Label>
                  <Input
                    type="date"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <Separator />

            {/* Options */}
            <div className="space-y-4">
              <h4 className="text-sm font-medium text-muted-foreground">Opções</h4>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={isActive}
                    onCheckedChange={(checked) => setIsActive(checked === true)}
                  />
                  <Label htmlFor="active" className="font-normal cursor-pointer">
                    Cupom ativo
                  </Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="first_purchase"
                    checked={isFirstPurchase}
                    onCheckedChange={(checked) => setIsFirstPurchase(checked === true)}
                  />
                  <Label htmlFor="first_purchase" className="font-normal cursor-pointer">
                    Válido apenas para primeira compra
                  </Label>
                </div>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {coupon ? "Salvar alterações" : "Criar cupom"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
