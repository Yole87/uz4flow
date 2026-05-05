import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Lê a flag global `new_member_tutorials_enabled` do registro
 * `saas_settings.key = 'general'`. Default: true (ligado).
 *
 * Quando `false`, o sistema NÃO mostra:
 *  - modal de boas-vindas
 *  - checklist de onboarding no Dashboard
 *  - tour guiado da LIA para novos usuários
 */
export function useTutorialsEnabledForNewMembers() {
  const query = useQuery({
    queryKey: ["saas-settings", "general", "new_member_tutorials_enabled"],
    queryFn: async (): Promise<boolean> => {
      const { data } = await supabase
        .from("saas_settings")
        .select("value")
        .eq("key", "general")
        .maybeSingle();
      const value = (data?.value as Record<string, unknown> | null) ?? null;
      const flag = value?.new_member_tutorials_enabled;
      // default ligado quando ainda não foi configurado
      if (flag === undefined || flag === null) return true;
      return Boolean(flag);
    },
    staleTime: 5 * 60_000,
  });

  return {
    enabled: query.data ?? true,
    isLoading: query.isLoading,
  };
}
