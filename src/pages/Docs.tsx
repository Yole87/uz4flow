import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DocsSidebar } from "@/components/docs/DocsSidebar";
import { DocsContent } from "@/components/docs/DocsContent";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookOpen, Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const allSections = [
  "intro", "crm", "pipeline", "prospection", 
  "connectors", "flows", "rules", "templates",
  "followup", "voice-campaigns", "mcp-servers",
  "instagram", "settings", "faq"
];

export default function Docs() {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [activeSection, setActiveSection] = useState("intro");
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle hash on mount and hash changes
  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash && allSections.includes(hash)) {
      setActiveSection(hash);
      // Scroll to section after a small delay to ensure DOM is ready
      setTimeout(() => {
        const element = document.getElementById(hash);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    }
  }, [location.hash]);

  // Update active section based on scroll position
  useEffect(() => {
    const handleScroll = () => {
      const sections = allSections.map(id => document.getElementById(id)).filter(Boolean);
      
      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i];
        if (section) {
          const rect = section.getBoundingClientRect();
          if (rect.top <= 100) {
            setActiveSection(section.id);
            break;
          }
        }
      }
    };

    const scrollContainer = contentRef.current;
    if (scrollContainer) {
      scrollContainer.addEventListener("scroll", handleScroll);
      return () => scrollContainer.removeEventListener("scroll", handleScroll);
    }
  }, []);

  const handleSectionClick = (sectionId: string) => {
    setActiveSection(sectionId);
    // Dispatch custom event for DocsContent to auto-expand
    window.dispatchEvent(new CustomEvent("docs-section-select", { detail: sectionId }));
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    // Update URL hash without full navigation
    window.history.replaceState(null, "", `#${sectionId}`);
  };

  // Mobile section selector
  const MobileSectionSelector = () => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 border-border">
          <Menu className="h-4 w-4" />
          <span className="text-xs sm:text-sm">Navegar</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 bg-card border-border">
        {allSections.map((id) => (
          <DropdownMenuItem
            key={id}
            onClick={() => handleSectionClick(id)}
            className={activeSection === id ? "bg-primary/10 text-primary" : ""}
          >
            {id === "intro" && "Introdução"}
            {id === "crm" && "CRM WhatsApp"}
            {id === "pipeline" && "Funil Kanban"}
            {id === "prospection" && "Prospecção"}
            {id === "connectors" && "Conectores"}
            {id === "flows" && "Fluxos"}
            {id === "rules" && "Regras"}
            {id === "templates" && "Templates"}
            {id === "followup" && "Follow-up"}
            {id === "voice-campaigns" && "Ligações IA"}
            {id === "mcp-servers" && "Servidores MCP"}
            {id === "instagram" && "Instagram"}
            {id === "settings" && "Configurações"}
            {id === "faq" && "FAQ"}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col">
          {/* Header */}
          <header className="flex h-14 shrink-0 items-center gap-3 header-quantum px-4">
            <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
              <h1 className="text-base sm:text-lg font-semibold text-foreground">Documentação</h1>
            </div>
            
            {isMobile && (
              <div className="ml-auto">
                <MobileSectionSelector />
              </div>
            )}
          </header>

          {/* Content */}
          <div className="flex flex-1 overflow-hidden">
            {/* Desktop Sidebar */}
            {!isMobile && (
              <DocsSidebar 
                activeSection={activeSection} 
                onSectionClick={handleSectionClick} 
              />
            )}

            {/* Main Content */}
            <ScrollArea className="flex-1" ref={contentRef}>
              <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <DocsContent />
              </div>
            </ScrollArea>
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
