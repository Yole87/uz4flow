import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarPlus, CalendarIcon, Clock, Video, Loader2, AlertTriangle, CheckCircle, Stethoscope } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useGoogleCalendar } from "@/hooks/useGoogleCalendar";

interface ScheduleEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactName: string;
  conversationId?: string;
}

const DURATION_OPTIONS = [
  { value: "15", label: "15 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "90", label: "1h30" },
  { value: "120", label: "2 horas" },
];

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const h = Math.floor(i / 2);
  const m = i % 2 === 0 ? "00" : "30";
  return `${h.toString().padStart(2, "0")}:${m}`;
});

interface DiagCheck { name: string; ok: boolean; detail: string }

function NotConnectedPane({ connect, connecting }: { connect: () => void; connecting: boolean }) {
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResults, setDiagResults] = useState<{ checks: DiagCheck[]; hint: string } | null>(null);

  const runDiagnostic = async () => {
    setDiagLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("google-oauth-diagnose");
      if (error) throw error;
      setDiagResults(data);
    } catch {
      setDiagResults({ checks: [], hint: "Não foi possível executar o diagnóstico." });
    } finally {
      setDiagLoading(false);
    }
  };

  return (
    <div className="space-y-4 py-4">
      <div className="text-center space-y-2">
        <CalendarPlus className="h-12 w-12 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">
          Conecte seu Google Calendar para agendar reuniões diretamente do CRM.
        </p>
      </div>
      <Button onClick={() => connect()} disabled={connecting} className="w-full gap-2">
        <CalendarIcon className="h-4 w-4" />
        {connecting ? "Redirecionando..." : "Conectar Google Calendar"}
      </Button>
      
      <div className="border-t border-border pt-3">
        <Button variant="ghost" size="sm" onClick={runDiagnostic} disabled={diagLoading} className="w-full gap-2 text-muted-foreground">
          {diagLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Stethoscope className="h-4 w-4" />}
          {diagLoading ? "Verificando..." : "Diagnosticar configuração"}
        </Button>
        
        {diagResults && (
          <div className="mt-3 space-y-2 text-xs">
            {diagResults.checks.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                {c.ok ? <CheckCircle className="h-3.5 w-3.5 text-green-500 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                <span className="font-medium">{c.name}:</span>
                <span className="text-muted-foreground truncate">{c.detail}</span>
              </div>
            ))}
            {diagResults.hint && (
              <p className="text-muted-foreground mt-2 p-2 bg-muted rounded text-xs leading-relaxed">{diagResults.hint}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ScheduleEventDialog({
  open,
  onOpenChange,
  contactName,
  conversationId,
}: ScheduleEventDialogProps) {
  const { isConnected, checkingConnection, connect, connecting, createEvent, creating } = useGoogleCalendar();

  const [title, setTitle] = useState(`Reunião com ${contactName}`);
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("30");
  const [description, setDescription] = useState("");
  const [includeMeet, setIncludeMeet] = useState(true);

  const handleSubmit = async () => {
    if (!title.trim() || !date || !time) return;

    const [hours, minutes] = time.split(":").map(Number);
    const startDatetime = new Date(date);
    startDatetime.setHours(hours, minutes, 0, 0);

    await createEvent({
      title: title.trim(),
      start_datetime: startDatetime.toISOString(),
      duration_minutes: parseInt(duration),
      description: description.trim() || undefined,
      include_meet: includeMeet,
      conversation_id: conversationId,
      contact_name: contactName,
    });

    onOpenChange(false);
    // Reset form
    setTitle(`Reunião com ${contactName}`);
    setDate(undefined);
    setTime("09:00");
    setDuration("30");
    setDescription("");
    setIncludeMeet(true);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarPlus className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Agendar Reunião</DialogTitle>
              <DialogDescription>
                com {contactName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {checkingConnection ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !isConnected ? (
          <NotConnectedPane connect={connect} connecting={connecting} />
        ) : (
          <>
            <div className="space-y-4 py-2">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="event-title">Título do evento</Label>
                <Input
                  id="event-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Reunião de apresentação"
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Data</Label>
                <Popover modal={false}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !date && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, "PPP", { locale: ptBR }) : "Selecione a data"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 pointer-events-auto z-[200]" align="start">
                    <Calendar
                      mode="single"
                      selected={date}
                      onSelect={setDate}
                      disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time + Duration row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Horário</Label>
                  <Select value={time} onValueChange={setTime}>
                    <SelectTrigger>
                      <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-60 z-[200]">
                      {TIME_OPTIONS.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Duração</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[200]">
                      {DURATION_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="event-desc">Descrição (opcional)</Label>
                <Textarea
                  id="event-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Notas ou pauta da reunião..."
                  rows={2}
                />
              </div>

              {/* Google Meet toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border p-3">
                <div className="flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Google Meet</p>
                    <p className="text-xs text-muted-foreground">Criar link de videoconferência</p>
                  </div>
                </div>
                <Switch checked={includeMeet} onCheckedChange={setIncludeMeet} />
              </div>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={creating}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={creating || !title.trim() || !date || !time}
                className="gap-2"
              >
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
                {creating ? "Agendando..." : "Agendar"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
