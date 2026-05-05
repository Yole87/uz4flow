import { useState, useCallback, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";

const STORAGE_KEY = "impersonatedOrgId";
const STORAGE_NAME_KEY = "impersonatedOrgName";

// External store for cross-component reactivity (same-tab AND cross-tab).
const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab: react to sessionStorage changes from other tabs/windows.
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === STORAGE_NAME_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
function getSnapshot() {
  return sessionStorage.getItem(STORAGE_KEY);
}
function getNameSnapshot() {
  return sessionStorage.getItem(STORAGE_NAME_KEY);
}
function notify() {
  listeners.forEach((cb) => cb());
}

// Public hook for other modules (e.g. useUserOrganization) to subscribe to
// impersonation changes without importing the React hook.
export function subscribeImpersonationChanges(cb: () => void) {
  return subscribe(cb);
}

export function getImpersonatedOrgId(): string | null {
  return sessionStorage.getItem(STORAGE_KEY);
}

export function useImpersonation() {
  const queryClient = useQueryClient();
  const orgId = useSyncExternalStore(subscribe, getSnapshot, () => null);
  const orgName = useSyncExternalStore(subscribe, getNameSnapshot, () => null);

  const startImpersonation = useCallback(
    async (targetOrgId: string, targetOrgName: string) => {
      sessionStorage.setItem(STORAGE_KEY, targetOrgId);
      sessionStorage.setItem(STORAGE_NAME_KEY, targetOrgName);
      notify();

      // Audit log
      try {
        const { supabase } = await import("@/integrations/supabase/client");
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("admin_audit_logs").insert({
            actor_user_id: user.id,
            action: "start_impersonation",
            target_type: "organization",
            target_id: targetOrgId,
            metadata: { org_name: targetOrgName },
          });
        }
      } catch {}

      // Invalidate all org-related queries so they refetch with new context
      queryClient.invalidateQueries({ queryKey: ["organization-status"] });
      queryClient.invalidateQueries({ queryKey: ["user-organization"] });
    },
    [queryClient]
  );

  const stopImpersonation = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_NAME_KEY);
    notify();
    queryClient.invalidateQueries({ queryKey: ["organization-status"] });
    queryClient.invalidateQueries({ queryKey: ["user-organization"] });
  }, [queryClient]);

  return {
    isImpersonating: !!orgId,
    impersonatedOrgId: orgId,
    impersonatedOrgName: orgName,
    startImpersonation,
    stopImpersonation,
  };
}
