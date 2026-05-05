import { ReactNode } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface CanProps {
  menu: string;
  action: string;
  fallback?: ReactNode;
  children: ReactNode;
}

/**
 * Envelopa qualquer UI sensível e oculta se o usuário não tem permissão.
 * Ex: <Can menu="crm.contacts" action="export"><Button>Exportar</Button></Can>
 *
 * `menu` aceita formato "parent.child" → será dividido automaticamente.
 */
export function Can({ menu, action, fallback = null, children }: CanProps) {
  const { can, isLoading, isOwner } = useUserPermissions();
  // Owners não devem sofrer flicker durante loading
  if (isLoading) return isOwner ? <>{children}</> : null;

  let resolvedMenu = menu;
  let resolvedAction = action;
  if (menu.includes(".")) {
    const [parent, child] = menu.split(".");
    resolvedMenu = parent;
    resolvedAction = `${child}.${action}`;
  }

  return can(resolvedMenu, resolvedAction) ? <>{children}</> : <>{fallback}</>;
}
