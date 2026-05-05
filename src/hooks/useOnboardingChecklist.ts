import { useEffect, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useTutorialsEnabledForNewMembers } from "@/hooks/useTutorialsEnabledForNewMembers";

export type OnboardingStepKey =
  | "connect_whatsapp"
  | "configure_kanban"
  | "create_first_flow"
  | "invite_team"
  | "import_contacts";

export interface OnboardingRow {
  id: string;
  user_id: string;
  steps: Record<OnboardingStepKey, boolean>;
  dismissed_checklist: boolean;
  started_at: string | null;
  completed_at: string | null;
  skipped_at: string | null;
}

const DEFAULT_STEPS: Record<OnboardingStepKey, boolean> = {
  connect_whatsapp: false,
  configure_kanban: false,
  create_first_flow: false,
  invite_team: false,
  import_contacts: false,
};

/**
 * Hook que rastreia o progresso do checklist de onboarding.
 * Faz auto-detecção via 5 contagens agregadas e sincroniza com user_onboarding.steps.
 * Quando os 5 passos completam, marca completed_at automaticamente.
 */
export function useOnboardingChecklist() {
  const { user } = useAuth();
  const { data: organization } = useUserOrganization();
  const { enabled: tutorialsEnabled } = useTutorialsEnabledForNewMembers();
  const queryClient = useQueryClient();
  const lastSyncedRef = useRef<string>("");

  // 1. Carrega registro de onboarding
  const onboardingQuery = useQuery({
    queryKey: ["user-onboarding", user?.id],
    queryFn: async (): Promise<OnboardingRow | null> => {
      if (!user) return null;
      const { data } = await supabase
        .from("user_onboarding")
        .select("id, user_id, steps, dismissed_checklist, started_at, completed_at, skipped_at")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!data) return null;
      return {
        ...data,
        steps: { ...DEFAULT_STEPS, ...((data.steps as Record<string, boolean>) || {}) },
      } as OnboardingRow;
    },
    enabled: !!user,
  });

  // 2. Auto-detecção dos 5 passos
  const detectionQuery = useQuery({
    queryKey: ["onboarding-detection", organization?.id, user?.id],
    queryFn: async (): Promise<Record<OnboardingStepKey, boolean>> => {
      if (!user || !organization?.id) return DEFAULT_STEPS;

      const orgId = organization.id;
      const [instances, pipelines, flows, members, contacts] = await Promise.all([
        supabase
          .from("instances_safe" as any)
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .not("pipeline_stage_id", "is", null),
        supabase
          .from("flows")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
        supabase
          .from("team_members")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
        supabase
          .from("contacts")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId),
      ]);

      return {
        connect_whatsapp: (instances.count ?? 0) > 0,
        configure_kanban: (pipelines.count ?? 0) > 0,
        create_first_flow: (flows.count ?? 0) > 0,
        invite_team: (members.count ?? 0) > 1,
        import_contacts: (contacts.count ?? 0) >= 5,
      };
    },
    enabled: !!user && !!organization?.id,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  // 3. Mutation para atualizar steps (sync com banco)
  const updateMutation = useMutation({
    mutationFn: async (patch: Partial<OnboardingRow>) => {
      if (!onboardingQuery.data?.id) return;
      const { error } = await supabase
        .from("user_onboarding")
        .update(patch as never)
        .eq("id", onboardingQuery.data.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-onboarding"] });
    },
  });

  // 4. Sincroniza detecção -> banco quando mudar
  const detected = detectionQuery.data;
  const persisted = onboardingQuery.data?.steps;

  useEffect(() => {
    if (!detected || !persisted || !onboardingQuery.data) return;
    if (onboardingQuery.data.completed_at || onboardingQuery.data.skipped_at) return;

    // Mescla: passo fica true se detectado OU já estava manualmente marcado
    const merged: Record<OnboardingStepKey, boolean> = {
      connect_whatsapp: detected.connect_whatsapp || persisted.connect_whatsapp,
      configure_kanban: detected.configure_kanban || persisted.configure_kanban,
      create_first_flow: detected.create_first_flow || persisted.create_first_flow,
      invite_team: detected.invite_team || persisted.invite_team,
      import_contacts: detected.import_contacts || persisted.import_contacts,
    };

    const sig = JSON.stringify(merged);
    if (sig === JSON.stringify(persisted)) return;
    if (sig === lastSyncedRef.current) return;
    lastSyncedRef.current = sig;

    const allDone = Object.values(merged).every(Boolean);
    updateMutation.mutate({
      steps: merged,
      ...(allDone ? { completed_at: new Date().toISOString() } : {}),
    } as Partial<OnboardingRow>);
  }, [detected, persisted, onboardingQuery.data, updateMutation]);

  const steps = persisted ?? DEFAULT_STEPS;
  const completedCount = useMemo(
    () => Object.values(steps).filter(Boolean).length,
    [steps]
  );

  const isVisible = useMemo(() => {
    if (!tutorialsEnabled) return false;
    const o = onboardingQuery.data;
    if (!o) return false;
    if (o.completed_at) return false;
    if (o.skipped_at) return false;
    if (o.dismissed_checklist) return false;
    return true;
  }, [onboardingQuery.data, tutorialsEnabled]);

  // Modal de boas-vindas: aparece se started_at < 5 min atrás e nada foi marcado ainda
  const shouldShowWelcome = useMemo(() => {
    if (!tutorialsEnabled) return false;
    const o = onboardingQuery.data;
    if (!o || !o.started_at) return false;
    if (o.completed_at || o.skipped_at || o.dismissed_checklist) return false;
    const ageMs = Date.now() - new Date(o.started_at).getTime();
    if (ageMs > 5 * 60_000) return false; // mais de 5 min => não é primeira visita
    return completedCount === 0;
  }, [onboardingQuery.data, completedCount, tutorialsEnabled]);

  return {
    isLoading: onboardingQuery.isLoading,
    onboarding: onboardingQuery.data,
    steps,
    completedCount,
    totalSteps: 5,
    isVisible,
    shouldShowWelcome,
    dismiss: () => updateMutation.mutate({ dismissed_checklist: true } as Partial<OnboardingRow>),
    skip: () => updateMutation.mutate({ skipped_at: new Date().toISOString() } as Partial<OnboardingRow>),
    markComplete: () =>
      updateMutation.mutate({ completed_at: new Date().toISOString() } as Partial<OnboardingRow>),
    setStep: (key: OnboardingStepKey, value: boolean) => {
      const newSteps = { ...steps, [key]: value };
      updateMutation.mutate({ steps: newSteps } as Partial<OnboardingRow>);
    },
  };
}
