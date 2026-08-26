import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { FileText } from "lucide-react";
import { UzFormDetail as UzFormDetailLayout } from "@/components/crm/base-formularios/UzFormDetail";

export default function UzFormDetail() {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <header className="flex h-14 shrink-0 items-center gap-2 sm:gap-3 header-quantum px-3 sm:px-4">
            <SidebarTrigger className="-ml-1 sm:-ml-2 text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="h-5 w-5 text-accent shrink-0" />
              <h1 className="text-sm sm:text-lg font-semibold text-foreground truncate">
                Editor de Formulário
              </h1>
            </div>
          </header>

          <main className="flex-1 bg-background p-3 sm:p-6 overflow-auto min-w-0 overflow-x-hidden">
            <UzFormDetailLayout />
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
