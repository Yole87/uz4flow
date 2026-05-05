import { useCallback } from "react";
import { useOrganizationSubscription } from "./useOrganizationSubscription";

export interface PlanFeatures {
  features: string[];
}

export const ALL_FEATURES = [
  { key: "crm_whatsapp", label: "CRM WhatsApp", description: "CRM completo com Funil Kanban, Templates, Reengajamento e Follow-up WhatsApp", category: "CRM (WhatsApp)" },
  { key: "pipeline", label: "Funil Kanban", description: "Gestão visual de leads com quadro Kanban e dashboard de funil", category: "CRM (WhatsApp)" },
  { key: "followup", label: "Follow-up WhatsApp", description: "Campanhas de follow-up e reengajamento automatizado via WhatsApp", category: "CRM (WhatsApp)" },
  { key: "automations", label: "Fluxos e Conectores", description: "Fluxos de automação, conectores webhook e regras de roteamento", category: "Automação" },
  { key: "prospection", label: "Extrator de Contatos", description: "Busca automatizada de leads via Google Places e outros provedores", category: "Extrator" },
  { key: "ai_features", label: "Campanhas e Ligações IA", description: "Ligações IA, campanhas de voz e análise inteligente de conversas", category: "Recursos de IA" },
  { key: "analytics", label: "Analytics e Relatórios", description: "Dashboard com métricas de desempenho e relatórios avançados", category: "Extras" },
  { key: "api_access", label: "Acesso API", description: "Integração programática via API REST e webhooks", category: "Extras" },
  { key: "mcp_gateway", label: "MCP Gateway", description: "Hub de conexões MCP com provedores externos como Google Drive", category: "Extras" },
  { key: "whitelabel", label: "White Label", description: "Remoção da marca do sistema para uso com sua própria identidade", category: "Extras" },
  { key: "basic_support", label: "Suporte Básico", description: "Atendimento via e-mail e central de ajuda", category: "Suporte" },
  { key: "priority_support", label: "Suporte Prioritário", description: "Atendimento preferencial com tempo de resposta reduzido", category: "Suporte" },
  { key: "dedicated_support", label: "Suporte Dedicado", description: "Suporte exclusivo com SLA garantido e gerente de conta", category: "Suporte" },
] as const;

interface OrganizationLimitsState {
  features: string[];
  storageLimitMB: number;
  memberLimit: number;
  contactLimit: number;
  loading: boolean;
  hasFeature: (feature: string) => boolean;
  refetch: () => Promise<void>;
}

export function useOrganizationLimits(): OrganizationLimitsState {
  const { features, storageLimitMB, memberLimit, contactLimit, loading, refetch } = useOrganizationSubscription();

  const hasFeature = useCallback(
    (feature: string): boolean => features.includes(feature),
    [features]
  );

  return {
    features,
    storageLimitMB,
    memberLimit,
    contactLimit,
    loading,
    hasFeature,
    refetch,
  };
}
