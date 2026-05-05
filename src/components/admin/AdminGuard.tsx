import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";

interface AdminGuardProps {
  children: React.ReactNode;
}

export function AdminGuard({ children }: AdminGuardProps) {
  const { user, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin_master" })
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(!!data);
      });

    return () => { cancelled = true; };
  }, [user]);

  if (loading || (user && isAdmin === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!user || isAdmin === false) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
