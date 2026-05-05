import { Navigate } from "react-router-dom";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface PermissionGuardProps {
  menu: string;
  action?: string; // default "view"
  fallback?: string; // path to redirect when denied
  children: React.ReactNode;
}

/**
 * Bloqueia o acesso a uma rota inteira quando o membro da equipe
 * não tem a permissão `menu.action`. Owners e admin_master sempre passam.
 */
export function PermissionGuard({
  menu,
  action = "view",
  fallback = "/dashboard",
  children,
}: PermissionGuardProps) {
  const { can, isLoading, isOwner } = useUserPermissions();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (isOwner || can(menu, action)) return <>{children}</>;
  return <Navigate to={fallback} replace />;
}
