import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { getFormSteps, getFormResponses, getAllFormResponses } from "@/services/uzFormService";
import type { UzFormField, UzFormResponse } from "@/types/uzForm";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, Download, Inbox } from "lucide-react";
import { toast } from "sonner";

interface UzFormResponsesProps {
  formId: string;
  formName: string;
}

const PAGE_SIZE = 50;

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function UzFormResponses({ formId, formName }: UzFormResponsesProps) {
  const [page, setPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);

  // 1. Fetch form steps and fields to dynamically generate columns
  const { data: steps = [], isLoading: isLoadingSteps } = useQuery({
    queryKey: ["uz-form-steps", formId],
    queryFn: () => getFormSteps(formId),
  });

  // Flatten all fields across all steps, ordered by step_order, then field_order
  const orderedFields = useMemo(() => {
    const sortedSteps = [...steps].sort((a, b) => a.step_order - b.step_order);
    const fields: UzFormField[] = [];
    for (const step of sortedSteps) {
      if (step.fields) {
        const sortedFields = [...step.fields].sort((a, b) => a.field_order - b.field_order);
        fields.push(...sortedFields);
      }
    }
    return fields;
  }, [steps]);

  // 2. Fetch paginated responses
  const { data: responsesResult, isLoading: isLoadingResponses } = useQuery({
    queryKey: ["uz-form-responses-tab", formId, page],
    queryFn: () => getFormResponses(formId, page, PAGE_SIZE),
    placeholderData: (prev) => prev,
  });

  const responses = responsesResult?.data ?? [];
  const totalCount = responsesResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // 3. RFC 4180 CSV Export
  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const allResponses = await getAllFormResponses(formId);

      const csvCell = (value: string): string =>
        `"${value.replace(/"/g, '""')}"`;

      // Header row
      const headers = ["Enviado em", ...orderedFields.map((f) => f.label)];
      const headerRow = headers.map(csvCell).join(",");

      // Data rows
      const dataRows = allResponses.map((res) => {
        const submittedAt = formatDateBR(res.submitted_at);
        const cells = [
          submittedAt,
          ...orderedFields.map((field) => res.response_data[field.key_name] ?? ""),
        ];
        return cells.map(csvCell).join(",");
      });

      const csv = [headerRow, ...dataRows].join("\r\n");
      const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
      const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      a.download = `${formName.replace(/[^a-z0-9]/gi, "_")}_respostas_${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Respostas exportadas com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar respostas para CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const isLoading = isLoadingSteps || isLoadingResponses;

  if (isLoading && responses.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (responses.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3 border border-dashed border-border rounded-lg bg-card">
        <Inbox className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground font-medium">Nenhuma resposta recebida ainda.</p>
        <p className="text-xs text-muted-foreground">
          Divulgue seu formulário público para começar a coletar dados.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header action bar */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          Total de <span className="font-semibold text-foreground">{totalCount}</span> resposta
          {totalCount !== 1 ? "s" : ""}
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportCSV}
          disabled={isExporting}
          className="border-border hover:border-accent/50 gap-2"
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar CSV
        </Button>
      </div>

      {/* Responses Data Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="min-w-[150px] font-semibold text-foreground">Enviado em</TableHead>
                {orderedFields.map((field) => (
                  <TableHead key={field.id} className="min-w-[150px] font-semibold text-foreground whitespace-nowrap">
                    {field.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map((res) => (
                <TableRow key={res.id} className="border-border hover:bg-muted/30">
                  <TableCell className="text-xs font-medium whitespace-nowrap">
                    {formatDateBR(res.submitted_at)}
                  </TableCell>
                  {orderedFields.map((field) => (
                    <TableCell key={field.id} className="text-sm max-w-[280px]">
                      {renderCell(field, res.response_data[field.key_name])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3 bg-muted/20">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0}
              onClick={() => setPage(page - 1)}
              className="h-8 border-border"
            >
              Anterior
            </Button>
            <span className="text-xs text-muted-foreground px-2">
              Página {page + 1} de {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(page + 1)}
              className="h-8 border-border"
            >
              Próximo
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
