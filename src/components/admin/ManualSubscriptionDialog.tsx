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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Gift, Calendar } from "lucide-react";
import { format, addMonths, addYears } from "date-fns";

interface Plan {
  id: string;
  name: string;
  price: number;
  billing_cycle: string | null;
}

interface Organization {
  id: string;
  name: string;
}

interface ManualSubscriptionDialogProps {
  organization: Organization | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type ReasonType = "courtesy" | "promotion" | "partnership" | "support" | "other";

const reasonLabels: Record<ReasonType, string> = {
  courtesy: "Cortesia",
  promotion: "Promoção",
  partnership: "Parceria",
  support: "Suporte ao cliente",
  other: "Outro",
};

export function ManualSubscriptionDialog({
  organization,
  open,
  onOpenChange,
  onSuccess,
}: ManualSubscriptionDialogProps) {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
  const [reason, setReason] = useState<ReasonType>("courtesy");
  const [notes, setNotes] = useState("");
  const [notifyClient, setNotifyClient] = useState(false);

  useEffect(() => {
    if (open) {
      fetchPlans();
      resetForm();
    }
  }, [open]);

  const resetForm = () => {
    setSelectedPlanId("");
    setStartDate(format(new Date(), "yyyy-MM-dd"));
    setEndDate(format(addMonths(new Date(), 1), "yyyy-MM-dd"));
    setReason("courtesy");
    setNotes("");
    setNotifyClient(false);
  };

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, name, price, billing_cycle")
        .eq("is_active", true)
        .order("price", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
      if (data && data.length > 0) {
        setSelectedPlanId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (planId: string) => {
    setSelectedPlanId(planId);
    const plan = plans.find((p) => p.id === planId);
    if (plan) {
      const start = new Date(startDate);
      const end = plan.billing_cycle === "yearly" ? addYears(start, 1) : addMonths(start, 1);
      setEndDate(format(end, "yyyy-MM-dd"));
    }
  };

  const handleSubmit = async () => {
    if (!organization || !selectedPlanId) return;

    setSubmitting(true);
    try {
      // Check for existing subscription
      const { data: existingSub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("organization_id", organization.id)
        .maybeSingle();

      if (existingSub) {
        // Update existing subscription
        const { error } = await supabase
          .from("subscriptions")
          .update({
            plan_id: selectedPlanId,
            status: "active",
            current_period_start: new Date(startDate).toISOString(),
            current_period_end: new Date(endDate).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingSub.id);

        if (error) throw error;
      } else {
        // Create new subscription
        const { error } = await supabase.from("subscriptions").insert({
          organization_id: organization.id,
          plan_id: selectedPlanId,
          status: "active",
          current_period_start: new Date(startDate).toISOString(),
          current_period_end: new Date(endDate).toISOString(),
        });

        if (error) throw error;
      }

      // Activate organization
      await supabase
        .from("organizations")
        .update({
          is_active: true,
          blocked_at: null,
          block_reason: null,
          notes: notes
            ? `${organization.name} - Assinatura manual: ${reasonLabels[reason]}. ${notes}`
            : undefined,
        })
        .eq("id", organization.id);

      // Audit log
      await supabase.from("admin_audit_logs").insert({
        actor_user_id: (await supabase.auth.getUser()).data.user?.id,
        action: "manual_subscription",
        target_type: "organization",
        target_id: organization.id,
        metadata: { plan_id: selectedPlanId, reason, start_date: startDate, end_date: endDate },
      });

      toast({
        title: "Assinatura liberada",
        description: `Plano ativado para ${organization.name} com sucesso`,
      });

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating subscription:", error);
      toast({
        title: "Erro",
        description: "Não foi possível liberar a assinatura",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!organization) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Liberar Assinatura Manual
          </DialogTitle>
          <DialogDescription>
            Ative um plano para <strong>{organization.name}</strong> sem necessidade de pagamento.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plano</Label>
              <Select value={selectedPlanId} onValueChange={handlePlanChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um plano" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((plan) => (
                    <SelectItem key={plan.id} value={plan.id}>
                      {plan.name} - R$ {plan.price.toFixed(2)}/{plan.billing_cycle === "yearly" ? "ano" : "mês"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Data de início
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  Data de término
                </Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Motivo da liberação</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as ReasonType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reasonLabels).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Adicione detalhes sobre esta liberação..."
                rows={2}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="notify"
                checked={notifyClient}
                onCheckedChange={(checked) => setNotifyClient(checked === true)}
              />
              <Label htmlFor="notify" className="text-sm font-normal cursor-pointer">
                Notificar cliente por email (em breve)
              </Label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting || !selectedPlanId}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Liberar Assinatura
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
