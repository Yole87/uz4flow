import { useState, useRef, useMemo, useEffect } from "react";
import { format, addMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon, Upload, X, Clock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useScheduledMessages, type ScheduledMessage, type ScheduledMediaType } from "@/hooks/useScheduledMessages";
import { toast } from "sonner";

interface ScheduleMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: string;
  contactId: string;
  organizationId: string;
  instanceId?: string | null;
  existing?: ScheduledMessage | null;
}

function inferMediaType(file: File): ScheduledMediaType {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("audio/")) return "audio";
  if (file.type.startsWith("video/")) return "video";
  return "document";
}

export function ScheduleMessageDialog({
  open,
  onOpenChange,
  conversationId,
  contactId,
  organizationId,
  instanceId,
  existing,
}: ScheduleMessageDialogProps) {
  const { create, update, isCreating, isUpdating } = useScheduledMessages(conversationId);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const minDate = useMemo(() => addMinutes(new Date(), 5), []);

  const [content, setContent] = useState("");
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [time, setTime] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [calendarOpen, setCalendarOpen] = useState(false);

  // Initialize from existing
  useEffect(() => {
    if (open) {
      if (existing) {
        setContent(existing.content || "");
        const d = new Date(existing.scheduled_for);
        setDate(d);
        setTime(format(d, "HH:mm"));
        setFile(null);
      } else {
        setContent("");
        const init = addMinutes(new Date(), 30);
        setDate(init);
        setTime(format(init, "HH:mm"));
        setFile(null);
      }
    }
  }, [open, existing]);

  const isSaving = isCreating || isUpdating;

  const buildScheduledFor = (): Date | null => {
    if (!date || !time) return null;
    const [hh, mm] = time.split(":").map(Number);
    if (Number.isNaN(hh) || Number.isNaN(mm)) return null;
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d;
  };

  const handleSave = async () => {
    const scheduledFor = buildScheduledFor();
    if (!scheduledFor) {
      toast.error("Escolha data e horário");
      return;
    }
    if (scheduledFor.getTime() < minDate.getTime()) {
      toast.error("Agende para pelo menos 5 minutos no futuro");
      return;
    }
    if (!content.trim() && !file && !existing?.media_url) {
      toast.error("Escreva uma mensagem ou anexe um arquivo");
      return;
    }

    try {
      if (existing) {
        await update({
          id: existing.id,
          content: content.trim(),
          scheduled_for: scheduledFor.toISOString(),
        });
      } else {
        await create({
          conversation_id: conversationId,
          contact_id: contactId,
          organization_id: organizationId,
          instance_id: instanceId,
          content: content.trim() || undefined,
          scheduled_for: scheduledFor.toISOString(),
          file: file || undefined,
          media_type: file ? inferMediaType(file) : undefined,
        });
      }
      onOpenChange(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden quantum-scrollbar">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-accent" />
            {existing ? "Editar agendamento" : "Agendar mensagem"}
          </DialogTitle>
          <DialogDescription>
            A mensagem será enviada automaticamente no horário definido.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="schedule-content">Mensagem</Label>
            <Textarea
              id="schedule-content"
              placeholder="Escreva a mensagem que será enviada…"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
            />
          </div>

          {!existing && (
            <div className="space-y-2">
              <Label>Anexo (opcional)</Label>
              <div className="flex items-center gap-2 min-w-0 w-full">
                <Button
                  type="button"
                  variant="outline"
                  className="min-w-0 flex-1 justify-start overflow-hidden"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-4 w-4 mr-2 shrink-0" />
                  <span className="truncate block min-w-0 flex-1 text-left">
                    {file ? file.name : "Selecionar arquivo (imagem, áudio, vídeo, doc)"}
                  </span>
                </Button>
                {file && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0"
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,audio/*,video/*,.pdf,.docx,.xlsx,.pptx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (f.size > 16 * 1024 * 1024) {
                      toast.error("Arquivo excede 16MB");
                      return;
                    }
                    setFile(f);
                  }}
                />
              </div>
              {file && (
                <p className="text-xs text-muted-foreground truncate">
                  {(file.size / 1024).toFixed(0)} KB · {file.type || "desconhecido"}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Data</Label>
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : "Escolha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setCalendarOpen(false);
                    }}
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-2">
              <Label htmlFor="schedule-time">Horário</Label>
              <Input
                id="schedule-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            Mínimo: {format(minDate, "dd/MM HH:mm", { locale: ptBR })}.
          </p>
        </div>

        <DialogFooter className="sticky bottom-0 bg-background pt-3 mt-2 border-t border-border">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Salvando…" : existing ? "Salvar" : "Agendar envio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
