import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import {
  type ColumnMapping,
  type FileData,
  type ImportConfig,
  processRow,
} from "@/hooks/useImportContacts";

interface Props {
  organizationId: string;
  fileData: FileData;
  mapping: ColumnMapping;
  config: ImportConfig;
}

export function ImportStepPreview({
  organizationId,
  fileData,
  mapping,
  config,
}: Props) {
  // Process ALL rows to compute summary, but only show first 10
  const processed = useMemo(
    () =>
      fileData.rows.map((row, i) =>
        processRow(row, fileData.headers, mapping, i, config.default_country_code)
      ),
    [fileData, mapping, config.default_country_code]
  );

  const validPhones = useMemo(
    () =>
      Array.from(
        new Set(
          processed
            .filter((p) => p.phone && p.errors.length === 0)
            .map((p) => p.phone as string)
        )
      ),
    [processed]
  );

  const { data: existingPhones, isLoading: checkingDup } = useQuery({
    queryKey: ["import-dup-check", organizationId, validPhones.slice(0, 500)],
    queryFn: async () => {
      if (validPhones.length === 0) return new Set<string>();
      const sample = validPhones.slice(0, 500);
      const { data } = await supabase
        .from("contacts")
        .select("phone")
        .eq("organization_id", organizationId)
        .eq("channel", "whatsapp")
        .in("phone", sample);
      return new Set((data || []).map((c) => c.phone as string));
    },
    enabled: !!organizationId && validPhones.length > 0,
  });

  const summary = useMemo(() => {
    let valid = 0;
    let dup = 0;
    let err = 0;
    processed.forEach((p) => {
      if (p.errors.length > 0) {
        err++;
      } else if (p.phone && existingPhones?.has(p.phone)) {
        dup++;
      } else {
        valid++;
      }
    });
    return { valid, dup, err };
  }, [processed, existingPhones]);

  const preview = processed.slice(0, 10);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-center">
          <div className="text-2xl font-bold font-mono text-emerald-500">
            {summary.valid}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Válidos
          </div>
        </div>
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-center">
          <div className="text-2xl font-bold font-mono text-amber-500">
            {summary.dup}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Duplicatas
          </div>
        </div>
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-center">
          <div className="text-2xl font-bold font-mono text-destructive">
            {summary.err}
          </div>
          <div className="text-xs text-muted-foreground uppercase tracking-wide">
            Com erro
          </div>
        </div>
      </div>

      <div className="text-xs text-muted-foreground">
        Mostrando primeiras 10 linhas de {fileData.rows.length}.
        {config.dedupe_strategy === "update" && summary.dup > 0 && (
          <span className="text-amber-500"> Duplicatas serão atualizadas.</span>
        )}
        {config.dedupe_strategy === "skip" && summary.dup > 0 && (
          <span className="text-amber-500"> Duplicatas serão ignoradas.</span>
        )}
      </div>

      {checkingDup ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <TooltipProvider>
          <div className="rounded-md border border-border/50 overflow-auto quantum-scrollbar max-h-[400px]">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="px-2 py-2 text-left w-8"></th>
                  <th className="px-2 py-2 text-left">Linha</th>
                  <th className="px-2 py-2 text-left">Nome</th>
                  <th className="px-2 py-2 text-left">Telefone</th>
                  <th className="px-2 py-2 text-left">E-mail</th>
                  <th className="px-2 py-2 text-left">Tags</th>
                </tr>
              </thead>
              <tbody>
                {preview.map((row) => {
                  const isError = row.errors.length > 0;
                  const isDup =
                    !isError && row.phone && existingPhones?.has(row.phone);
                  const reason = isError
                    ? row.errors.join(" · ")
                    : isDup
                    ? config.dedupe_strategy === "update"
                      ? "Já existe — será atualizado"
                      : config.dedupe_strategy === "skip"
                      ? "Já existe — será ignorado"
                      : "Já existe — será criado novo"
                    : "Válido";

                  const Icon = isError
                    ? XCircle
                    : isDup
                    ? AlertTriangle
                    : CheckCircle2;
                  const color = isError
                    ? "text-destructive"
                    : isDup
                    ? "text-amber-500"
                    : "text-emerald-500";

                  return (
                    <tr
                      key={row.rowIndex}
                      className={`border-t border-border/30 ${
                        isError
                          ? "bg-destructive/5"
                          : isDup
                          ? "bg-amber-500/5"
                          : ""
                      }`}
                    >
                      <td className="px-2 py-1.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Icon className={`h-4 w-4 ${color}`} />
                          </TooltipTrigger>
                          <TooltipContent>{reason}</TooltipContent>
                        </Tooltip>
                      </td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">
                        {row.rowIndex + 2}
                      </td>
                      <td className="px-2 py-1.5">{row.name || "—"}</td>
                      <td className="px-2 py-1.5 font-mono">
                        {row.phone || "—"}
                      </td>
                      <td className="px-2 py-1.5">{row.email || "—"}</td>
                      <td className="px-2 py-1.5">
                        {row.tags.length > 0 ? (
                          <div className="flex gap-1 flex-wrap">
                            {row.tags.slice(0, 3).map((t) => (
                              <Badge
                                key={t}
                                variant="outline"
                                className="text-xs py-0 px-1"
                              >
                                {t}
                              </Badge>
                            ))}
                          </div>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
