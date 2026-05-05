import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Play, Pause, CheckCircle, XCircle, Clock, RotateCcw, CalendarClock, Pencil, Ban, FileBarChart } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CampaignReportDialog } from "./CampaignReportDialog";

const statusConfig: Record<string, { label: string; color: string; icon: typeof Play }> = {
  draft: { label: "Rascunho", color: "border-muted text-muted-foreground", icon: Clock },
  scheduled: { label: "Agendada", color: "border-yellow-500/50 text-yellow-500", icon: CalendarClock },
  running: { label: "Em andamento", color: "border-accent/50 text-accent", icon: Play },
  paused: { label: "Pausada", color: "border-yellow-500/50 text-yellow-500", icon: Pause },
  completed: { label: "Concluída", color: "border-emerald-500/50 text-emerald-500", icon: CheckCircle },
  cancelled: { label: "Cancelada", color: "border-destructive/50 text-destructive", icon: Ban },
};

interface CampaignCardProps {
  campaign: {
    id: string;
    name: string;
    status: string;
    total_contacts: number;
    completed_calls: number;
    failed_calls: number;
    created_at: string;
    call_reason?: string | null;
    scheduled_at?: string | null;
    whatsapp_followup_file_name?: string | null;
  };
  onStart?: (id: string) => void;
  onPause?: (id: string) => void;
  onResume?: (id: string) => void;
  onCancel?: (id: string) => void;
  onEdit?: (id: string) => void;
}

export function CampaignCard({ campaign, onStart, onPause, onResume, onCancel, onEdit }: CampaignCardProps) {
  const [showReport, setShowReport] = useState(false);
  const config = statusConfig[campaign.status] || statusConfig.draft;
  const progress = campaign.total_contacts > 0
    ? Math.round(((campaign.completed_calls + campaign.failed_calls) / campaign.total_contacts) * 100)
    : 0;

  return (
    <Card className="transition-colors">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="text-foreground text-base truncate">{campaign.name}</CardTitle>
            {campaign.call_reason && (
              <p className="text-xs text-muted-foreground mt-1 truncate">Motivo: {campaign.call_reason}</p>
            )}
            {campaign.scheduled_at && (
              <p className="text-xs text-muted-foreground mt-1">
                <CalendarClock className="h-3 w-3 inline mr-1" />
                Agendada para {format(new Date(campaign.scheduled_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {campaign.status === "completed" && (
              <Button size="sm" variant="outline" onClick={() => setShowReport(true)}>
                <FileBarChart className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Relatório</span>
              </Button>
            )}
            {campaign.status === "scheduled" && onEdit && (
              <Button size="sm" variant="outline" onClick={() => onEdit(campaign.id)}>
                <Pencil className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Editar</span>
              </Button>
            )}
            {campaign.status === "scheduled" && onCancel && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive border-destructive/50">
                    <Ban className="h-3 w-3 sm:mr-1" />
                    <span className="hidden sm:inline">Cancelar</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Cancelar campanha?</AlertDialogTitle>
                    <AlertDialogDescription>
                      A campanha "{campaign.name}" será cancelada e arquivos anexados serão removidos.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Voltar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onCancel(campaign.id)}>Cancelar Campanha</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
            {campaign.status === "draft" && onStart && (
              <Button size="sm" variant="outline" className="text-accent border-accent/50" onClick={() => onStart(campaign.id)}>
                <Play className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Iniciar</span>
              </Button>
            )}
            {campaign.status === "running" && onPause && (
              <Button size="sm" variant="outline" onClick={() => onPause(campaign.id)}>
                <Pause className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Pausar</span>
              </Button>
            )}
            {campaign.status === "paused" && onResume && (
              <Button size="sm" variant="outline" className="text-accent border-accent/50" onClick={() => onResume(campaign.id)}>
                <RotateCcw className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Retomar</span>
              </Button>
            )}
            <Badge variant="outline" className={config.color}>
              <config.icon className="h-3 w-3 mr-1" />
              {config.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{campaign.completed_calls + campaign.failed_calls} / {campaign.total_contacts} contatos</span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3 text-emerald-500" />
              {campaign.completed_calls}
            </span>
            <span className="flex items-center gap-1">
              <XCircle className="h-3 w-3 text-destructive" />
              {campaign.failed_calls}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Criada em {format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
          </p>
          {campaign.whatsapp_followup_file_name && (
            <p className="text-xs text-muted-foreground">📎 {campaign.whatsapp_followup_file_name}</p>
          )}
        </div>
      </CardContent>
      <CampaignReportDialog
        open={showReport}
        onOpenChange={setShowReport}
        campaignId={campaign.id}
        campaignName={campaign.name}
      />
    </Card>
  );
}
