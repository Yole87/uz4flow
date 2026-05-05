import { useState, useEffect } from "react";
import { OnboardingChecklist } from "./OnboardingChecklist";
import { WelcomeDialog } from "./WelcomeDialog";
import { useOnboardingChecklist } from "@/hooks/useOnboardingChecklist";
import { useTutorialsEnabledForNewMembers } from "@/hooks/useTutorialsEnabledForNewMembers";

/**
 * Wrapper que orquestra o modal de boas-vindas + checklist persistente.
 * Para colocar no topo do Dashboard.
 */
export function OnboardingSection() {
  const { enabled: tutorialsEnabled } = useTutorialsEnabledForNewMembers();
  const { shouldShowWelcome, isVisible, skip } = useOnboardingChecklist();
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [seenInSession, setSeenInSession] = useState(false);

  useEffect(() => {
    if (tutorialsEnabled && shouldShowWelcome && !seenInSession) {
      setWelcomeOpen(true);
      setSeenInSession(true);
    }
  }, [tutorialsEnabled, shouldShowWelcome, seenInSession]);

  const scrollToChecklist = () => {
    setWelcomeOpen(false);
    setTimeout(() => {
      document.getElementById("onboarding-checklist")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 100);
  };

  if (!tutorialsEnabled) return null;
  if (!isVisible) return null;

  return (
    <>
      <OnboardingChecklist />
      <WelcomeDialog
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        onStart={scrollToChecklist}
        onSkip={() => {
          setWelcomeOpen(false);
          skip();
        }}
      />
    </>
  );
}
