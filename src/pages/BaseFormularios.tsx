import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Database } from "lucide-react";
import { BaseFormulariosLayout } from "@/components/crm/base-formularios/BaseFormulariosLayout";

export default function BaseFormularios() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 sm:gap-3 header-quantum px-3 sm:px-4">
            <SidebarTrigger className="-ml-1 sm:-ml-2 text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2 min-w-0">
              <Database className="h-5 w-5 text-accent shrink-0" />
              <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate">
                Base e Formulários
              </h1>
            </div>
          </header>

          <main className="flex-1 bg-background p-3 sm:p-6 overflow-auto min-w-0 overflow-x-hidden">
            <BaseFormulariosLayout />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
