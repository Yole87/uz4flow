import { useRef, useState } from "react";
import { Download, Upload, Code2, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FlowVariablesDialog } from "./FlowVariablesDialog";
import {
  exportFlow,
  downloadJson,
  validateImport,
  importFlowSteps,
  type FlowExportData,
} from "./FlowImportExport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface FlowStep {
  id: string;
  order_index: number;
  step_type: string;
  text_content: string | null;
  requires_response: boolean;
  variable_name: string | null;
}

interface FlowToolbarProps {
  flowId: string;
  flowName: string;
  steps: FlowStep[];
  onImportComplete: () => void;
  onTestFlow: () => void;
  isTesting: boolean;
}

export function FlowToolbar({
  flowId,
  flowName,
  steps,
  onImportComplete,
  onTestFlow,
  isTesting,
}: FlowToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [variablesOpen, setVariablesOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importData, setImportData] = useState<FlowExportData | null>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = async () => {
    try {
      setExporting(true);
      const data = await exportFlow(flowId);
      if (!data) {
        toast.error("Erro ao exportar fluxo");
        return;
      }
      const safeName = flowName.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase();
      downloadJson(data, `fluxo-${safeName}.json`);
      toast.success("Fluxo exportado!");
    } catch {
      toast.error("Erro ao exportar");
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = JSON.parse(evt.target?.result as string);
        if (!validateImport(data)) {
          toast.error("Arquivo inválido. Use um JSON exportado pelo sistema.");
          return;
        }
        setImportData(data);
        setImportDialogOpen(true);
      } catch {
        toast.error("Erro ao ler o arquivo JSON");
      }
    };
    reader.readAsText(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  };

  const handleImport = async (mode: "replace" | "merge") => {
    if (!importData) return;
    try {
      setImporting(true);
      const success = await importFlowSteps(flowId, importData, mode);
      if (success) {
        toast.success(mode === "replace" ? "Fluxo substituído!" : "Steps mesclados!");
        onImportComplete();
      } else {
        toast.error("Erro ao importar fluxo");
      }
    } finally {
      setImporting(false);
      setImportDialogOpen(false);
      setImportData(null);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1.5" />
          Importar
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={handleFileSelect}
        />

        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting || steps.length === 0}
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1.5" />
          )}
          Exportar
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={() => setVariablesOpen(true)}
          title="Variáveis do fluxo"
        >
          <Code2 className="h-4 w-4" />
        </Button>

        <Button
          variant="default"
          size="sm"
          onClick={onTestFlow}
          disabled={isTesting || steps.length === 0}
        >
          {isTesting ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Play className="h-4 w-4 mr-1.5" />
          )}
          Testar
        </Button>
      </div>

      <FlowVariablesDialog
        open={variablesOpen}
        onOpenChange={setVariablesOpen}
        steps={steps}
      />

      {/* Import mode dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Importar Fluxo</DialogTitle>
            <DialogDescription>
              {importData && (
                <>
                  <strong>{importData.flow.name}</strong> — {importData.steps.length} etapa(s),{" "}
                  {importData.connections.length} conexão(ões)
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col gap-2 sm:flex-col">
            <Button
              onClick={() => handleImport("replace")}
              disabled={importing}
              variant="destructive"
              className="w-full"
            >
              {importing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Substituir tudo
            </Button>
            <Button
              onClick={() => handleImport("merge")}
              disabled={importing}
              variant="outline"
              className="w-full"
            >
              {importing && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              Mesclar (adicionar)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
