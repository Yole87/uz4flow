import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Download, Ban } from "lucide-react";
import { toast } from "sonner";
import {
  type ColumnMapping,
  type FileData,
  type ImportConfig,
  processRow,
} from "@/hooks/useImportContacts";

const CHUNK_SIZE = 100;

interface ResultsAcc {
  created: number;
  updated: number;
  skipped: number;
  errors: { row_index: number; reason: string }[];
}

interface Props {
  organizationId: string;
  userId: string;
  fileData: FileData;
  mapping: ColumnMapping;
  config: ImportConfig;
  onComplete: () => void;
}

export function ImportStepExecute({
  organizationId,
  userId,
  fileData,
  mapping,
  config,
  onComplete,
}: Props) {
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ResultsAcc>({
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  });
  const [phase, setPhase] = useState<"running" | "done" | "cancelled" | "failed">(
    "running"
  );
  const [importId, setImportId] = useState<string | null>(null);
  const cancelRef = useRef(false);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async () => {
    const total = fileData.rows.length;
    const processed = fileData.rows.map((row, i) =>
      processRow(row, fileData.headers, mapping, i, config.default_country_code)
    );

    // Create history entry
    const { data: hist, error: histErr } = await supabase
      .from("contact_import_history")
      .insert({
        organization_id: organizationId,
        user_id: userId,
        file_name: fileData.fileName,
        file_size_bytes: fileData.fileSize,
        total_rows: total,
        mapping_jsonb: mapping as never,
        config_jsonb: config as never,
        status: "processing",
      })
      .select("id")
      .maybeSingle();

    if (histErr || !hist) {
      toast.error("Erro ao registrar importação");
      setPhase("failed");
      return;
    }
    setImportId(hist.id);

    const acc: ResultsAcc = { created: 0, updated: 0, skipped: 0, errors: [] };

    for (let start = 0; start < total; start += CHUNK_SIZE) {
      if (cancelRef.current) {
        await supabase
          .from("contact_import_history")
          .update({
            status: "cancelled",
            finished_at: new Date().toISOString(),
            created_count: acc.created,
            updated_count: acc.updated,
            skipped_count: acc.skipped,
            error_count: acc.errors.length,
            errors_jsonb: acc.errors as never,
          })
          .eq("id", hist.id);
        setPhase("cancelled");
        return;
      }

      const chunk = processed.slice(start, start + CHUNK_SIZE);
      const isLast = start + CHUNK_SIZE >= total;

      try {
        const { data, error } = await supabase.functions.invoke(
          "bulk-import-contacts",
          {
            body: {
              import_id: hist.id,
              organization_id: organizationId,
              rows: chunk,
              config,
              is_last_chunk: isLast,
            },
          }
        );

        if (error || !data) {
          throw new Error(error?.message || "Falha no servidor");
        }

        const r = data as {
          created: number;
          updated: number;
          skipped: number;
          errors: { row_index: number; reason: string }[];
          cancelled?: boolean;
        };

        if (r.cancelled) {
          setPhase("cancelled");
          return;
        }

        acc.created += r.created;
        acc.updated += r.updated;
        acc.skipped += r.skipped;
        acc.errors.push(...r.errors);
        setResults({ ...acc });
        setProgress(Math.min(100, Math.round(((start + chunk.length) / total) * 100)));
      } catch (err) {
        acc.errors.push({
          row_index: start,
          reason: err instanceof Error ? err.message : "Erro desconhecido",
        });
        setResults({ ...acc });
      }
    }

    setProgress(100);
    setPhase("done");
    onComplete();
  };

  const handleCancel = async () => {
    cancelRef.current = true;
    if (importId) {
      try {
        await supabase.functions.invoke("bulk-import-contacts", {
          body: { action: "cancel", import_id: importId },
        });
      } catch {
        // ignore
      }
    }
  };

  const downloadErrorReport = () => {
    if (results.errors.length === 0) return;
    const header = "linha,motivo\n";
    const body = results.errors
      .map((e) => `${e.row_index + 2},"${e.reason.replace(/"/g, '""')}"`)
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `erros-importacao-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-mono text-xs">
            {phase === "running" && (
              <Loader2 className="inline h-3 w-3 mr-2 animate-spin" />
            )}
            {Math.round((progress / 100) * fileData.rows.length)} de{" "}
            {fileData.rows.length} processado(s)
          </span>
          <span className="font-mono font-bold">{progress}%</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Criados" value={results.created} variant="success" />
        <StatCard label="Atualizados" value={results.updated} variant="info" />
        <StatCard label="Ignorados" value={results.skipped} variant="muted" />
      </div>

      {results.errors.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm flex items-center justify-between">
          <span>
            <XCircle className="inline h-4 w-4 mr-2 text-destructive" />
            {results.errors.length} linha(s) com erro
          </span>
          <Button size="sm" variant="outline" onClick={downloadErrorReport}>
            <Download className="h-4 w-4 mr-1" />
            Baixar relatório
          </Button>
        </div>
      )}

      {phase === "done" && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-center space-y-1">
          <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
          <p className="font-medium">Importação concluída</p>
          <p className="text-xs text-muted-foreground">
            {results.created} criado(s) · {results.updated} atualizado(s) ·{" "}
            {results.skipped} ignorado(s)
          </p>
        </div>
      )}

      {phase === "cancelled" && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-center space-y-1">
          <Ban className="h-8 w-8 mx-auto text-amber-500" />
          <p className="font-medium">Importação cancelada</p>
          <p className="text-xs text-muted-foreground">
            Linhas já processadas foram mantidas.
          </p>
        </div>
      )}

      {phase === "running" && (
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={handleCancel}>
            <Ban className="h-4 w-4 mr-1" />
            Cancelar importação
          </Button>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant: "success" | "info" | "muted";
}) {
  const styles = {
    success: "border-emerald-500/30 bg-emerald-500/5 text-emerald-500",
    info: "border-blue-500/30 bg-blue-500/5 text-blue-500",
    muted: "border-border/50 bg-muted/20 text-muted-foreground",
  }[variant];
  return (
    <div className={`rounded-lg border p-3 text-center ${styles}`}>
      <div className="text-2xl font-bold font-mono">{value}</div>
      <div className="text-xs uppercase tracking-wide">{label}</div>
    </div>
  );
}
