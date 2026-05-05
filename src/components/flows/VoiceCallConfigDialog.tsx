import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Loader2, Phone, Variable } from "lucide-react";

export interface VoiceCallConfig {
  label?: string;
  script: string;
  voice_id: string;
  max_duration_seconds: number;
  allowed_hours: { start: string; end: string; tz: string };
  max_attempts: number;
  retry_interval_minutes: number;
}

const DEFAULT_VOICES = [
  { id: "pFZP5JQG7iQjIQuC4Bku", label: "Lily (pt-BR feminina)" },
  { id: "XB0fDUnXU5powFXDhCwa", label: "Charlotte (pt-BR feminina)" },
  { id: "Xb7hH8MSUJpSbSDYk0k2", label: "Alice (pt-BR feminina)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", label: "Liam (pt-BR masculina)" },
  { id: "iP95p4xoKVk53GoZ742B", label: "Chris (pt-BR masculina)" },
];

const DURATION_PRESETS = [
  { value: 30, label: "30 segundos" },
  { value: 60, label: "1 minuto" },
  { value: 120, label: "2 minutos" },
  { value: 300, label: "5 minutos" },
];

const ATTEMPT_OPTIONS = [
  { value: "1", label: "1 tentativa" },
  { value: "2", label: "2 tentativas" },
  { value: "3", label: "3 tentativas" },
];

const RETRY_INTERVAL_OPTIONS = [
  { value: "5", label: "5 minutos" },
  { value: "30", label: "30 minutos" },
  { value: "60", label: "1 hora" },
  { value: "240", label: "4 horas" },
];

const VARIABLE_CHIPS = [
  "{{contact.name}}",
  "{{contact.phone}}",
  "{{org.name}}",
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialConfig: VoiceCallConfig | null;
  onSave: (cfg: VoiceCallConfig) => Promise<void> | void;
  saving?: boolean;
}

export function VoiceCallConfigDialog({ open, onOpenChange, initialConfig, onSave, saving }: Props) {
  const [label, setLabel] = useState("");
  const [script, setScript] = useState("");
  const [voiceId, setVoiceId] = useState(DEFAULT_VOICES[0].id);
  const [maxDuration, setMaxDuration] = useState(120);
  const [allowedStart, setAllowedStart] = useState("09:00");
  const [allowedEnd, setAllowedEnd] = useState("18:00");
  const [tz, setTz] = useState("America/Sao_Paulo");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [retryInterval, setRetryInterval] = useState("60");

  useEffect(() => {
    if (!open) return;
    setLabel(initialConfig?.label || "");
    setScript(initialConfig?.script || "");
    setVoiceId(initialConfig?.voice_id || DEFAULT_VOICES[0].id);
    setMaxDuration(initialConfig?.max_duration_seconds || 120);
    setAllowedStart(initialConfig?.allowed_hours?.start || "09:00");
    setAllowedEnd(initialConfig?.allowed_hours?.end || "18:00");
    setTz(initialConfig?.allowed_hours?.tz || "America/Sao_Paulo");
    setMaxAttempts(String(initialConfig?.max_attempts || 1));
    setRetryInterval(String(initialConfig?.retry_interval_minutes || 60));
  }, [open, initialConfig]);

  const insertVariable = (v: string) => {
    setScript((prev) => prev + (prev.endsWith(" ") || prev.length === 0 ? "" : " ") + v);
  };

  const handleSave = async () => {
    await onSave({
      label: label.trim() || undefined,
      script: script.trim(),
      voice_id: voiceId,
      max_duration_seconds: maxDuration,
      allowed_hours: { start: allowedStart, end: allowedEnd, tz },
      max_attempts: parseInt(maxAttempts, 10),
      retry_interval_minutes: parseInt(retryInterval, 10),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-fuchsia-400" />
            Configurar Chamada Voice AI
          </DialogTitle>
          <DialogDescription>
            Defina o script, a voz e o comportamento de retentativas da ligação automatizada.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="script" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="script">Script</TabsTrigger>
            <TabsTrigger value="voice">Voz e duração</TabsTrigger>
            <TabsTrigger value="schedule">Horário e retentativas</TabsTrigger>
          </TabsList>

          <TabsContent value="script" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Nome do nó (opcional)</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Ex: Ligação de qualificação"
                maxLength={60}
              />
            </div>

            <div className="space-y-2">
              <Label>Script / Prompt da IA</Label>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Olá {{contact.name}}, aqui é da {{org.name}}..."
                rows={8}
                className="resize-none"
              />
              <div className="flex flex-wrap items-center gap-1.5">
                <Variable className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground mr-1">Inserir:</span>
                {VARIABLE_CHIPS.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVariable(v)}
                    className="text-xs font-mono px-1.5 py-0.5 rounded bg-muted/60 hover:bg-muted text-foreground/80 hover:text-foreground transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="voice" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Voz</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DEFAULT_VOICES.map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Duração máxima da ligação</Label>
                <span className="text-sm font-mono text-fuchsia-400">
                  {maxDuration < 60 ? `${maxDuration}s` : `${Math.round(maxDuration / 60)}min`}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {DURATION_PRESETS.map((p) => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setMaxDuration(p.value)}
                    className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                      maxDuration === p.value
                        ? "border-fuchsia-500 bg-fuchsia-500/10 text-fuchsia-400"
                        : "border-border bg-muted/30 text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="schedule" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Horário permitido para ligar</Label>
              <div className="flex items-center gap-2">
                <Input type="time" value={allowedStart} onChange={(e) => setAllowedStart(e.target.value)} className="w-32" />
                <span className="text-sm text-muted-foreground">até</span>
                <Input type="time" value={allowedEnd} onChange={(e) => setAllowedEnd(e.target.value)} className="w-32" />
                <span className="text-xs text-muted-foreground ml-2">({tz})</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Ligações fora desse horário serão reagendadas para o próximo período permitido.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tentativas máximas</Label>
                <Select value={maxAttempts} onValueChange={setMaxAttempts}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ATTEMPT_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Intervalo entre tentativas</Label>
                <Select value={retryInterval} onValueChange={setRetryInterval}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {RETRY_INTERVAL_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="rounded-md bg-muted/40 border border-border/40 p-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Variáveis disponíveis após a ligação:</strong> {" "}
              <code className="text-fuchsia-400">{"{{voice.transcript}}"}</code>,{" "}
              <code className="text-fuchsia-400">{"{{voice.duration}}"}</code>,{" "}
              <code className="text-fuchsia-400">{"{{voice.outcome}}"}</code>,{" "}
              <code className="text-fuchsia-400">{"{{voice.summary}}"}</code>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving || !script.trim()}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Salvar configuração
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
