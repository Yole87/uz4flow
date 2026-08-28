import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";
import { useEffect, useState, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";

function useIsAdminMaster() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    supabase
      .rpc("has_role", { _user_id: user.id, _role: "admin_master" })
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(!!data);
      });
    return () => { cancelled = true; };
  }, [user]);

  return isAdmin;
}

// Pages — lazy (code-split por rota)
const Auth = lazy(() => import("./pages/Auth"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Landing = lazy(() => import("./pages/Landing"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Flows = lazy(() => import("./pages/Flows"));
const FlowEditor = lazy(() => import("./pages/FlowEditor"));
const FlowResults = lazy(() => import("./pages/FlowResults"));
const Connectors = lazy(() => import("./pages/Connectors"));
const ConnectorWizard = lazy(() => import("./pages/ConnectorWizard"));
const ConnectorHistory = lazy(() => import("./pages/ConnectorHistory"));
const Rules = lazy(() => import("./pages/Rules"));
const MessageTemplates = lazy(() => import("./pages/MessageTemplates"));
const History = lazy(() => import("./pages/History"));
const Settings = lazy(() => import("./pages/Settings"));
const Checkout = lazy(() => import("./pages/Checkout"));
const CRM = lazy(() => import("./pages/CRM"));
const Kanban = lazy(() => import("./pages/Kanban"));
const Team = lazy(() => import("./pages/Team"));
const Queue = lazy(() => import("./pages/Queue"));
const Prospection = lazy(() => import("./pages/Prospection"));
const BaseFormularios = lazy(() => import("./pages/BaseFormularios"));
const UzFormDetail = lazy(() => import("./pages/UzFormDetail"));
const Docs = lazy(() => import("./pages/Docs"));
const VoiceAI = lazy(() => import("./pages/VoiceAI"));
const McpGateway = lazy(() => import("./pages/McpGateway"));
const Tutorials = lazy(() => import("./pages/Tutorials"));
const Install = lazy(() => import("./pages/Install"));
const SubscriptionCallback = lazy(() => import("./pages/SubscriptionCallback"));
const Instagram = lazy(() => import("./pages/Instagram"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService = lazy(() => import("./pages/TermsOfService"));
const Reports = lazy(() => import("./pages/Reports"));
const PublicForm = lazy(() => import("./pages/PublicForm"));
const Agenda = lazy(() => import("./pages/Agenda"));

import { AdminGuard } from "@/components/admin/AdminGuard";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

// Admin Pages (lazy)
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrganizations = lazy(() => import("./pages/admin/AdminOrganizations"));
const AdminPlans = lazy(() => import("./pages/admin/AdminPlans"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminTutorials = lazy(() => import("./pages/admin/AdminTutorials"));
const AdminBilling = lazy(() => import("./pages/admin/AdminBilling"));
const AdminAffiliates = lazy(() => import("./pages/admin/AdminAffiliates"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const Affiliates = lazy(() => import("./pages/Affiliates"));
const AffiliateOnboardingPublic = lazy(() => import("./pages/AffiliateOnboardingPublic"));


const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes - reduce refetches
      gcTime: 1000 * 60 * 10, // 10 minutes cache retention
      refetchOnWindowFocus: false, // Prevent refetch on tab focus
      refetchOnMount: false, // Use cached data when mounting
      retry: 1, // Reduce retry attempts
    },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const isAdminMaster = useIsAdminMaster();
  const shouldCheckOrganization = !!user && isAdminMaster === false;
  const { data: organization, isLoading: orgLoading } = useUserOrganization({ enabled: shouldCheckOrganization });
  const { isActive } = useOrganizationSubscription();

  if (loading || (user && (isAdminMaster === null || (shouldCheckOrganization && orgLoading)))) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  // admin_master always lands on /admin
  if (user && isAdminMaster) {
    return <Navigate to="/admin" replace />;
  }

  // Only redirect to dashboard if user has an organization with active subscription
  if (user && organization && isActive) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/" element={<PublicRoute><Auth /></PublicRoute>} />
      <Route path="/conheca" element={<Landing />} />
      <Route path="/auth" element={<Navigate to="/" replace />} />
      <Route path="/forgot-password" element={<PublicRoute><ForgotPassword /></PublicRoute>} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/privacidade" element={<PrivacyPolicy />} />
      <Route path="/termos" element={<TermsOfService />} />
      <Route path="/f/:token" element={<PublicForm />} />
      <Route path="/checkout" element={<Navigate to="/conheca#pricing" replace />} />
      <Route path="/checkout/:planId" element={<Checkout />} />
      <Route path="/subscription/callback" element={<ProtectedRoute><SubscriptionCallback /></ProtectedRoute>} />
      
      {/* Protected routes with subscription check */}
      <Route path="/dashboard" element={<SubscriptionGuard><PermissionGuard menu="dashboard"><Dashboard /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/reports" element={<SubscriptionGuard><PermissionGuard menu="dashboard"><Reports /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/crm" element={<SubscriptionGuard><PermissionGuard menu="crm"><CRM /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/kanban" element={<SubscriptionGuard><PermissionGuard menu="kanban"><Kanban /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/team" element={<SubscriptionGuard><PermissionGuard menu="team"><Team /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/queue" element={<SubscriptionGuard><PermissionGuard menu="team" action="view_queue"><Queue /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/team/queue" element={<Navigate to="/queue" replace />} />
      <Route path="/prospection" element={<SubscriptionGuard><PermissionGuard menu="prospection"><Prospection /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/base-formularios" element={<SubscriptionGuard><PermissionGuard menu="base_formularios"><BaseFormularios /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/base-formularios/:sourceId" element={<SubscriptionGuard><PermissionGuard menu="base_formularios"><BaseFormularios /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/base-formularios/form/:formId" element={<SubscriptionGuard><PermissionGuard menu="base_formularios"><UzFormDetail /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/flows" element={<SubscriptionGuard><PermissionGuard menu="automation"><Flows /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/flows/:id" element={<SubscriptionGuard><PermissionGuard menu="automation"><FlowEditor /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/flows/:id/results" element={<SubscriptionGuard><PermissionGuard menu="automation"><FlowResults /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/connectors" element={<SubscriptionGuard><PermissionGuard menu="automation"><Connectors /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/connectors/new" element={<SubscriptionGuard><PermissionGuard menu="automation"><ConnectorWizard /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/connectors/:id" element={<SubscriptionGuard><PermissionGuard menu="automation"><ConnectorWizard /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/connectors/:id/history" element={<SubscriptionGuard><PermissionGuard menu="automation"><ConnectorHistory /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/rules" element={<SubscriptionGuard><PermissionGuard menu="automation"><Rules /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/templates" element={<SubscriptionGuard><PermissionGuard menu="automation"><MessageTemplates /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/history" element={<SubscriptionGuard><PermissionGuard menu="automation"><History /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/settings" element={<SubscriptionGuard allowPending><PermissionGuard menu="settings"><Settings /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/docs" element={<SubscriptionGuard><PermissionGuard menu="docs"><Docs /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/voice" element={<SubscriptionGuard><PermissionGuard menu="voice"><VoiceAI /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/voice-campaigns" element={<Navigate to="/voice" replace />} />
      <Route path="/follow-up" element={<Navigate to="/voice" replace />} />
      <Route path="/mcp-gateway" element={<SubscriptionGuard><PermissionGuard menu="mcp_gateway"><McpGateway /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/tutorials" element={<SubscriptionGuard><PermissionGuard menu="tutorials"><Tutorials /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/install" element={<SubscriptionGuard><Install /></SubscriptionGuard>} />
      <Route path="/instagram" element={<SubscriptionGuard><PermissionGuard menu="instagram"><Instagram /></PermissionGuard></SubscriptionGuard>} />
      <Route path="/agenda" element={<SubscriptionGuard><PermissionGuard menu="agenda"><Agenda /></PermissionGuard></SubscriptionGuard>} />
      
      {/* Admin Routes - require authentication + admin_master role */}
      <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
      <Route path="/admin/organizations" element={<AdminGuard><AdminOrganizations /></AdminGuard>} />
      <Route path="/admin/plans" element={<AdminGuard><AdminPlans /></AdminGuard>} />
      <Route path="/admin/subscriptions" element={<Navigate to="/admin/organizations" replace />} />
      <Route path="/admin/coupons" element={<AdminGuard><AdminCoupons /></AdminGuard>} />
      <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />
      <Route path="/admin/tutorials" element={<AdminGuard><AdminTutorials /></AdminGuard>} />
      <Route path="/admin/billing" element={<AdminGuard><AdminBilling /></AdminGuard>} />
      <Route path="/admin/affiliates" element={<AdminGuard><AdminAffiliates /></AdminGuard>} />
      <Route path="/admin/notifications" element={<AdminGuard><AdminNotifications /></AdminGuard>} />

      {/* Affiliates (tenant + público) */}
      <Route path="/affiliates" element={<ProtectedRoute><Affiliates /></ProtectedRoute>} />
      <Route path="/affiliates/onboarding" element={<AffiliateOnboardingPublic />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

import { LiaProvider } from "@/components/lia/LiaProvider";
import { useBranding } from "@/hooks/useBranding";
import InstallPrompt from "@/components/pwa/InstallPrompt";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";

function BrandingInjector() {
  useBranding();
  return null;
}

function RouteChunkPreloader() {
  const { user } = useAuth();
  const isAdminMaster = useIsAdminMaster();

  useEffect(() => {
    if (!user || isAdminMaster !== false) return;

    const id = window.setTimeout(() => {
      void import("./pages/Dashboard");
      void import("./pages/CRM");
      void import("./pages/Kanban");
    }, 2000);

    return () => window.clearTimeout(id);
  }, [user, isAdminMaster]);

  return null;
}

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrandingInjector />
          <Sonner />
          <BrowserRouter>
            <LiaProvider>
              <RouteChunkPreloader />
              {/* Global support-mode banner — visible on every authenticated route,
                  including pages (CRM, Kanban, …) that don't use AppLayout. */}
              <ImpersonationBanner />
              <Suspense
                fallback={
                  <div className="flex min-h-screen items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                }
              >
                <AppRoutes />
              </Suspense>
              <InstallPrompt />
            </LiaProvider>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;