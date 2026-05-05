import { AppLayout } from "@/components/layout/AppLayout";
import { QueueDashboard } from "@/components/team/QueueDashboard";

export default function AttendanceQueue() {
  return (
    <AppLayout
      title="Fila de Atendimento"
      description="Acompanhe em tempo real onde estão seus clientes e o desempenho de cada atendente"
    >
      <div className="max-w-5xl animate-fade-in">
        <QueueDashboard />
      </div>
    </AppLayout>
  );
}
