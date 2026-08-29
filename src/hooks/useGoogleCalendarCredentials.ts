import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "./useUserOrganization";
import { toast } from "sonner";

interface CredentialStatus {
  configured: boolean;
  client_id_masked?: string;
  updated_at?: string;
}

export function useGoogleCalendarCredentials() {
  const { data: org } = useUserOrganization();
  const [status, setStatus] = useState<CredentialStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchStatus = async () => {
    if (!org?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("manage-google-calendar-credentials", {
        body: { action: "get", organization_id: org.id },
      });
      if (error) throw error;
      setStatus(data);
    } catch {
      setStatus({ configured: false });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, [org?.id]);

  const saveCredentials = async (clientId: string, clientSecret: string) => {
    if (!org?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase.functions.invoke("manage-google-calendar-credentials", {
        body: { action: "save", organization_id: org.id, client_id: clientId, client_secret: clientSecret },
      });
      if (error) throw error;
      toast.success("Credenciais salvas com sucesso");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar credenciais");
    } finally {
      setSaving(false);
    }
  };

  const deleteCredentials = async () => {
    if (!org?.id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.functions.invoke("manage-google-calendar-credentials", {
        body: { action: "delete", organization_id: org.id },
      });
      if (error) throw error;
      toast.success("Credenciais removidas");
      await fetchStatus();
    } catch (err: any) {
      toast.error(err.message || "Erro ao remover credenciais");
    } finally {
      setDeleting(false);
    }
  };

  return { status, loading, saving, deleting, saveCredentials, deleteCredentials, refetch: fetchStatus };
}
