import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CRMLayout } from "@/components/crm/CRMLayout";
import { LimitAlert } from "@/components/LimitAlert";
import { toast } from "sonner";

export default function CRM() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();

  useEffect(() => {
    const oauthStatus = searchParams.get("oauth_status");
    if (oauthStatus === "success") {
      toast.success("Google Calendar conectado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["google-calendar-connection"] });
      queryClient.invalidateQueries({ queryKey: ["mcp-connections"] });
      searchParams.delete("oauth_status");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  return (
    <>
      <LimitAlert feature="crm_whatsapp" />
      <CRMLayout />
    </>
  );
}
