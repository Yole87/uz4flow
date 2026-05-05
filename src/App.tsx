import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useOrganizationSubscription } from "@/hooks/useOrganizationSubscription";

// Pages
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Flows from "./pages/Flows";
import FlowEditor from "./pages/FlowEditor";
import FlowResults from "./pages/FlowResults";
import Connectors from "./pages/Connectors";
import ConnectorWizard from "./pages/ConnectorWizard";
import ConnectorHistory from "./pages/ConnectorHistory";
import Rules from "./pages/Rules";
import MessageTemplates from "./pages/MessageTemplates";
import History from "./pages/History";
import Settings from "./pages/Settings";
import NotFound from "./pages/NotFound";
import Checkout from "./pages/Checkout";
import CRM from "./pages/CRM";
import Kanban from "./pages/Kanban";
import Team from "./pages/Team";
import Queue from "./pages/Queue";
import Prospection from "./pages/Prospection";
import Docs from "./pages/Docs";
import VoiceAI from "./pages/VoiceAI";
import McpGateway from "./pages/McpGateway";
import Tutorials from "./pages/Tutorials";
import Install from "./pages/Install";
import SubscriptionCallback from "./pages/SubscriptionCallback";
import Instagram from "./pages/Instagram";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";
import Reports from "./pages/Reports";

import { AdminGuard } from "@/components/admin/AdminGuard";
import { PermissionGuard } from "@/components/auth/PermissionGuard";

// Admin Pages
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminOrganizations from "./pages/admin/AdminOrganizations";
import AdminPlans from "./pages/admin/AdminPlans";

import AdminSettings from "./pages/admin/AdminSettings";
import AdminCoupons from "./pages/admin/AdminCoupons";
import AdminTutorials from "./pages/admin/AdminTutorials";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminAffiliates from "./pages/admin/AdminAffiliates";
import AdminNotifications from "./pages/admin/AdminNotifications";
import Affiliates from "./pages/Affiliates";
import AffiliateOnboardingPublic from "./pages/AffiliateOnboardingPublic";


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
  const { data: organization, isLoading: orgLoading } = useUserOrganization();
  const { isActive } = useOrganizationSubscription();

  if (loading || (user && orgLoading)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <BrandingInjector />
        <Sonner />
        <BrowserRouter>
          <LiaProvider>
            {/* Global support-mode banner — visible on every authenticated route,
                including pages (CRM, Kanban, …) that don't use AppLayout. */}
            <ImpersonationBanner />
            <AppRoutes />
            <InstallPrompt />
          </LiaProvider>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;