import { AppLayout } from "@/components/layout/AppLayout";
import { QueueTabsView } from "@/components/team/QueueTabsView";

export default function Queue() {
  return (
    <AppLayout
      title="Fila de Atendimento"
      description="Veja em tempo real onde estão seus clientes e acompanhe o desempenho de cada atendente"
    >
      <div className="animate-fade-in">
        <QueueTabsView />
      </div>
    </AppLayout>
  );
}
