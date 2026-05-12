import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { 
  LayoutDashboard, 
  GitBranch, 
  Route, 
  History, 
  Settings, 
  LogOut,
  Zap,
  Plug,
  FileText,
  Sparkles,
  MessageSquare,
  Kanban,
  UserSearch,
  ChevronDown,
  ChevronRight,
  Bot,
  BookOpen,
  Phone,
  PhoneForwarded,
  GraduationCap,
  Server,
  Instagram,
  Users,
  UserCog,
  Activity,
  Handshake,
  BarChart3
} from "lucide-react";
  import { Link, useLocation, useNavigate } from "react-router-dom";
 import { useAuth } from "@/lib/auth";
 import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
 import { useUserPermissions } from "@/hooks/useUserPermissions";
 import {
   Sidebar,
   SidebarContent,
   SidebarFooter,
   SidebarGroup,
   SidebarGroupContent,
   SidebarGroupLabel,
   SidebarHeader,
   SidebarMenu,
   SidebarMenuButton,
   SidebarMenuItem,
   SidebarMenuSub,
   SidebarMenuSubItem,
   SidebarMenuSubButton,
 } from "@/components/ui/sidebar";
 import { Button } from "@/components/ui/button";
 import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { UserProfileDialog } from "./UserProfileDialog";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { useBrandingAppName } from "@/hooks/useBranding";
import { useAffiliateSettings } from "@/hooks/useAffiliate";
import { useIsAffiliateOnly } from "@/hooks/useIsAffiliateOnly";

  const mainItems = [
   { title: "Dashboard", icon: LayoutDashboard, path: "/dashboard", dataId: "dashboard", permKey: "dashboard" },
   { title: "Voice AI", icon: Phone, path: "/voice", dataId: "voice-ai", permKey: "voice" },
   { title: "Prospecção", icon: UserSearch, path: "/prospection", dataId: "prospection", permKey: "prospection" },
   { title: "MCP Gateway", icon: Server, path: "/mcp-gateway", dataId: "mcp-gateway", disabled: true, badge: "Em breve", permKey: "mcp_gateway" },
   { title: "Instagram", icon: Instagram, path: "/instagram", dataId: "instagram", permKey: "instagram" },
];

 const crmItems = [
   { title: "Funil Kanban", icon: Kanban, path: "/kanban", permKey: "kanban" },
   { title: "Fila de Atendimento", icon: Activity, path: "/queue", permKey: "team" },
   { title: "Equipe", icon: Users, path: "/team", permKey: "team" },
 ];

 const crmPaths = ["/crm", ...crmItems.map(item => item.path.split("?")[0])];
 
 const automationItems = [
   { title: "Conectores", icon: Plug, path: "/connectors" },
   { title: "Fluxos", icon: GitBranch, path: "/flows" },
   { title: "Regras", icon: Route, path: "/rules" },
   { title: "Templates", icon: FileText, path: "/templates" },
   { title: "Histórico", icon: History, path: "/history" },
 ];
 
 const automationPaths = automationItems.map(item => item.path);

export function AppSidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut, user } = useAuth();
  const { plan, loading: planLoading } = useOrganizationSubscription();
  const { can, isOwner, isLoading: permsLoading } = useUserPermissions();
  const { data: affSettings } = useAffiliateSettings();
  const affiliateProgramEnabled = affSettings?.program_enabled !== false;
  const { isAffiliateOnly } = useIsAffiliateOnly();
  const appName = useBrandingAppName();

  // Helper: dono ou enquanto carrega → mostra tudo (evita flash de menus ocultos)
  // Mas se for afiliado puro (sem organização), oculta tudo do app.
  const showMenu = (key: string) => !isAffiliateOnly && (isOwner || permsLoading || can(key, "view"));

  // Fetch user profile name
  const { data: userProfile } = useQuery({
    queryKey: ["user-profile-sidebar", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name").eq("user_id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user?.id,
  });

  const isFreePlan = !planLoading && plan?.is_free === true;
   
   // Check if current route is within CRM section
   const isCrmRoute = crmPaths.some(path => location.pathname === path);

   // State for CRM collapsible
   const [crmOpen, setCrmOpen] = useState(() => {
     const saved = localStorage.getItem("sidebar:crm-open");
     if (saved !== null) return saved === "true";
     return isCrmRoute;
   });

   useEffect(() => {
     if (isCrmRoute && !crmOpen) setCrmOpen(true);
   }, [isCrmRoute]);

   useEffect(() => {
     localStorage.setItem("sidebar:crm-open", String(crmOpen));
   }, [crmOpen]);

   // Check if current route is within automation section
   const isAutomationRoute = automationPaths.some(path => location.pathname === path);
   
   const [automationOpen, setAutomationOpen] = useState(() => {
     const saved = localStorage.getItem("sidebar:automation-open");
     if (saved !== null) return saved === "true";
     return isAutomationRoute;
   });
   
   useEffect(() => {
     if (isAutomationRoute && !automationOpen) setAutomationOpen(true);
   }, [isAutomationRoute]);
   
   useEffect(() => {
     localStorage.setItem("sidebar:automation-open", String(automationOpen));
   }, [automationOpen]);

  return (
    <Sidebar className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <Link to="/dashboard" className="flex min-w-0 items-center gap-3">
          <BrandLogo alt={appName} className="h-10 w-10 shrink-0 object-contain" />
          <span className="truncate text-lg font-bold text-white group-data-[collapsible=icon]:hidden">
            {appName}
          </span>
        </Link>
      </SidebarHeader>
      
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/50 text-xs uppercase font-terminal tracking-widest">
            Menu
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
             {/* Dashboard only */}
              {showMenu("dashboard") && (
               <SidebarMenuItem>
                 <SidebarMenuButton
                   asChild
                   isActive={location.pathname === "/dashboard"}
                   className="transition-all duration-200 hover:bg-sidebar-accent nav-item-neon"
                   data-sidebar-item="dashboard"
                 >
                   <Link to="/dashboard" className="flex items-center gap-3">
                     <LayoutDashboard className="h-5 w-5" />
                     <span>Dashboard</span>
                   </Link>
                 </SidebarMenuButton>
               </SidebarMenuItem>
              )}

              {/* Relatórios */}
              {showMenu("dashboard") && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/reports"}
                    className="transition-all duration-200 hover:bg-sidebar-accent nav-item-neon"
                    data-sidebar-item="reports"
                  >
                    <Link to="/reports" className="flex items-center gap-3">
                      <BarChart3 className="h-5 w-5" />
                      <span>Relatórios</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

               {/* CRM Collapsible Group */}
               {!isAffiliateOnly && (
               <Collapsible open={crmOpen} onOpenChange={setCrmOpen}>
                 <SidebarMenuItem>
                   <CollapsibleTrigger asChild>
                     <SidebarMenuButton
                       isActive={isCrmRoute}
                       className="transition-all duration-200 hover:bg-sidebar-accent justify-between"
                       data-sidebar-item="crm"
                        onClick={(e) => {
                          // Navigate to /crm on click, chevron handles collapse
                          const target = e.target as HTMLElement;
                          if (!target.closest('[data-chevron]')) {
                            e.preventDefault();
                            navigate('/crm');
                          }
                        }}
                     >
                       <div className="flex items-center gap-3">
                         <MessageSquare className="h-5 w-5" />
                         <span>CRM</span>
                       </div>
                       <div data-chevron>
                         {crmOpen ? (
                           <ChevronDown className="h-4 w-4 text-sidebar-foreground/50" />
                         ) : (
                           <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />
                         )}
                       </div>
                     </SidebarMenuButton>
                   </CollapsibleTrigger>
                   <CollapsibleContent>
                     <SidebarMenuSub>
                       {crmItems.map((item) => {
                         const [basePath, query] = item.path.split("?");
                         const isActive =
                           location.pathname === basePath &&
                           (!query || location.search.includes(query));
                         return (
                           <SidebarMenuSubItem key={item.title}>
                             <SidebarMenuSubButton asChild isActive={isActive}>
                               <Link to={item.path} className="flex items-center gap-3">
                                 <item.icon className="h-4 w-4" />
                                 <span>{item.title}</span>
                               </Link>
                             </SidebarMenuSubButton>
                           </SidebarMenuSubItem>
                         );
                       })}
                     </SidebarMenuSub>
                   </CollapsibleContent>
                 </SidebarMenuItem>
               </Collapsible>
               )}

               {/* Remaining main items */}
               {mainItems.filter(i => i.path !== "/dashboard" && showMenu(i.permKey)).map((item) => (
                <SidebarMenuItem key={item.title}>
                   <SidebarMenuButton
                    asChild={!item.disabled}
                    isActive={!item.disabled && location.pathname === item.path}
                    className={`transition-all duration-200 ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'hover:bg-sidebar-accent nav-item-neon'}`}
                    data-sidebar-item={item.dataId}
                  >
                    {item.disabled ? (
                      <span className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                        {item.badge && (
                          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-medium">
                            {item.badge}
                          </span>
                        )}
                      </span>
                    ) : (
                      <Link to={item.path} className="flex items-center gap-3">
                        <item.icon className="h-5 w-5" />
                        <span>{item.title}</span>
                      </Link>
                    )}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
               
               {/* Automation Collapsible Group */}
               {showMenu("automation") && (
               <Collapsible open={automationOpen} onOpenChange={setAutomationOpen}>
                 <SidebarMenuItem>
                   <CollapsibleTrigger asChild>
                      <SidebarMenuButton
                        isActive={isAutomationRoute}
                        className="transition-all duration-200 hover:bg-sidebar-accent justify-between"
                        data-sidebar-item="automation"
                      >
                       <div className="flex items-center gap-3">
                         <Bot className="h-5 w-5" />
                         <span>Automação</span>
                       </div>
                       {automationOpen ? (
                         <ChevronDown className="h-4 w-4 text-sidebar-foreground/50" />
                       ) : (
                         <ChevronRight className="h-4 w-4 text-sidebar-foreground/50" />
                       )}
                     </SidebarMenuButton>
                   </CollapsibleTrigger>
                   <CollapsibleContent>
                     <SidebarMenuSub>
                       {automationItems.map((item) => (
                         <SidebarMenuSubItem key={item.title}>
                           <SidebarMenuSubButton
                             asChild
                             isActive={location.pathname === item.path}
                           >
                             <Link to={item.path} className="flex items-center gap-3">
                               <item.icon className="h-4 w-4" />
                               <span>{item.title}</span>
                             </Link>
                           </SidebarMenuSubButton>
                         </SidebarMenuSubItem>
                       ))}
                     </SidebarMenuSub>
                   </CollapsibleContent>
                 </SidebarMenuItem>
               </Collapsible>
               )}
               
               {/* Affiliates */}
               {affiliateProgramEnabled && (
               <SidebarMenuItem>
                 <SidebarMenuButton
                   asChild
                   isActive={location.pathname.startsWith("/affiliates")}
                   className="transition-all duration-200 hover:bg-sidebar-accent nav-item-neon"
                   data-sidebar-item="affiliates"
                 >
                   <Link to="/affiliates" className="flex items-center gap-3">
                     <Handshake className="h-5 w-5" />
                     <span>Afiliados</span>
                   </Link>
                 </SidebarMenuButton>
               </SidebarMenuItem>
               )}

               {/* Settings */}
               {showMenu("settings") && (
               <SidebarMenuItem>
                 <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/settings"}
                    className="transition-all duration-200 hover:bg-sidebar-accent"
                    data-sidebar-item="settings"
                  >
                    <Link to="/settings" className="flex items-center gap-3">
                      <Settings className="h-5 w-5" />
                      <span>Configurações</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
               )}
               
                {/* Tutoriais */}
                {showMenu("tutorials") && (
                <SidebarMenuItem>
                   <SidebarMenuButton
                     asChild
                     isActive={location.pathname === "/tutorials"}
                     className="transition-all duration-200 hover:bg-sidebar-accent"
                     data-sidebar-item="tutorials"
                   >
                     <Link to="/tutorials" className="flex items-center gap-3">
                       <GraduationCap className="h-5 w-5" />
                       <span>Tutoriais</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                )}

                {/* Documentação */}
                {showMenu("docs") && (
                <SidebarMenuItem>
                   <SidebarMenuButton
                     asChild
                     isActive={location.pathname === "/docs"}
                     className="transition-all duration-200 hover:bg-sidebar-accent"
                     data-sidebar-item="docs"
                   >
                     <Link to="/docs" className="flex items-center gap-3">
                       <BookOpen className="h-5 w-5" />
                       <span>Documentação</span>
                     </Link>
                   </SidebarMenuButton>
                 </SidebarMenuItem>
                )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Upgrade CTA for free plan users */}
        {isFreePlan && !isAffiliateOnly && (
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                   <SidebarMenuButton
                     asChild
                     className="bg-gradient-to-r from-primary/20 to-accent/20 hover:from-primary/30 hover:to-accent/30 border border-primary/30 neon-glow-purple"
                   >
                    <Link to="/conheca#pricing" className="flex items-center gap-3">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span className="font-medium text-primary">Fazer Upgrade</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <UserProfileDialogWrapper user={user} userProfile={userProfile} signOut={signOut} />
      </SidebarFooter>
    </Sidebar>
  );
}

interface UserProfileSidebar {
  full_name: string | null;
}

function UserProfileDialogWrapper({
  user,
  userProfile,
  signOut,
}: {
  user: User | null;
  userProfile?: UserProfileSidebar | null;
  signOut: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);

  return (
    <>
      <div className="flex flex-col gap-2">
        <button
          onClick={() => setProfileOpen(true)}
          className="flex items-center gap-2 text-left rounded-md px-2 py-1.5 hover:bg-sidebar-accent transition-colors cursor-pointer group"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-primary flex-shrink-0">
            <UserCog className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0">
            {userProfile?.full_name && (
              <p className="text-sm font-medium text-sidebar-foreground truncate leading-tight">
                {userProfile.full_name}
              </p>
            )}
            <p className="text-xs text-sidebar-foreground/50 truncate leading-tight">
              {user?.email}
            </p>
          </div>
        </button>
        <Button
          variant="ghost"
          size="sm"
          onClick={signOut}
          className="justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent h-8 px-2 text-xs"
        >
          <LogOut className="h-3.5 w-3.5 mr-2" />
          SAIR
        </Button>
      </div>
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </>
  );
}
