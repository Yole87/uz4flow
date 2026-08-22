import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, FileText, Star, HelpCircle, ChevronDown, Check, HardDrive, Users, Contact } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ALL_FEATURES } from "@/hooks/useOrganizationLimits";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  price: number;
  price_quarterly: number | null;
  price_semiannual: number | null;
  price_yearly: number | null;
  billing_cycle: string;
  limits: {
    features: string[];
    storage_limit_mb?: number;
    member_limit?: number;
    contact_limit?: number;
    data_retention_days?: number;
    uz_forms_enabled?: boolean;
    max_uz_forms?: number;
    max_uz_form_responses_monthly?: number;
    uz_forms_allow_media?: boolean;
    uz_forms_allow_custom_slug?: boolean;
    uz_forms_watermark_text?: string;
  };
  is_public: boolean;
  is_active: boolean;
  is_free: boolean;
  is_popular: boolean;
  sort_order: number;
  highlight_label: string | null;
  mp_plan_id: string | null;
  trial_days: number | null;
}

const defaultLimits = {
  features: [] as string[],
  storage_limit_mb: 500,
  member_limit: 1,
  contact_limit: 500,
  data_retention_days: 0,
  uz_forms_enabled: false,
  max_uz_forms: 5,
  max_uz_form_responses_monthly: 100,
  uz_forms_allow_media: false,
  uz_forms_allow_custom_slug: false,
  uz_forms_watermark_text: "",
};

export default function AdminPlans() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: 0,
    price_quarterly: null as number | null,
    price_semiannual: null as number | null,
    price_yearly: null as number | null,
    billing_cycle: "monthly",
    is_public: true,
    is_active: true,
    is_free: false,
    is_popular: false,
    sort_order: 0,
    highlight_label: "",
    limits: defaultLimits,
    trial_days: null as number | null,
  });

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      setPlans((data || []).map(p => ({
        ...p,
        limits: { 
          features: ((p.limits as Record<string, unknown>)?.features as string[]) ?? [],
          storage_limit_mb: ((p.limits as Record<string, unknown>)?.storage_limit_mb as number) ?? 500,
          member_limit: ((p.limits as Record<string, unknown>)?.member_limit as number) ?? 1,
          contact_limit: ((p.limits as Record<string, unknown>)?.contact_limit as number) ?? 500,
          data_retention_days: ((p.limits as Record<string, unknown>)?.data_retention_days as number) ?? 0,
          uz_forms_enabled: ((p.limits as Record<string, unknown>)?.uz_forms_enabled as boolean) ?? false,
          max_uz_forms: ((p.limits as Record<string, unknown>)?.max_uz_forms as number) ?? 5,
          max_uz_form_responses_monthly: ((p.limits as Record<string, unknown>)?.max_uz_form_responses_monthly as number) ?? 100,
          uz_forms_allow_media: ((p.limits as Record<string, unknown>)?.uz_forms_allow_media as boolean) ?? false,
          uz_forms_allow_custom_slug: ((p.limits as Record<string, unknown>)?.uz_forms_allow_custom_slug as boolean) ?? false,
          uz_forms_watermark_text: ((p.limits as Record<string, unknown>)?.uz_forms_watermark_text as string) ?? "",
        }
      })));
    } catch (error) {
      console.error("Error fetching plans:", error);
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (plan?: Plan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
        name: plan.name,
        description: plan.description || "",
        price: plan.price,
        price_quarterly: plan.price_quarterly,
        price_semiannual: plan.price_semiannual,
        price_yearly: plan.price_yearly,
        billing_cycle: plan.billing_cycle,
        is_public: plan.is_public,
        is_active: plan.is_active,
        is_free: plan.is_free,
        is_popular: plan.is_popular,
        sort_order: plan.sort_order,
        highlight_label: plan.highlight_label || "",
        limits: {
          features: plan.limits.features ?? [],
          storage_limit_mb: plan.limits.storage_limit_mb ?? 500,
          member_limit: plan.limits.member_limit ?? 1,
          contact_limit: plan.limits.contact_limit ?? 500,
          data_retention_days: plan.limits.data_retention_days ?? 0,
          uz_forms_enabled: plan.limits.uz_forms_enabled ?? false,
          max_uz_forms: plan.limits.max_uz_forms ?? 5,
          max_uz_form_responses_monthly: plan.limits.max_uz_form_responses_monthly ?? 100,
          uz_forms_allow_media: plan.limits.uz_forms_allow_media ?? false,
          uz_forms_allow_custom_slug: plan.limits.uz_forms_allow_custom_slug ?? false,
          uz_forms_watermark_text: plan.limits.uz_forms_watermark_text ?? "",
        },
        trial_days: plan.trial_days,
      });
    } else {
      setEditingPlan(null);
      setFormData({
        name: "",
        description: "",
        price: 0,
        price_quarterly: null,
        price_semiannual: null,
        price_yearly: null,
        billing_cycle: "monthly",
        is_public: true,
        is_active: true,
        is_free: false,
        is_popular: false,
        sort_order: plans.length + 1,
        highlight_label: "",
        limits: defaultLimits,
        trial_days: null,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        price_quarterly: formData.is_free ? null : (formData.price_quarterly || null),
        price_semiannual: formData.is_free ? null : (formData.price_semiannual || null),
        price_yearly: formData.is_free ? null : (formData.price_yearly || null),
        billing_cycle: formData.billing_cycle,
        is_public: formData.is_public,
        is_active: formData.is_active,
        is_free: formData.is_free,
        is_popular: formData.is_popular,
        sort_order: formData.sort_order,
        highlight_label: formData.highlight_label || null,
        limits: {
          features: formData.limits.features,
          storage_limit_mb: formData.limits.storage_limit_mb ?? 500,
          member_limit: formData.limits.member_limit ?? 1,
          contact_limit: formData.limits.contact_limit ?? 500,
          data_retention_days: formData.limits.data_retention_days ?? 0,
          uz_forms_enabled: formData.limits.uz_forms_enabled ?? false,
          max_uz_forms: formData.limits.max_uz_forms ?? 5,
          max_uz_form_responses_monthly: formData.limits.max_uz_form_responses_monthly ?? 100,
          uz_forms_allow_media: formData.limits.uz_forms_allow_media ?? false,
          uz_forms_allow_custom_slug: formData.limits.uz_forms_allow_custom_slug ?? false,
          uz_forms_watermark_text: formData.limits.uz_forms_watermark_text ?? "",
        },
        trial_days: formData.is_free ? (formData.trial_days || null) : null,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("subscription_plans")
          .update(payload as never)
          .eq("id", editingPlan.id);
        if (error) throw error;
        toast({ title: "Plano atualizado com sucesso" });
      } else {
        const { error } = await supabase
          .from("subscription_plans")
          .insert([payload] as never);
        if (error) throw error;
        toast({ title: "Plano criado com sucesso" });
      }

      setIsDialogOpen(false);
      fetchPlans();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast({ title: "Erro", description: "Não foi possível salvar o plano", variant: "destructive" });
    }
  };

  const deletePlan = async (plan: Plan) => {
    if (!confirm(`Deseja realmente excluir o plano "${plan.name}"?`)) return;
    try {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", plan.id);
      if (error) throw error;
      toast({ title: "Plano excluído com sucesso" });
      fetchPlans();
    } catch (error: any) {
      console.error("Error deleting plan:", error);
      const isFkError = error?.code === "23503" || /foreign key|violates|referenc/i.test(error?.message ?? "");
      toast({
        title: "Erro",
        description: isFkError
          ? "Este plano possui clientes ou histórico vinculados. Migre as assinaturas para outro plano antes de excluir."
          : "Não foi possível excluir o plano",
        variant: "destructive",
      });
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const toggleFeature = (feature: string) => {
    const features = formData.limits.features || [];
    const updated = features.includes(feature)
      ? features.filter(f => f !== feature)
      : [...features, feature];
    setFormData({ ...formData, limits: { ...formData.limits, features: updated } });
  };

  const selectAllFeatures = () => {
    setFormData({ ...formData, limits: { ...formData.limits, features: ALL_FEATURES.map(f => f.key) } });
  };

  const clearAllFeatures = () => {
    setFormData({ ...formData, limits: { ...formData.limits, features: [] } });
  };

  // Group features by category
  const featuresByCategory = ALL_FEATURES.reduce((acc, f) => {
    if (!acc[f.category]) acc[f.category] = [];
    acc[f.category].push(f);
    return acc;
  }, {} as Record<string, typeof ALL_FEATURES[number][]>);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Planos</h1>
            <p className="text-muted-foreground">Gerencie os planos de assinatura por funcionalidades</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => openDialog()} className="gradient-primary border-0">
                <Plus className="w-4 h-4 mr-2" />
                Novo Plano
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[85svh] overflow-hidden flex flex-col p-0">
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle>{editingPlan ? "Editar Plano" : "Novo Plano"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
                <Tabs defaultValue="general" className="flex-1 flex flex-col min-h-0">
                  <TabsList className="mx-6 mt-4 grid grid-cols-3 w-auto shrink-0">
                    <TabsTrigger value="general">Geral</TabsTrigger>
                    <TabsTrigger value="pricing">Preços</TabsTrigger>
                    <TabsTrigger value="features">Recursos</TabsTrigger>
                  </TabsList>

                  {/* Aba GERAL */}
                  <TabsContent value="general" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nome</Label>
                      <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="description">Descrição</Label>
                      <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sort_order">Ordem</Label>
                        <Input id="sort_order" type="number" value={formData.sort_order} onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="highlight_label">Label de destaque</Label>
                        <Input id="highlight_label" value={formData.highlight_label} onChange={(e) => setFormData({ ...formData, highlight_label: e.target.value })} placeholder="Ex: Mais Popular" />
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6">
                      <div className="flex items-center gap-2">
                        <Switch id="is_public" checked={formData.is_public} onCheckedChange={(c) => setFormData({ ...formData, is_public: c })} />
                        <Label htmlFor="is_public">Público</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="is_active" checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: c })} />
                        <Label htmlFor="is_active">Ativo</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="is_free" checked={formData.is_free} onCheckedChange={(c) => setFormData({ ...formData, is_free: c, trial_days: c ? (formData.trial_days || 7) : null })} />
                        <Label htmlFor="is_free">Gratuito</Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch id="is_popular" checked={formData.is_popular} onCheckedChange={(c) => setFormData({ ...formData, is_popular: c })} />
                        <Label htmlFor="is_popular" className="flex items-center gap-1">
                          <Star className="w-3 h-3 text-amber-500" />
                          Destaque
                        </Label>
                      </div>
                    </div>

                    {formData.is_free && (
                      <div className="space-y-2 p-4 rounded-lg border border-success/30 bg-success/5">
                        <Label htmlFor="trial_days" className="text-sm font-medium">Dias de teste grátis</Label>
                        <Input
                          id="trial_days"
                          type="number"
                          min={1}
                          max={365}
                          value={formData.trial_days ?? ""}
                          onChange={(e) => setFormData({ ...formData, trial_days: e.target.value ? parseInt(e.target.value) : null })}
                          placeholder="Ex: 7"
                          className="max-w-[200px]"
                        />
                        <p className="text-xs text-muted-foreground">Defina quantos dias o período de teste gratuito terá. Deixe vazio para ilimitado.</p>
                      </div>
                    )}
                  </TabsContent>

                  {/* Aba PREÇOS */}
                  <TabsContent value="pricing" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
                    <div className="space-y-2">
                      <Label htmlFor="price">Preço Mensal (R$)</Label>
                      <Input id="price" type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) })} required />
                    </div>

                    {!formData.is_free && (
                      <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                        <Label className="text-sm font-semibold">Preços por Ciclo de Cobrança</Label>
                        <p className="text-xs text-muted-foreground">Defina o valor total para cada período. Deixe vazio para desabilitar o ciclo.</p>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="price_quarterly" className="text-xs">Trimestral (R$)</Label>
                            <Input id="price_quarterly" type="number" step="0.01" value={formData.price_quarterly ?? ""} onChange={(e) => setFormData({ ...formData, price_quarterly: e.target.value ? parseFloat(e.target.value) : null })} placeholder={`Sugestão: ${(formData.price * 3 * 0.95).toFixed(2)}`} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="price_semiannual" className="text-xs">Semestral (R$)</Label>
                            <Input id="price_semiannual" type="number" step="0.01" value={formData.price_semiannual ?? ""} onChange={(e) => setFormData({ ...formData, price_semiannual: e.target.value ? parseFloat(e.target.value) : null })} placeholder={`Sugestão: ${(formData.price * 6 * 0.9).toFixed(2)}`} />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="price_yearly" className="text-xs">Anual (R$)</Label>
                            <Input id="price_yearly" type="number" step="0.01" value={formData.price_yearly ?? ""} onChange={(e) => setFormData({ ...formData, price_yearly: e.target.value ? parseFloat(e.target.value) : null })} placeholder={`Sugestão: ${(formData.price * 12 * 0.8).toFixed(2)}`} />
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                      <Label className="text-sm font-semibold">Limites Quantitativos</Label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="storage_limit_mb" className="text-xs">Storage (MB)</Label>
                          <Input
                            id="storage_limit_mb"
                            type="number"
                            min={0}
                            value={formData.limits.storage_limit_mb ?? 500}
                            onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits, storage_limit_mb: parseInt(e.target.value) || 500 } })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="member_limit" className="text-xs">Membros (-1 = ilimitado)</Label>
                          <Input
                            id="member_limit"
                            type="number"
                            min={-1}
                            value={formData.limits.member_limit ?? 1}
                            onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits, member_limit: parseInt(e.target.value) } })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="contact_limit" className="text-xs">Contatos (-1 = ilimitado)</Label>
                          <Input
                            id="contact_limit"
                            type="number"
                            min={-1}
                            value={formData.limits.contact_limit ?? 500}
                            onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits, contact_limit: parseInt(e.target.value) } })}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="data_retention_days" className="text-xs">Retenção de dados em dias (0 = sem limite)</Label>
                        <Input
                          id="data_retention_days"
                          type="number"
                          min={0}
                          value={formData.limits.data_retention_days ?? 0}
                          onChange={(e) => setFormData({ ...formData, limits: { ...formData.limits, data_retention_days: Math.max(0, parseInt(e.target.value) || 0) } })}
                        />
                        <p className="text-xs text-muted-foreground">Mensagens e conversas mais antigas que esse limite serão removidas automaticamente todos os dias às 03:00 UTC.</p>
                      </div>
                      <p className="text-xs text-muted-foreground">Use -1 para limites ilimitados. Storage em MB, membros e contatos em quantidade.</p>
                    </div>

                    <div className="space-y-4 p-4 rounded-lg border bg-muted/30">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-semibold">Formulários com URL habilitados</Label>
                        <Switch
                          id="uz_forms_enabled"
                          checked={formData.limits.uz_forms_enabled || false}
                          onCheckedChange={(checked) =>
                            setFormData({
                              ...formData,
                              limits: { ...formData.limits, uz_forms_enabled: checked },
                            })
                          }
                        />
                      </div>

                      {formData.limits.uz_forms_enabled && (
                        <div className="space-y-4 pt-2 border-t border-border animate-in fade-in">
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="max_uz_forms" className="text-xs">Máximo de formulários (-1 = ilimitado)</Label>
                              <Input
                                id="max_uz_forms"
                                type="number"
                                min={-1}
                                value={formData.limits.max_uz_forms ?? 5}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    limits: {
                                      ...formData.limits,
                                      max_uz_forms: parseInt(e.target.value) || 1,
                                    },
                                  })
                                }
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="max_uz_form_responses_monthly" className="text-xs">Máximo de respostas/mês (-1 = ilimitado)</Label>
                              <Input
                                id="max_uz_form_responses_monthly"
                                type="number"
                                min={-1}
                                value={formData.limits.max_uz_form_responses_monthly ?? 100}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    limits: {
                                      ...formData.limits,
                                      max_uz_form_responses_monthly: parseInt(e.target.value) || 1,
                                    },
                                  })
                                }
                              />
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-6 pt-2">
                            <div className="flex items-center gap-2">
                              <Switch
                                id="uz_forms_allow_media"
                                checked={formData.limits.uz_forms_allow_media || false}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    limits: { ...formData.limits, uz_forms_allow_media: checked },
                                  })
                                }
                              />
                              <Label htmlFor="uz_forms_allow_media" className="text-xs cursor-pointer">Permite imagem/vídeo</Label>
                            </div>

                            <div className="flex items-center gap-2">
                              <Switch
                                id="uz_forms_allow_custom_slug"
                                checked={formData.limits.uz_forms_allow_custom_slug || false}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    limits: {
                                      ...formData.limits,
                                      uz_forms_allow_custom_slug: checked,
                                    },
                                  })
                                }
                              />
                              <Label htmlFor="uz_forms_allow_custom_slug" className="text-xs cursor-pointer">Permite slug personalizado</Label>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="uz_forms_watermark_mode" className="text-xs">Modo da marca d'água</Label>
                            <select
                              id="uz_forms_watermark_mode"
                              className="w-full h-9 rounded-md border border-border bg-background px-3 text-sm"
                              value={formData.limits.uz_forms_watermark_mode || "platform"}
                              onChange={(e) =>
                                setFormData({
                                  ...formData,
                                  limits: {
                                    ...formData.limits,
                                    uz_forms_watermark_mode: e.target.value,
                                  },
                                })
                              }
                            >
                              <option value="platform">Padrão da plataforma (Uz4Flow)</option>
                              <option value="custom">Texto fixo definido aqui</option>
                              <option value="tenant_choice">Cliente escolhe o texto</option>
                            </select>
                          </div>

                          {(formData.limits.uz_forms_watermark_mode || "platform") === "custom" && (
                            <div className="space-y-2">
                              <Label htmlFor="uz_forms_watermark_text" className="text-xs">Texto de marca d'água</Label>
                              <Input
                                id="uz_forms_watermark_text"
                                type="text"
                                placeholder="Ex: Desenvolvido por Uz4Flow"
                                value={formData.limits.uz_forms_watermark_text || ""}
                                onChange={(e) =>
                                  setFormData({
                                    ...formData,
                                    limits: {
                                      ...formData.limits,
                                      uz_forms_watermark_text: e.target.value,
                                    },
                                  })
                                }
                              />
                              <p className="text-xs text-muted-foreground">
                                Deixe vazio para o texto padrão da plataforma.
                              </p>
                            </div>
                          )}

                        </div>
                      )}
                    </div>
                  </TabsContent>

                  {/* Aba RECURSOS */}
                  <TabsContent value="features" className="flex-1 overflow-y-auto px-6 py-4 space-y-4 mt-0">
                    <div className="flex items-center justify-between">
                      <Label className="text-base font-semibold">Funcionalidades</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant="ghost" size="sm" onClick={selectAllFeatures}>Marcar todas</Button>
                        <Button type="button" variant="ghost" size="sm" onClick={clearAllFeatures}>Limpar</Button>
                      </div>
                    </div>

                    {Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
                      <div key={category} className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{category}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {categoryFeatures.map(({ key, label }) => (
                            <div key={key} className="flex items-center gap-2">
                              <Checkbox
                                id={`feature-${key}`}
                                checked={formData.limits.features?.includes(key) || false}
                                onCheckedChange={() => toggleFeature(key)}
                              />
                              <Label htmlFor={`feature-${key}`} className="text-sm cursor-pointer">{label}</Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    <Collapsible open={guideOpen} onOpenChange={setGuideOpen}>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="outline" className="w-full flex items-center justify-between gap-2">
                          <span className="flex items-center gap-2">
                            <HelpCircle className="w-4 h-4" />
                            Guia de Funcionalidades
                          </span>
                          <ChevronDown className={cn("w-4 h-4 transition-transform", guideOpen && "rotate-180")} />
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="pt-4">
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                          {Object.entries(featuresByCategory).map(([category, categoryFeatures]) => (
                            <div key={category}>
                              <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-primary" />
                                {category}
                              </h4>
                              <div className="space-y-2 ml-4">
                                {categoryFeatures.map(({ key, label, description }) => (
                                  <div key={key} className="flex gap-2">
                                    <span className="text-sm font-medium text-foreground min-w-[160px]">{label}:</span>
                                    <span className="text-sm text-muted-foreground">{description}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  </TabsContent>
                </Tabs>

                <div className="border-t px-6 py-4 flex justify-end gap-3 shrink-0">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                  <Button type="submit" className="gradient-primary border-0">{editingPlan ? "Salvar" : "Criar Plano"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : plans.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-1">Nenhum plano cadastrado</h3>
            <p className="text-muted-foreground mb-4">Crie seu primeiro plano de assinatura</p>
            <Button onClick={() => openDialog()} className="gradient-primary border-0">
              <Plus className="w-4 h-4 mr-2" />
              Criar Plano
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plans.map((plan) => (
              <Card key={plan.id} className={cn(
                !plan.is_active && "opacity-60",
                plan.is_popular && "ring-2 ring-amber-500/50 border-amber-500/30"
              )}>
                <CardHeader className="flex flex-row items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="truncate">{plan.name}</span>
                      {plan.is_popular && (
                        <Badge className="bg-amber-500/20 text-amber-500 border-amber-500/30 text-xs shrink-0">
                          <Star className="w-3 h-3 mr-1" />
                          Destaque
                        </Badge>
                      )}
                      {plan.highlight_label && (
                        <Badge className="gradient-primary text-white text-xs shrink-0">{plan.highlight_label}</Badge>
                      )}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openDialog(plan)}><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => deletePlan(plan)}><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold mb-2">
                    {plan.is_free ? "Grátis" : formatCurrency(plan.price)}
                    {!plan.is_free && <span className="text-sm font-normal text-muted-foreground">/mês</span>}
                  </div>
                  {!plan.is_free && (
                    <div className="flex flex-wrap gap-1.5 mb-4 text-xs text-muted-foreground">
                      {plan.price_quarterly && <span>Tri: {formatCurrency(plan.price_quarterly)}</span>}
                      {plan.price_semiannual && <span>• Sem: {formatCurrency(plan.price_semiannual)}</span>}
                      {plan.price_yearly && <span>• Anual: {formatCurrency(plan.price_yearly)}</span>}
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-2 mb-4">
                    {!plan.is_active && <Badge variant="secondary">Inativo</Badge>}
                    {!plan.is_public && <Badge variant="outline">Privado</Badge>}
                    {plan.is_free && <Badge className="bg-success/20 text-success">Gratuito</Badge>}
                    {plan.is_free && plan.trial_days && (
                      <Badge className="bg-primary/20 text-primary">Teste por {plan.trial_days} dias</Badge>
                    )}
                    {plan.limits.storage_limit_mb && (
                      <Badge variant="outline" className="text-xs">
                        <HardDrive className="w-3 h-3 mr-1" />
                        {plan.limits.storage_limit_mb >= 1024 ? `${(plan.limits.storage_limit_mb / 1024).toFixed(0)} GB` : `${plan.limits.storage_limit_mb} MB`}
                      </Badge>
                    )}
                    <Badge variant="outline" className="text-xs">
                      <Users className="w-3 h-3 mr-1" />
                      {plan.limits.member_limit === -1 ? "Ilimitado" : `${plan.limits.member_limit ?? 1} membro${(plan.limits.member_limit ?? 1) !== 1 ? "s" : ""}`}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      <Contact className="w-3 h-3 mr-1" />
                      {plan.limits.contact_limit === -1 ? "Ilimitado" : `${(plan.limits.contact_limit ?? 500).toLocaleString("pt-BR")} contatos`}
                    </Badge>
                    {plan.limits.uz_forms_enabled && (
                      <>
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                          Formulários: {plan.limits.max_uz_forms === -1 ? "Ilimitados" : plan.limits.max_uz_forms}
                        </Badge>
                        <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                          Respostas: {plan.limits.max_uz_form_responses_monthly === -1 ? "Ilimitadas" : `${plan.limits.max_uz_form_responses_monthly}/mês`}
                        </Badge>
                      </>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      {plan.limits.features?.length || 0} funcionalidades
                    </p>
                    {plan.limits.features?.map((feature) => {
                      const info = ALL_FEATURES.find(f => f.key === feature);
                      return (
                        <div key={feature} className="flex items-center gap-1.5 text-sm text-muted-foreground">
                          <Check className="w-3 h-3 text-success flex-shrink-0" />
                          {info?.label || feature}
                        </div>
                      );
                    })}
                    {(!plan.limits.features || plan.limits.features.length === 0) && (
                      <p className="text-sm text-muted-foreground italic">Nenhuma funcionalidade</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
