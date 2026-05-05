import { ReactNode, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { UpgradeBanner } from "@/components/UpgradeBanner";
import { TrialExpiringBanner } from "@/components/TrialExpiringBanner";
import { LiaFab } from "@/components/lia/LiaFab";
import { ForcePasswordChangeDialog } from "./ForcePasswordChangeDialog";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";

interface AppLayoutProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

export function AppLayout({ children, title, description }: AppLayoutProps) {
  const { user } = useAuth();
  const { data: organization } = useUserOrganization();
  const [dismissed, setDismissed] = useState(false);

  const { data: forceChange, refetch } = useQuery({
    queryKey: ["force-password-change", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("force_password_change")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data?.force_password_change === true;
    },
    enabled: !!user?.id,
  });

  // Heartbeat: atualiza last_seen_at do team_member a cada 60s
  useEffect(() => {
    if (!user?.id || !organization?.id) return;

    let memberId: string | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const ping = async () => {
      if (!memberId) return;
      await supabase.rpc("update_member_last_seen" as any, { _member_id: memberId });
    };

    (async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!data?.id) return;
      memberId = data.id;
      ping();
      interval = setInterval(ping, 60 * 1000);
    })();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [user?.id, organization?.id]);

  const showForceChange = forceChange === true && !dismissed;

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <TrialExpiringBanner />
          <UpgradeBanner />
          <header className="flex min-h-[3.5rem] shrink-0 items-center gap-2 header-quantum px-3 sm:px-6 py-2">
            <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground shrink-0" />
            {title && (
              <div className="ml-2 min-w-0">
                <h1 className="text-sm sm:text-lg font-semibold text-foreground leading-tight">{title}</h1>
                {description && (
                  <p className="text-xs sm:text-sm text-muted-foreground leading-snug mt-0.5">{description}</p>
                )}
              </div>
            )}
          </header>
          <main className="flex-1 p-3 sm:p-6 bg-background min-w-0 overflow-x-hidden">{children}</main>
        </SidebarInset>
      </div>
      <LiaFab />
      {showForceChange && (
        <ForcePasswordChangeDialog
          open={true}
          onComplete={() => { setDismissed(true); refetch(); }}
        />
      )}
    </SidebarProvider>
  );
}
