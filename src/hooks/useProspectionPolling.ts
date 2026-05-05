import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

// Timeout para sessões órfãs (10 minutos)
const STALE_SESSION_TIMEOUT_MS = 10 * 60 * 1000;

interface Lead {
  business_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  social_urls: Record<string, string>;
  has_whatsapp: boolean;
  ai_score: number;
  ai_analysis?: { summary?: string };
  source_url: string;
}

interface SearchStatus {
  status: "pending" | "running" | "completed" | "failed" | "stopped";
  total_found: number;
  current_phase: string;
  progress_percent: number;
  leads: Lead[];
  error_message?: string | null;
  metrics?: {
    pages_processed?: number;
    additional_scrapes?: number;
    duplicates_removed?: number;
    search_depth?: string;
    requests_made?: number;
    tiles_total?: number;
    tiles_processed?: number;
  };
}

interface PollingOptions {
  functionName?: "gmaps-visual-scraper" | "google-places-search";
  autoStep?: boolean;
}

export function useProspectionPolling() {
  const [searchId, setSearchId] = useState<string | null>(null);
  const [status, setStatus] = useState<SearchStatus | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const steppingRef = useRef(false);
  const optionsRef = useRef<PollingOptions>({ functionName: "gmaps-visual-scraper", autoStep: false });
  // Ref para rastrear sessão ativa - evita cleanup prematuro em re-renders
  const activeSessionRef = useRef<string | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    steppingRef.current = false;
    setIsPolling(false);
  }, []);

  // Envia notificação de stop para o backend (fire-and-forget)
  const notifyBackendStop = useCallback((sessionId: string) => {
    const { functionName } = optionsRef.current;
    console.log("[polling] Notifying backend to stop session:", sessionId);
    supabase.functions.invoke(functionName!, {
      body: { action: "stop", session_id: sessionId },
    }).catch((err) => {
      console.warn("[polling] Failed to notify backend stop:", err);
    });
  }, []);

  const fetchStatus = useCallback(async (id: string) => {
    try {
      const { functionName } = optionsRef.current;
      const { data, error } = await supabase.functions.invoke(functionName!, {
        body: { action: "status", session_id: id },
      });

      if (error) {
        console.error("[polling] Error fetching status:", error);
        return null;
      }

      if (data?.success) {
        const session = data.session;
        const leads = data.leads || [];
        
        return {
          status: session?.status || "pending",
          total_found: session?.total_found || leads.length || 0,
          current_phase: session?.current_phase || "processing",
          progress_percent: session?.progress_percent || 0,
          error_message: session?.error_message || null,
          leads: leads.map((l: Record<string, unknown>) => ({
            business_name: l.business_name as string,
            phone: l.phone as string | null,
            email: l.email as string | null,
            website: l.website as string | null,
            address: l.address as string | null,
            social_urls: (l.social_urls as Record<string, string>) || {},
            has_whatsapp: l.has_whatsapp as boolean || false,
            ai_score: l.ai_score as number || 50,
            ai_analysis: l.ai_analysis as { summary?: string } | undefined,
            source_url: l.source_url as string || "",
          })),
          metrics: session?.metrics,
        } as SearchStatus;
      }
      return null;
    } catch (err) {
      console.error("[polling] Fetch error:", err);
      return null;
    }
  }, []);

  const executeStep = useCallback(async (id: string): Promise<boolean> => {
    if (steppingRef.current) return false;
    
    steppingRef.current = true;
    try {
      const { functionName } = optionsRef.current;
      const { data, error } = await supabase.functions.invoke(functionName!, {
        body: { action: "step", session_id: id },
      });

      if (error) {
        console.error("[polling] Step error:", error);
        return false;
      }

      if (data?.done) {
        return true; // Signal completion
      }

      if (data?.rate_limited) {
        // Wait a bit before next step
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      return false;
    } catch (err) {
      console.error("[polling] Step execution error:", err);
      return false;
    } finally {
      steppingRef.current = false;
    }
  }, []);

  const startPolling = useCallback((id: string, options?: PollingOptions) => {
    setSearchId(id);
    setIsPolling(true);
    setElapsedTime(0);
    startTimeRef.current = Date.now();
    activeSessionRef.current = id; // Atualizar ref da sessão ativa
    optionsRef.current = {
      functionName: options?.functionName || "gmaps-visual-scraper",
      autoStep: options?.autoStep || false,
    };

    // Start timer
    timerRef.current = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }
    }, 1000);

    // Start polling/stepping loop
    const pollAndStep = async () => {
      const newStatus = await fetchStatus(id);
      if (newStatus) {
        setStatus(newStatus);

        // Stop polling on completion or failure
        if (["completed", "failed", "stopped"].includes(newStatus.status)) {
          stopPolling();
          return;
        }

        // If autoStep is enabled, execute a step
        if (optionsRef.current.autoStep && newStatus.status === "running") {
          const done = await executeStep(id);
          if (done) {
            // Fetch final status
            const finalStatus = await fetchStatus(id);
            if (finalStatus) {
              setStatus(finalStatus);
            }
            stopPolling();
            return;
          }
        }
      }
    };

    // Immediate first fetch + step
    pollAndStep();

    // Set up interval - for Places API with autoStep, use faster interval
    const pollInterval = optionsRef.current.autoStep ? 1500 : 3000;
    intervalRef.current = setInterval(pollAndStep, pollInterval);
  }, [fetchStatus, executeStep, stopPolling]);

  const stopSearch = useCallback(async () => {
    if (!searchId) return;

    try {
      const { functionName } = optionsRef.current;
      const { data } = await supabase.functions.invoke(functionName!, {
        body: { action: "stop", session_id: searchId },
      });

      if (data?.success) {
        // Fetch final status
        const finalStatus = await fetchStatus(searchId);
        if (finalStatus) {
          setStatus(finalStatus);
        }
      }
    } catch (err) {
      console.error("[polling] Stop error:", err);
    }

    stopPolling();
  }, [searchId, stopPolling, fetchStatus]);

  const reset = useCallback(() => {
    stopPolling();
    setSearchId(null);
    setStatus(null);
    setElapsedTime(0);
    startTimeRef.current = null;
    activeSessionRef.current = null; // Limpar ref ao resetar
    optionsRef.current = { functionName: "gmaps-visual-scraper", autoStep: false };
  }, [stopPolling]);

  // Cleanup on unmount - usa ref para evitar re-execução a cada mudança de estado
  useEffect(() => {
    return () => {
      // Só notifica backend no unmount real (não em re-renders)
      if (activeSessionRef.current) {
        const { functionName } = optionsRef.current;
        const sessionToStop = activeSessionRef.current;
        console.log("[polling] Component unmounting with active search, notifying backend:", sessionToStop);
        supabase.functions.invoke(functionName!, {
          body: { action: "stop", session_id: sessionToStop },
        }).catch(() => {});
        activeSessionRef.current = null;
      }
      stopPolling();
    };
  }, [stopPolling]); // Apenas stopPolling como dependência - executa só no unmount real

  // Listener para fechamento de aba/navegação
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (searchId && isPolling) {
        const { functionName } = optionsRef.current;
        const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${functionName}`;
        
        // Usar sendBeacon para garantir envio mesmo durante fechamento
        const payload = JSON.stringify({ action: "stop", session_id: searchId });
        const blob = new Blob([payload], { type: "application/json" });
        
        console.log("[polling] beforeunload - sending stop via beacon");
        navigator.sendBeacon(url, blob);
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [searchId, isPolling]);

  return {
    searchId,
    status,
    isPolling,
    elapsedTime,
    startPolling,
    stopPolling,
    stopSearch,
    reset,
    notifyBackendStop,
  };
}
