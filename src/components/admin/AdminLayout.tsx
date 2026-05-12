import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { 
  LayoutDashboard, 
  Users, 
  FileText, 
  Settings,
  LogOut,
  Zap,
  ChevronLeft,
  Menu,
  Tag,
  X,
  GraduationCap,
  Receipt,
  Handshake,
  BellRing,
  UserCog
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminNotificationBell } from "./AdminNotificationBell";
import { AdminProfileDialog } from "./AdminProfileDialog";
import { BrandLogo } from "@/components/branding/BrandLogo";

interface AdminLayoutProps {
  children: ReactNode;
}

const menuItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/admin" },
  { title: "Clientes", icon: Users, path: "/admin/organizations" },
  { title: "Planos", icon: FileText, path: "/admin/plans" },
  { title: "Cupons", icon: Tag, path: "/admin/coupons" },
  { title: "Tutoriais", icon: GraduationCap, path: "/admin/tutorials" },
  { title: "Cobranças", icon: Receipt, path: "/admin/billing" },
  { title: "Afiliados", icon: Handshake, path: "/admin/affiliates" },
  { title: "Notificações", icon: BellRing, path: "/admin/notifications" },
  { title: "Configurações", icon: Settings, path: "/admin/settings" },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signOut } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (user) {
      checkAdminAccess();
    }
  }, [user]);

  const checkAdminAccess = async () => {
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin_master",
    });

    if (error || !data) {
      console.error("Access denied or error:", error);
      navigate("/");
      return;
    }

    setIsAdmin(true);
  };

  const handleSignOut = async () => {
    await signOut();
  };

  if (isAdmin === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar - Desktop */}
      <aside
        className={cn(
          "hidden md:flex flex-col quantum-glass-strong border-r border-sidebar-border transition-all duration-300",
          sidebarOpen ? "w-64" : "w-16"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-sidebar-border">
          {sidebarOpen && (
            <Link to="/admin" className="flex items-center gap-2">
              <BrandLogo alt="Admin" className="w-8 h-8 object-contain" />
              <div className="flex flex-col">
                <span className="text-lg font-bold text-sidebar-foreground leading-tight">Admin</span>
                <span className={`text-xs font-mono leading-none ${window.location.hostname.includes('id-preview--') || window.location.hostname.includes('localhost') ? 'text-warning' : 'text-success'}`}>
                  {window.location.hostname.includes('id-preview--') || window.location.hostname.includes('localhost') ? '● DEV' : '● PROD'}
                </span>
              </div>
            </Link>
          )}
          <div className="flex items-center gap-1">
            {sidebarOpen && <AdminNotificationBell />}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <ChevronLeft className={cn("w-4 h-4 transition-transform", !sidebarOpen && "rotate-180")} />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg transition-colors",
                   isActive
                    ? "gradient-primary text-sidebar-primary-foreground neon-glow-pink"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground nav-item-neon"
                )}
              >
                <item.icon className="w-5 h-5 flex-shrink-0" />
                {sidebarOpen && <span>{item.title}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={() => setProfileOpen(true)}
            className={cn(
              "w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground mb-2",
              !sidebarOpen && "justify-center"
            )}
          >
            <UserCog className="w-5 h-5" />
            {sidebarOpen && <span className="ml-2">Meu perfil</span>}
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className={cn(
              "w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground mb-2",
              !sidebarOpen && "justify-center"
            )}
          >
            <ChevronLeft className="w-5 h-5" />
            {sidebarOpen && <span className="ml-2">Voltar ao App</span>}
          </Button>
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn(
              "w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground",
              !sidebarOpen && "justify-center"
            )}
          >
            <LogOut className="w-5 h-5" />
            {sidebarOpen && <span className="ml-2">Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-sidebar border-b border-sidebar-border z-50 flex items-center justify-between px-4">
        <Link to="/admin" className="flex items-center gap-2">
          <BrandLogo alt="Admin" className="w-8 h-8 object-contain" />
          <div className="flex flex-col">
            <span className="text-lg font-bold text-sidebar-foreground leading-tight">Admin</span>
            <span className={`text-xs font-mono leading-none ${window.location.hostname.includes('id-preview--') || window.location.hostname.includes('localhost') ? 'text-warning' : 'text-success'}`}>
              {window.location.hostname.includes('id-preview--') || window.location.hostname.includes('localhost') ? '● DEV' : '● PROD'}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-1">
          <AdminNotificationBell />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setProfileOpen(true)}
            className="text-sidebar-foreground"
            aria-label="Meu perfil"
          >
            <UserCog className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-sidebar-foreground"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 top-16 quantum-glass-strong z-40 p-4">
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-lg transition-colors",
                     isActive
                      ? "gradient-primary text-sidebar-primary-foreground neon-glow-pink"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground nav-item-neon"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.title}</span>
                </Link>
              );
            })}
          </nav>
          <div className="mt-6 pt-6 border-t border-sidebar-border space-y-2">
            <Button
              variant="ghost"
              onClick={() => navigate("/")}
              className="w-full justify-start text-sidebar-foreground/70"
            >
              <ChevronLeft className="w-5 h-5 mr-2" />
              Voltar ao App
            </Button>
            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full justify-start text-sidebar-foreground/70"
            >
              <LogOut className="w-5 h-5 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <div className="p-6 md:p-8 pt-20 md:pt-8">
          {children}
        </div>
      </main>

      <AdminProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </div>
  );
}
