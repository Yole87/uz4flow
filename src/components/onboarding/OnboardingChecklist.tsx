import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, Rocket, X, ArrowRight, Smartphone, Kanban, GitBranch, Users, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingChecklist, type OnboardingStepKey } from "@/hooks/useOnboardingChecklist";
import type { LucideIcon } from "lucide-react";

interface ChecklistStep {
  key: OnboardingStepKey;
  title: string;
  description: string;
  icon: LucideIcon;
  cta: string;
  route: string;
  optional?: boolean;
}

const STEPS: ChecklistStep[] = [
  {
    key: "connect_whatsapp",
    title: "Conectar um WhatsApp",
    description: "Vincule um número via QR Code ou API Oficial Meta.",
    icon: Smartphone,
    cta: "Conectar agora",
    route: "/connectors",
  },
  {
    key: "configure_kanban",
    title: "Configurar funil Kanban",
    description: "Personalize estágios e mova seu primeiro lead.",
    icon: Kanban,
    cta: "Abrir Kanban",
    route: "/kanban",
  },
  {
    key: "create_first_flow",
    title: "Criar seu primeiro fluxo",
    description: "Use um template pronto ou crie do zero.",
    icon: GitBranch,
    cta: "Criar fluxo",
    route: "/flows?template=qualification",
  },
  {
    key: "invite_team",
    title: "Convidar equipe",
    description: "Adicione atendentes e configure rotação de leads.",
    icon: Users,
    cta: "Gerenciar equipe",
    route: "/team",
    optional: true,
  },
  {
    key: "import_contacts",
    title: "Importar contatos",
    description: "Carregue sua base via planilha Excel/CSV.",
    icon: Upload,
    cta: "Importar agora",
    route: "/crm?action=import",
    optional: true,
  },
];

export function OnboardingChecklist() {
  const navigate = useNavigate();
  const { steps, completedCount, totalSteps, isVisible, dismiss } = useOnboardingChecklist();

  if (!isVisible) return null;

  const pct = Math.round((completedCount / totalSteps) * 100);

  return (
    <Card id="onboarding-checklist" className="quantum-glass border-primary/40 neon-glow-pink animate-fade-in">
      <CardContent className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shrink-0">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-base sm:text-lg">Configure seu Uz4Flow</h3>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {completedCount === totalSteps
                  ? "Tudo pronto! 🎉"
                  : `${completedCount} de ${totalSteps} concluído${completedCount === 1 ? "" : "s"}`}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={dismiss}
            className="shrink-0 h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Dispensar checklist"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Progress value={pct} className="mt-4 h-2" />

        <ul className="mt-5 space-y-2">
          {STEPS.map((step) => {
            const done = !!steps[step.key];
            const Icon = step.icon;
            return (
              <li
                key={step.key}
                className={cn(
                  "flex items-center gap-3 rounded-lg border p-3 transition-colors",
                  done
                    ? "border-green-500/30 bg-green-500/5"
                    : "border-border hover:border-primary/40 hover:bg-muted/40"
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground shrink-0" />
                )}

                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 shrink-0">
                  <Icon className={cn("h-4 w-4", done ? "text-green-500" : "text-primary")} />
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "text-sm font-medium",
                        done ? "line-through text-muted-foreground" : "text-foreground"
                      )}
                    >
                      {step.title}
                    </span>
                    {step.optional && !done && (
                      <span className="text-xs uppercase tracking-wider text-muted-foreground">
                        opcional
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">{step.description}</p>
                </div>

                {!done && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate(step.route)}
                    className="shrink-0 hidden sm:inline-flex"
                  >
                    {step.cta}
                    <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
                {!done && (
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => navigate(step.route)}
                    className="shrink-0 sm:hidden h-8 w-8"
                    aria-label={step.cta}
                  >
                    <ArrowRight className="h-3 w-3" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
