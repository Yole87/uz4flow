import { ReactNode } from "react";
import { LucideIcon, KeyRound, PlayCircle, BookOpen } from "lucide-react";

import { ServiceTutorialVideo } from "./ServiceTutorialVideo";
import { ServiceTutorialSteps, type TutorialStep } from "./ServiceTutorialSteps";

interface ServiceConfigSectionProps {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  tutorialVideoId?: string;
  tutorialVideoTitle?: string;
  tutorialVideoDescription?: string;
  tutorialSteps?: TutorialStep[];
}

export function ServiceConfigSection({
  title,
  icon: Icon,
  children,
  tutorialVideoId,
  tutorialVideoTitle,
  tutorialVideoDescription,
  tutorialSteps,
}: ServiceConfigSectionProps) {
  return (
    <div className="space-y-8">
      {/* Section 1 — Credentials */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-5 w-5 text-accent" />
          <h2 className="text-base font-semibold text-foreground">Credenciais e Configurações</h2>
        </div>
        {children}
      </section>

      {/* Section 2 — Video Tutorial */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <PlayCircle className="h-5 w-5 text-secondary" />
          <h2 className="text-base font-semibold text-foreground">Vídeo Tutorial</h2>
        </div>
        <ServiceTutorialVideo
          videoId={tutorialVideoId}
          title={tutorialVideoTitle}
          description={tutorialVideoDescription}
        />
      </section>

      {/* Section 3 — Text Tutorial */}
      {tutorialSteps && tutorialSteps.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-primary" />
            <h2 className="text-base font-semibold text-foreground">Tutorial Passo a Passo</h2>
          </div>
          <ServiceTutorialSteps steps={tutorialSteps} />
        </section>
      )}
    </div>
  );
}
