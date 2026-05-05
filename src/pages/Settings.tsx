import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsSidebar, SettingsSectionKey } from "@/components/settings/SettingsSidebar";
import { SettingsHelpDrawer, HelpKey } from "@/components/settings/SettingsHelpDrawer";
import { WhatsAppSection } from "@/components/settings/sections/WhatsAppSection";
import { VoiceAISection } from "@/components/settings/sections/VoiceAISection";
import { AISection } from "@/components/settings/sections/AISection";
import { QuickRepliesSection } from "@/components/settings/sections/QuickRepliesSection";
import { SubscriptionSection } from "@/components/settings/sections/SubscriptionSection";
import { StorageSection } from "@/components/settings/sections/StorageSection";
import { useAutoMigrateIntegration } from "@/hooks/useAutoMigrateIntegration";

const VALID_KEYS: SettingsSectionKey[] = [
  "whatsapp",
  "voice",
  "ai",
  "quick-replies",
  "subscription",
  "storage",
];

function getInitialSection(hash: string): SettingsSectionKey {
  const cleaned = hash.replace("#", "") as SettingsSectionKey;
  return VALID_KEYS.includes(cleaned) ? cleaned : "whatsapp";
}

export default function Settings() {
  // Auto-migrate legacy integrations data into instances
  useAutoMigrateIntegration();

  const location = useLocation();
  const navigate = useNavigate();
  const [active, setActive] = useState<SettingsSectionKey>(() => getInitialSection(location.hash));
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpKey, setHelpKey] = useState<HelpKey | null>(null);

  // Sync URL hash with active section
  useEffect(() => {
    const next = getInitialSection(location.hash);
    if (next !== active) setActive(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.hash]);

  const handleChange = (key: SettingsSectionKey) => {
    setActive(key);
    navigate({ hash: key }, { replace: true });
  };

  const openHelp = (key: HelpKey) => {
    setHelpKey(key);
    setHelpOpen(true);
  };

  return (
    <AppLayout title="Configurações" description="Gerencie sua conta e integrações">
      <div className="w-full max-w-screen-2xl mx-auto animate-fade-in">
        <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6 lg:gap-10">
          <aside>
            <SettingsSidebar active={active} onChange={handleChange} />
          </aside>

          <main className="min-w-0">
            {active === "whatsapp" && <WhatsAppSection onHelp={() => openHelp("whatsapp")} />}
            {active === "voice" && <VoiceAISection onHelp={() => openHelp("voice")} />}
            {active === "ai" && <AISection onHelp={() => openHelp("ai")} />}
            {active === "quick-replies" && <QuickRepliesSection onHelp={() => openHelp("quick-replies")} />}
            {active === "subscription" && <SubscriptionSection onHelp={() => openHelp("subscription")} />}
            {active === "storage" && <StorageSection onHelp={() => openHelp("storage")} />}
          </main>
        </div>
      </div>

      <SettingsHelpDrawer open={helpOpen} onOpenChange={setHelpOpen} helpKey={helpKey} />
    </AppLayout>
  );
}
