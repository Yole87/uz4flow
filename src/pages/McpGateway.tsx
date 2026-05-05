import { AppLayout } from "@/components/layout/AppLayout";
import { McpGallery } from "@/components/crm/mcp-gallery/McpGallery";
import { McpServersConfigCard } from "@/components/crm/settings/McpServersConfigCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LimitAlert } from "@/components/LimitAlert";

export default function McpGateway() {
  return (
    <AppLayout title="MCP Gateway" description="Hub de conexões MCP do Sistema de WhatsApp AI">
      <div className="animate-fade-in">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">MCP Gateway</h1>
          <p className="text-sm text-muted-foreground">
            Configure endpoints MCP para expor dados e ações do seu OpenFlow a agentes externos.
          </p>
        </div>
        <LimitAlert feature="mcp_gateway" className="mb-6" />
        <Tabs defaultValue="providers" className="w-full">
          <TabsList className="quantum-glass w-full mb-4 sm:mb-6">
            <TabsTrigger value="providers">Provedores</TabsTrigger>
            <TabsTrigger value="servers">Servidores Manuais</TabsTrigger>
          </TabsList>
          <TabsContent value="providers">
            <McpGallery />
          </TabsContent>
          <TabsContent value="servers">
            <div className="max-w-3xl">
              <McpServersConfigCard />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
