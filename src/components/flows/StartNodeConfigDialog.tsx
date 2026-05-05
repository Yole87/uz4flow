import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, CalendarClock, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ScheduleConfig {
  days?: number;
  weekdays?: number[]; // 0=Dom, 1=Seg...6=Sáb
  hour?: number;
  minute?: number;
}

interface StartNodeConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowId: string;
  initialEnabled: boolean;
  initialType: string | null;
  initialConfig: ScheduleConfig | null;
  onSaved: (enabled: boolean, type: string | null, config: ScheduleConfig | null) => void;
}

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function StartNodeConfigDialog({
  open,
  onOpenChange,
  flowId,
  initialEnabled,
  initialType,
  initialConfig,
  onSaved,
}: StartNodeConfigDialogProps) {
  const [enabled, setEnabled] = useState(false);
  const [scheduleType, setScheduleType] = useState<"after_days" | "weekdays">("weekdays");
  const [days, setDays] = useState(1);
  const [weekdays, setWeekdays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [hour, setHour] = useState(9);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setEnabled(initialEnabled);
      setScheduleType((initialType as "after_days" | "weekdays") || "weekdays");
      setDays(initialConfig?.days ?? 1);
      setWeekdays(initialConfig?.weekdays ?? [1, 2, 3, 4, 5]);
      setHour(initialConfig?.hour ?? 9);
      setMinute(initialConfig?.minute ?? 0);
    }
  }, [open, initialEnabled, initialType, initialConfig]);

  const toggleWeekday = (day: number) => {
    setWeekdays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()
    );
  };

  const handleSave = async () => {
    if (enabled && scheduleType === "weekdays" && weekdays.length === 0) {
      toast.error("Selecione ao menos um dia da semana");
      return;
    }

    try {
      setSaving(true);

      const config: ScheduleConfig = {
        hour,
        minute,
        ...(scheduleType === "after_days" ? { days } : { weekdays }),
      };

      const { error } = await supabase
        .from("flows")
        .update({
          schedule_enabled: enabled,
          schedule_type: enabled ? scheduleType : null,
          schedule_config: enabled ? (config as any) : null,
        })
        .eq("id", flowId);

      if (error) throw error;

      onSaved(enabled, enabled ? scheduleType : null, enabled ? config : null);
      toast.success(enabled ? "Agendamento configurado!" : "Agendamento desativado");
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving schedule:", error);
      toast.error("Erro ao salvar agendamento");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" />
            Início do Fluxo
          </DialogTitle>
          <DialogDescription>
            Configure quando este fluxo será executado automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Enable toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="schedule-enabled" className="font-medium">
                Agendar início do fluxo
              </Label>
              <p className="text-xs text-muted-foreground">
                O fluxo será executado automaticamente no horário configurado
              </p>
            </div>
            <Switch
              id="schedule-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
          </div>

          {enabled && (
            <>
              {/* Schedule type */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Tipo de agendamento</Label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScheduleType("weekdays")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      scheduleType === "weekdays"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">Dias da semana</p>
                    <p className="text-xs text-muted-foreground">Executa em dias específicos</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleType("after_days")}
                    className={`p-3 rounded-lg border text-left transition-all ${
                      scheduleType === "after_days"
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                  >
                    <p className="text-sm font-medium text-foreground">Após X dias</p>
                    <p className="text-xs text-muted-foreground">Executa após intervalo</p>
                  </button>
                </div>
              </div>

              {/* Type-specific config */}
              {scheduleType === "weekdays" ? (
                <div className="space-y-2">
                  <Label className="text-sm">Dias da semana</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {WEEKDAY_LABELS.map((label, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => toggleWeekday(idx)}
                        className={`h-9 w-11 rounded-md text-xs font-medium transition-all ${
                          weekdays.includes(idx)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-sm">Executar a cada</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min={1}
                      max={365}
                      value={days}
                      onChange={(e) => setDays(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-20"
                    />
                    <span className="text-sm text-muted-foreground">dia(s)</span>
                  </div>
                </div>
              )}

              {/* Time picker */}
              <div className="space-y-2">
                <Label className="text-sm flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  Horário de execução
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={23}
                    value={hour.toString().padStart(2, "0")}
                    onChange={(e) => setHour(Math.min(23, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-16 text-center"
                  />
                  <span className="text-lg font-bold text-muted-foreground">:</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={minute.toString().padStart(2, "0")}
                    onChange={(e) => setMinute(Math.min(59, Math.max(0, parseInt(e.target.value) || 0)))}
                    className="w-16 text-center"
                  />
                </div>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function formatScheduleSummary(
  type: string | null,
  config: any | null
): string {
  if (!type || !config) return "";
  const time = `${String(config.hour ?? 0).padStart(2, "0")}:${String(config.minute ?? 0).padStart(2, "0")}`;
  if (type === "weekdays" && config.weekdays) {
    const labels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    const days = (config.weekdays as number[]).map((d) => labels[d]).join(", ");
    return `${days} às ${time}`;
  }
  if (type === "after_days") {
    return `A cada ${config.days} dia(s) às ${time}`;
  }
  return "";
}
