import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { LandingHero } from "@/components/landing/LandingHero";
import { LandingSocialProof } from "@/components/landing/LandingSocialProof";
import { LandingShowcase } from "@/components/landing/LandingShowcase";
import { LandingHowItWorks } from "@/components/landing/LandingHowItWorks";
import { LandingIntegrations } from "@/components/landing/LandingIntegrations";
import { LandingCTA } from "@/components/landing/LandingCTA";
import { LandingPricing } from "@/components/landing/LandingPricing";
import { LandingFAQ } from "@/components/landing/LandingFAQ";
import { LandingTestimonials } from "@/components/landing/LandingTestimonials";
import { LandingFooter } from "@/components/landing/LandingFooter";
import { LandingHeader } from "@/components/landing/LandingHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { captureRefFromUrl } from "@/lib/affiliateTracking";

interface LandingPageSettings {
  hero: {
    title: string;
    subtitle: string;
    cta_text: string;
    cta_secondary_text: string;
  };
  features: Array<{
    icon: string;
    title: string;
    description: string;
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
}

interface GeneralSettings {
  app_name: string;
  support_email: string;
  terms_url: string;
  privacy_url: string;
}

const HolographicDivider = () => (
  <div
    className="h-px w-full max-w-4xl mx-auto"
    style={{ background: "var(--gradient-holographic)" }}
  />
);

export default function Landing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [landingSettings, setLandingSettings] = useState<LandingPageSettings | null>(null);
  const [generalSettings, setGeneralSettings] = useState<GeneralSettings | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings();
    captureRefFromUrl();
  }, []);

  // Scroll automático para hash anchor após carregamento
  useEffect(() => {
    if (loading) return;
    
    const hash = location.hash;
    if (hash) {
      const timeoutId = setTimeout(() => {
        const element = document.querySelector(hash);
        if (element) {
          const headerOffset = 80;
          const elementPosition = element.getBoundingClientRect().top;
          const offsetPosition = elementPosition + window.pageYOffset - headerOffset;
          
          window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
          });
        }
      }, 150);
      
      return () => clearTimeout(timeoutId);
    }
  }, [loading, location.hash]);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("saas_settings")
        .select("key, value")
        .in("key", ["landing_page", "general"]);

      if (error) throw error;

      data?.forEach((setting) => {
        if (setting.key === "landing_page") {
          setLandingSettings(setting.value as unknown as LandingPageSettings);
        } else if (setting.key === "general") {
          setGeneralSettings(setting.value as unknown as GeneralSettings);
        }
      });
    } catch (error) {
      console.error("Error fetching settings:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-8 gap-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl gradient-primary flex items-center justify-center neon-glow-pink animate-pulse" />
          <span className="text-2xl font-bold text-foreground">
            {generalSettings?.app_name || "Uz4Flow"}
          </span>
        </div>
        <div className="w-full max-w-2xl space-y-4">
          <Skeleton className="h-12 w-3/4 mx-auto" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-5/6 mx-auto" />
          <div className="flex gap-3 justify-center pt-4">
            <Skeleton className="h-11 w-40" />
            <Skeleton className="h-11 w-40" />
          </div>
        </div>
      </div>
    );
  }

  const appName = generalSettings?.app_name || "Uz4Flow";

  return (
    <div className="min-h-screen bg-background relative overflow-x-hidden">
      {/* Floating particles */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/40"
            style={{
              left: `${15 + i * 15}%`,
              animation: `particle-float ${12 + i * 3}s linear infinite`,
              animationDelay: `${i * 2.5}s`,
            }}
          />
        ))}
      </div>

      <LandingHeader appName={appName} />
      
      <main className="relative z-10">
        <LandingHero 
          title={landingSettings?.hero.title || "Automatize seu WhatsApp Business"}
          subtitle={landingSettings?.hero.subtitle || "Crie fluxos inteligentes e escale seu atendimento"}
          ctaText={landingSettings?.hero.cta_text || "Começar Gratuitamente"}
          ctaSecondaryText={landingSettings?.hero.cta_secondary_text || "Ver Demonstração"}
        />
        
        <LandingSocialProof />

        <HolographicDivider />
        
        <LandingShowcase />
        
        <HolographicDivider />

        <LandingHowItWorks />

        <HolographicDivider />

        <LandingIntegrations />

        <HolographicDivider />

        <LandingCTA />

        <HolographicDivider />
        
        <LandingPricing />

        <HolographicDivider />

        <LandingTestimonials />
        
        <HolographicDivider />
        
        <LandingFAQ 
          items={landingSettings?.faq || []}
        />
      </main>
      
      <LandingFooter 
        appName={appName}
        supportEmail={generalSettings?.support_email}
        termsUrl={generalSettings?.terms_url}
        privacyUrl={generalSettings?.privacy_url}
      />
    </div>
  );
}
