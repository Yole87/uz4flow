import { useEffect, useRef, useCallback, type MutableRefObject } from "react";
import { useAuth } from "@/lib/auth";
import { useLia } from "@/components/lia/LiaProvider";
import { supabase } from "@/integrations/supabase/client";
import { useTutorialsEnabledForNewMembers } from "@/hooks/useTutorialsEnabledForNewMembers";
import type { GuidedStep } from "@/components/lia/LiaProvider";

// Mantemos os seletores alinhados aos data-sidebar-item REAIS do menu
// (ver src/components/layout/AppSidebar.tsx). Itens removidos da sidebar
// não devem aparecer aqui — caso contrário o tour "trava" sem alvo.
const ONBOARDING_STEPS: GuidedStep[] = [
  { route: "/dashboard", selector: '[data-sidebar-item="dashboard"]', title: "Dashboard", description: "Aqui você vê as métricas do seu negócio em tempo real. Acompanhe mensagens, atendimentos e performance." },
  { route: "/dashboard", selector: '[data-sidebar-item="crm"]', title: "CRM", description: "Central de atendimento WhatsApp. Gerencie todas as conversas com seus clientes em um só lugar." },
  { route: "/dashboard", selector: '[data-sidebar-item="kanban"]', title: "Funil Kanban", description: "Funil de vendas visual estilo Kanban. Arraste e organize seus leads por etapas." },
  { route: "/dashboard", selector: '[data-sidebar-item="prospection"]', title: "Prospecção", description: "Busca automática de novos clientes. Encontre leads qualificados com inteligência artificial." },
  { route: "/dashboard", selector: '[data-sidebar-item="voice-ai"]', title: "Voice AI", description: "Campanhas de voz com agentes de IA. Automatize ligações e follow-ups por voz." },
  { route: "/dashboard", selector: '[data-sidebar-item="mcp-gateway"]', title: "MCP Gateway", description: "Conecte ferramentas externas ao seu fluxo de trabalho. Google Drive, calendários e muito mais." },
  { route: "/dashboard", selector: '[data-sidebar-item="automation"]', title: "Automação", description: "Conectores, fluxos e regras de automação. Configure respostas automáticas e integrações." },
  { route: "/dashboard", selector: '[data-sidebar-item="settings"]', title: "Configurações", description: "Configure suas integrações, instâncias WhatsApp, equipe e preferências do sistema." },
  { route: "/dashboard", selector: '[data-sidebar-item="tutorials"]', title: "Tutoriais", description: "Vídeos tutoriais para aprender tudo sobre a plataforma. Do básico ao avançado!" },
];

export function useOnboardingTour() {
  const { user } = useAuth();
  const { enabled: tutorialsEnabled } = useTutorialsEnabledForNewMembers();
  const { setIsOpen, setGuidedSteps, guidedSteps, currentGuidedIndex, setCurrentGuidedIndex, onGuidedComplete, setOnGuidedComplete } = useLia();
  const onboardingIdRef = useRef<string | null>(null);
  const checkedRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  // Persist completion/skip
  const persistStatus = useCallback(async (field: "completed_at" | "skipped_at") => {
    if (!onboardingIdRef.current) return;
    await supabase
      .from("user_onboarding")
      .update({ [field]: new Date().toISOString() })
      .eq("id", onboardingIdRef.current);
  }, []);

  // Set up callbacks for guided overlay
  useEffect(() => {
    setOnGuidedComplete({
      onComplete: () => persistStatus("completed_at"),
      onSkip: () => persistStatus("skipped_at"),
    });
    return () => setOnGuidedComplete(null);
  }, [persistStatus, setOnGuidedComplete]);

  // Check onboarding status on mount
  useEffect(() => {
    if (!user || checkedRef.current) return;
    if (!tutorialsEnabled) return; // toggle global desligado
    checkedRef.current = true;

    const checkOnboarding = async () => {
      const { data: existing } = await supabase
        .from("user_onboarding")
        .select("id, completed_at, skipped_at, dismissed_checklist, steps")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        // Já completou ou pulou — não mostrar tour
        if (existing.completed_at || existing.skipped_at) return;
        // Há checklist ativo no Dashboard — não duplicar com tour LIA
        // (usuário foca no checklist; pode disparar tour manualmente depois)
        if (!existing.dismissed_checklist) return;
        onboardingIdRef.current = existing.id;
      } else {
        // Primeira vez: cria registro mas NÃO dispara tour automático
        // (Dashboard mostrará welcome modal + checklist via OnboardingSection)
        const { data: inserted } = await supabase
          .from("user_onboarding")
          .insert({ user_id: user.id })
          .select("id")
          .single();
        if (inserted) onboardingIdRef.current = inserted.id;
        return; // não inicia tour automaticamente para users novos
      }

      // Para users antigos (que dispensaram o checklist sem completar): tour LIA
      timerRef.current = setTimeout(() => {
        setGuidedSteps(ONBOARDING_STEPS);
        setCurrentGuidedIndex(0);
        setIsOpen(false);
      }, 2000);
    };

    checkOnboarding();

    return () => clearTimeout(timerRef.current);
  }, [user, tutorialsEnabled, setGuidedSteps, setCurrentGuidedIndex, setIsOpen]);
}
