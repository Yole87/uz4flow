import { useState, useEffect } from "react";
import { 
  Sparkles, 
  MessageSquare, 
  Kanban, 
  UserSearch, 
  Bot, 
  Settings, 
  HelpCircle,
  ChevronDown,
  ChevronRight,
  Plug,
  GitBranch,
  Route,
  FileText,
  Server,
  PhoneForwarded,
  Phone,
  Instagram,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface DocsSidebarProps {
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

const sections = [
  { id: "intro", title: "Introdução", icon: Sparkles },
  { id: "crm", title: "CRM WhatsApp", icon: MessageSquare },
  { id: "pipeline", title: "Funil Kanban", icon: Kanban },
  { id: "equipe", title: "Equipe & Fila", icon: PhoneForwarded },
  { id: "followup", title: "Follow-up", icon: PhoneForwarded },
  { id: "prospection", title: "Prospecção", icon: UserSearch },
  { id: "voice-campaigns", title: "Ligações IA", icon: Phone },
  { 
    id: "automation", 
    title: "Automação", 
    icon: Bot,
    children: [
      { id: "connectors", title: "Conectores", icon: Plug },
      { id: "flows", title: "Fluxos", icon: GitBranch },
      { id: "rules", title: "Regras", icon: Route },
      { id: "templates", title: "Templates", icon: FileText },
    ]
  },
  { id: "mcp-servers", title: "Servidores MCP", icon: Server },
  { id: "instagram", title: "Instagram", icon: Instagram },
  { id: "ai-evaluation", title: "Avaliação por IA", icon: Sparkles },
  { id: "afiliados", title: "Programa de Afiliados", icon: Sparkles },
  { id: "settings", title: "Configurações", icon: Settings },
  { id: "faq", title: "FAQ", icon: HelpCircle },
];

export function DocsSidebar({ activeSection, onSectionClick }: DocsSidebarProps) {
  const [automationOpen, setAutomationOpen] = useState(true);

  // Auto-expand when a child section is active
  useEffect(() => {
    const automationChildren = sections.find(s => s.id === "automation")?.children;
    if (automationChildren?.some(c => c.id === activeSection)) {
      setAutomationOpen(true);
    }
  }, [activeSection]);

  const isActive = (id: string) => activeSection === id;
  const isAutomationChildActive = sections
    .find(s => s.id === "automation")
    ?.children?.some(c => c.id === activeSection);

  return (
    <div className="w-60 shrink-0 border-r border-border bg-card">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">
          Documentação
        </h2>
      </div>
      <ScrollArea className="h-[calc(100vh-8rem)]">
        <nav className="p-2 space-y-1">
          {sections.map((section) => {
            if (section.children) {
              return (
                <Collapsible 
                  key={section.id} 
                  open={automationOpen} 
                  onOpenChange={setAutomationOpen}
                >
                  <CollapsibleTrigger asChild>
                    <button
                      className={cn(
                        "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                        isAutomationChildActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <section.icon className="h-4 w-4" />
                        <span>{section.title}</span>
                      </div>
                      {automationOpen ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="ml-4 mt-1 space-y-1 border-l border-border pl-2">
                      {section.children.map((child) => (
                        <button
                          key={child.id}
                          onClick={() => onSectionClick(child.id)}
                          className={cn(
                            "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                            isActive(child.id)
                              ? "bg-primary/10 text-primary font-medium"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted"
                          )}
                        >
                          <child.icon className="h-4 w-4" />
                          <span>{child.title}</span>
                        </button>
                      ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              );
            }

            return (
              <button
                key={section.id}
                onClick={() => onSectionClick(section.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors",
                  isActive(section.id)
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
              >
                <section.icon className="h-4 w-4" />
                <span>{section.title}</span>
              </button>
            );
          })}
        </nav>
      </ScrollArea>
    </div>
  );
}
