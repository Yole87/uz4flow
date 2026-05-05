import { AdminLayout } from "@/components/admin/AdminLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BillingDashboardTab } from "@/components/admin/billing/BillingDashboardTab";
import { BillingTemplatesTab } from "@/components/admin/billing/BillingTemplatesTab";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { Link } from "react-router-dom";

export default function AdminBilling() {
  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Cobranças</h1>
          <p className="text-muted-foreground mt-1">
            Gestão automatizada de cobranças e notificações via WhatsApp
          </p>
        </div>

        <Alert className="border-accent/30 bg-accent/5">
          <Info className="h-4 w-4 text-accent" />
          <AlertTitle>Conexão WhatsApp unificada</AlertTitle>
          <AlertDescription className="text-muted-foreground">
            As notificações de cobrança usam as mesmas credenciais do Sistema de WhatsApp AI configuradas em{" "}
            <Link
              to="/admin/notifications"
              className="text-primary underline-offset-2 hover:underline font-medium"
            >
              Notificações &gt; Conexão
            </Link>
            . Não é mais necessário cadastrar uma chave separada aqui.
          </AlertDescription>
        </Alert>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard">
            <BillingDashboardTab />
          </TabsContent>

          <TabsContent value="templates">
            <BillingTemplatesTab />
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
