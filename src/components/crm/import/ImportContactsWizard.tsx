import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useImportContacts, type WizardStep } from "@/hooks/useImportContacts";
import { ImportStepUpload } from "./ImportStepUpload";
import { ImportStepMapping } from "./ImportStepMapping";
import { ImportStepConfig } from "./ImportStepConfig";
import { ImportStepPreview } from "./ImportStepPreview";
import { ImportStepExecute } from "./ImportStepExecute";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organizationId: string;
}

const STEPS = [
  { num: 1, label: "Upload" },
  { num: 2, label: "Mapeamento" },
  { num: 3, label: "Configuração" },
  { num: 4, label: "Preview" },
  { num: 5, label: "Execução" },
] as const;

export function ImportContactsWizard({ open, onOpenChange, organizationId }: Props) {
  const qc = useQueryClient();
  const {
    draft,
    hydrated,
    setStep,
    setFileData,
    setMapping,
    setConfig,
    reset,
  } = useImportContacts(organizationId);

  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  const canGoNext = useMemo(() => {
    if (draft.step === 1) return !!draft.fileData;
    if (draft.step === 2) {
      const vals = Object.values(draft.mapping);
      return vals.includes("name") && vals.includes("phone");
    }
    if (draft.step === 3) return true;
    if (draft.step === 4) return true;
    return false;
  }, [draft]);

  const handleNext = () => {
    if (draft.step < 5) setStep((draft.step + 1) as WizardStep);
  };
  const handleBack = () => {
    if (draft.step > 1) setStep((draft.step - 1) as WizardStep);
  };

  const handleClose = () => onOpenChange(false);

  const handleFinishAndClose = () => {
    qc.invalidateQueries({ queryKey: ["crm-all-contacts"] });
    qc.invalidateQueries({ queryKey: ["kanban-contacts"] });
    reset();
    onOpenChange(false);
  };

  useEffect(() => {
    if (!open && draft.step === 5) {
      reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!hydrated) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Importar contatos</DialogTitle>
          <DialogDescription>
            Importe planilhas Excel ou CSV com mapeamento, validação e deduplicação.
          </DialogDescription>
        </DialogHeader>

        {/* Stepper */}
        <div className="flex items-center justify-between px-2 py-3 border-y border-border/30">
          {STEPS.map((s, i) => {
            const active = draft.step === s.num;
            const done = draft.step > s.num;
            return (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex items-center gap-2">
                  <div
                    className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : done
                        ? "bg-emerald-500 text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {s.num}
                  </div>
                  <span
                    className={`text-xs font-medium ${
                      active ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    className={`flex-1 h-px mx-2 ${
                      done ? "bg-emerald-500" : "bg-border/30"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <div className="flex-1 overflow-y-auto quantum-scrollbar py-4">
          {draft.step === 1 && (
            <ImportStepUpload
              fileData={draft.fileData}
              onFileLoaded={setFileData}
              onClear={() => setFileData(null)}
            />
          )}
          {draft.step === 2 && draft.fileData && (
            <ImportStepMapping
              fileData={draft.fileData}
              mapping={draft.mapping}
              onChange={setMapping}
            />
          )}
          {draft.step === 3 && (
            <ImportStepConfig
              organizationId={organizationId}
              config={draft.config}
              onChange={setConfig}
            />
          )}
          {draft.step === 4 && draft.fileData && (
            <ImportStepPreview
              organizationId={organizationId}
              fileData={draft.fileData}
              mapping={draft.mapping}
              config={draft.config}
            />
          )}
          {draft.step === 5 && draft.fileData && userId && (
            <ImportStepExecute
              organizationId={organizationId}
              userId={userId}
              fileData={draft.fileData}
              mapping={draft.mapping}
              config={draft.config}
              onComplete={() => {
                qc.invalidateQueries({ queryKey: ["crm-all-contacts"] });
                qc.invalidateQueries({ queryKey: ["kanban-contacts"] });
              }}
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border/30 pt-3">
          <Button
            variant="ghost"
            onClick={draft.step === 5 ? handleFinishAndClose : handleClose}
          >
            <X className="h-4 w-4 mr-1" />
            {draft.step === 5 ? "Fechar" : "Cancelar"}
          </Button>
          <div className="flex gap-2">
            {draft.step > 1 && draft.step < 5 && (
              <Button variant="outline" onClick={handleBack}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Voltar
              </Button>
            )}
            {draft.step < 5 && (
              <Button onClick={handleNext} disabled={!canGoNext}>
                {draft.step === 4 ? "Iniciar importação" : "Avançar"}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
