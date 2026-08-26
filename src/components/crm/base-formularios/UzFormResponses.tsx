import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { getFormSteps, getFormResponses, getAllFormResponses, deleteFormResponses } from "@/services/uzFormService";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Download, Inbox, MessageCircle, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Filter, ExternalLink } from "lucide-react";
import { toast } from "sonner";

interface UzFormResponsesProps {
  formId: string;
  formName: string;
}

const PAGE_SIZE = 50;

/** Detecta valores que são links (ex.: arquivos enviados no formulário). */
function isUrlValue(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function isResponseNew(res: UzFormResponse): boolean {
  const diff = Date.now() - new Date(res.submitted_at).getTime();
  return diff > 0 && diff < 24 * 60 * 60 * 1000;
}

const PHONE_KEYS_LOWER = ["whatsapp", "telefone", "phone", "celular"];

function getPhoneFromResponse(res: UzFormResponse, orderedFields: UzFormField[]): string | null {
  for (const field of orderedFields) {
    const isPhoneField = field.field_type === "phone" || 
      PHONE_KEYS_LOWER.some((pk) => field.key_name.toLowerCase().includes(pk));
    
    if (isPhoneField) {
      const value = res.response_data[field.key_name];
      if (value && value.trim() !== "") {
        const digits = value.replace(/\D/g, "");
        if (digits) {
          return digits.startsWith("55") ? digits : `55${digits}`;
        }
      }
    }
  }
  return null;
}

export function UzFormResponses({ formId, formName }: UzFormResponsesProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [globalSearch, setGlobalSearch] = useState("");
  const [seenIds, setSeenIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(`seen_form_responses_${formId}`);
      return stored ? new Set(JSON.parse(stored)) : new Set<string>();
    } catch {
      return new Set<string>();
    }
  });

  // Load seen IDs when formId changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`seen_form_responses_${formId}`);
      setSeenIds(stored ? new Set(JSON.parse(stored)) : new Set<string>());
    } catch {
      setSeenIds(new Set<string>());
    }
  }, [formId]);

  // Reset selection on page or formId change
  useEffect(() => {
    setSelectedIds([]);
  }, [page, formId]);

  // Update last visit timestamp when viewing
  useEffect(() => {
    localStorage.setItem(`last_visit_form_${formId}`, new Date().toISOString());
  }, [formId]);

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
    queryKey: ["uz-form-responses-tab", formId, page, sortColumn === "submitted_at" ? sortOrder : null],
    queryFn: () => getFormResponses(formId, page, PAGE_SIZE, sortColumn === "submitted_at" ? (sortOrder ?? undefined) : undefined),
    placeholderData: (prev) => prev,
  });

  const responses = responsesResult?.data ?? [];
  const totalCount = responsesResult?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const isAnyFilterActive = useMemo(() => {
    for (const [key, value] of Object.entries(filters)) {
      if (key === "submitted_at") {
        if (value?.from || value?.to) return true;
      } else if (Array.isArray(value)) {
        if (value.length > 0) return true;
      } else if (typeof value === "string" && value.trim() !== "") {
        return true;
      }
    }
    return false;
  }, [filters]);

  const isFilterActive = (colKey: string) => {
    const val = filters[colKey];
    if (!val) return false;
    if (colKey === "submitted_at") {
      return !!(val.from || val.to);
    }
    if (Array.isArray(val)) {
      return val.length > 0;
    }
    return typeof val === "string" && val.trim() !== "";
  };

  const filteredResponses = useMemo(() => {
    let result = [...responses];

    // Global Search
    if (globalSearch && globalSearch.trim() !== "") {
      const searchLower = globalSearch.toLowerCase().trim();
      result = result.filter((res) => {
        return Object.values(res.response_data).some((val) =>
          val && String(val).toLowerCase().includes(searchLower)
        );
      });
    }

    // Column Filters
    for (const [colKey, filterVal] of Object.entries(filters)) {
      if (!filterVal) continue;

      if (colKey === "submitted_at") {
        const { from, to } = filterVal;
        if (from || to) {
          result = result.filter((res) => {
            const resDate = new Date(res.submitted_at);
            if (from) {
              const [y, m, d] = from.split('-').map(Number);
              const fromDate = new Date(y, m - 1, d, 0, 0, 0, 0);
              if (resDate < fromDate) return false;
            }
            if (to) {
              const [y, m, d] = to.split('-').map(Number);
              const toDate = new Date(y, m - 1, d, 23, 59, 59, 999);
              if (resDate > toDate) return false;
            }
            return true;
          });
        }
      } else {
        const column = orderedFields.find((c) => c.key_name === colKey);
        if (!column) continue;

        if (column.field_type === "multiple_choice" || column.field_type === "select_list") {
          const selectedOptions = filterVal as string[];
          if (selectedOptions.length > 0) {
            result = result.filter((res) => {
              const val = res.response_data[colKey] ?? "";
              return selectedOptions.includes(val);
            });
          }
        } else if (column.field_type === "date") {
          const { from, to } = filterVal;
          if (from || to) {
            result = result.filter((res) => {
              const val = res.response_data[colKey];
              if (!val) return false;
              const resDate = new Date(val);
              if (isNaN(resDate.getTime())) return false;
              if (from) {
                const [y, m, d] = from.split('-').map(Number);
                const fromDate = new Date(y, m - 1, d, 0, 0, 0, 0);
                if (resDate < fromDate) return false;
              }
              if (to) {
                const [y, m, d] = to.split('-').map(Number);
                const toDate = new Date(y, m - 1, d, 23, 59, 59, 999);
                if (resDate > toDate) return false;
              }
              return true;
            });
          }
        } else if (column.field_type === "file_upload") {
          const fileFilter = filterVal as string;
          result = result.filter((res) => {
            const val = res.response_data[colKey];
            const hasFile = val && val.trim() !== "";
            if (fileFilter === "has_file") return hasFile;
            if (fileFilter === "no_file") return !hasFile;
            return true;
          });
        } else {
          const searchStr = (filterVal as string).toLowerCase().trim();
          if (searchStr !== "") {
            result = result.filter((res) => {
              const val = (res.response_data[colKey] ?? "").toLowerCase();
              return val.includes(searchStr);
            });
          }
        }
      }
    }

    // Dynamic Columns Sorting (client-side)
    if (sortColumn && sortColumn !== "submitted_at" && sortOrder) {
      result.sort((a, b) => {
        const valA = a.response_data[sortColumn] ?? "";
        const valB = b.response_data[sortColumn] ?? "";
        const comp = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });
        return sortOrder === "asc" ? comp : -comp;
      });
    }

    return result;
  }, [responses, globalSearch, filters, sortColumn, sortOrder, orderedFields]);

  // Mark visible responses as seen after 3 seconds
  useEffect(() => {
    if (filteredResponses.length === 0) return;

    const timer = setTimeout(() => {
      setSeenIds((prev) => {
        const next = new Set(prev);
        let changed = false;
        for (const res of filteredResponses) {
          if (!next.has(res.id)) {
            next.add(res.id);
            changed = true;
          }
        }
        if (changed) {
          localStorage.setItem(`seen_form_responses_${formId}`, JSON.stringify(Array.from(next)));
          return next;
        }
        return prev;
      });
    }, 3000);

    return () => clearTimeout(timer);
  }, [filteredResponses, formId]);

  const handleSort = (colKey: string) => {
    if (sortColumn !== colKey) {
      setSortColumn(colKey);
      setSortOrder("asc");
    } else {
      if (sortOrder === "asc") {
        setSortOrder("desc");
      } else if (sortOrder === "desc") {
        setSortColumn(null);
        setSortOrder(null);
      } else {
        setSortOrder("asc");
      }
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteFormResponses(ids),
    onSuccess: () => {
      toast.success("Respostas excluídas com sucesso");
      setSelectedIds([]);
      queryClient.invalidateQueries({ queryKey: ["uz-form-responses-tab", formId] });
      queryClient.invalidateQueries({ queryKey: ["uz-form-responses-count", formId] });
    },
    onError: () => {
      toast.error("Erro ao excluir respostas");
    },
  });

  const handleDeleteSelected = () => {
    deleteMutation.mutate(selectedIds);
  };

  const handleIniciarConversa = (res: UzFormResponse) => {
    const phone = getPhoneFromResponse(res, orderedFields);
    if (!phone) return;
    navigate(`/crm?new_conversation_phone=${phone}`);
  };

  const hasPhoneField = (res: UzFormResponse) =>
    getPhoneFromResponse(res, orderedFields) !== null;

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

  const handleExportSelectedCSV = async () => {
    setIsExporting(true);
    try {
      const allResponses = await getAllFormResponses(formId);
      const selectedResponses = allResponses.filter(res => selectedIds.includes(res.id));

      const csvCell = (value: string): string =>
        `"${value.replace(/"/g, '""')}"`;

      // Header row
      const headers = ["Enviado em", ...orderedFields.map((f) => f.label)];
      const headerRow = headers.map(csvCell).join(",");

      // Data rows
      const dataRows = selectedResponses.map((res) => {
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
      a.download = `${formName.replace(/[^a-z0-9]/gi, "_")}_respostas_selecionadas_${dateStr}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Respostas selecionadas exportadas com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao exportar respostas para CSV.");
    } finally {
      setIsExporting(false);
    }
  };

  const renderSubmittedAtFilter = () => {
    const val = filters["submitted_at"] || {};
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Filtrar por data
        </h4>
        <div className="space-y-2">
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase font-medium">De</label>
            <Input
              type="date"
              value={val.from ?? ""}
              onChange={(e) => {
                setFilters((prev) => ({
                  ...prev,
                  submitted_at: { ...prev.submitted_at, from: e.target.value || undefined },
                }));
              }}
              className="h-8 text-xs bg-muted border-border"
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] text-muted-foreground uppercase font-medium">Até</label>
            <Input
              type="date"
              value={val.to ?? ""}
              onChange={(e) => {
                setFilters((prev) => ({
                  ...prev,
                  submitted_at: { ...prev.submitted_at, to: e.target.value || undefined },
                }));
              }}
              className="h-8 text-xs bg-muted border-border"
            />
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs border-border"
          onClick={() => {
            setFilters((prev) => {
              const next = { ...prev };
              delete next.submitted_at;
              return next;
            });
          }}
        >
          Limpar filtro
        </Button>
      </div>
    );
  };

  const renderColumnFilter = (col: UzFormField) => {
    if (col.field_type === "multiple_choice" || col.field_type === "select_list") {
      const options = col.options || [];
      const selected = (filters[col.key_name] as string[]) || [];
      return (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Filtrar por {col.label}
          </h4>
          {options.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sem opções configuradas</p>
          ) : (
            <div className="max-h-40 overflow-y-auto space-y-2">
              {options.map((opt) => {
                const isChecked = selected.includes(opt);
                return (
                  <div key={opt} className="flex items-center gap-2">
                    <Checkbox
                      id={`filter-${col.id}-${opt}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        setFilters((prev) => {
                          const currentSelected = (prev[col.key_name] as string[]) || [];
                          const nextSelected = checked
                            ? [...currentSelected, opt]
                            : currentSelected.filter((l) => l !== opt);
                          return {
                            ...prev,
                            [col.key_name]: nextSelected,
                          };
                        });
                      }}
                    />
                    <label
                      htmlFor={`filter-${col.id}-${opt}`}
                      className="text-xs text-foreground cursor-pointer flex items-center gap-1.5 flex-1"
                    >
                      <span className="truncate">{opt}</span>
                    </label>
                  </div>
                );
              })}
            </div>
          )}
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs border-border"
            onClick={() => {
              setFilters((prev) => {
                const next = { ...prev };
                delete next[col.key_name];
                return next;
              });
            }}
          >
            Limpar filtro
          </Button>
        </div>
      );
    }

    if (col.field_type === "date") {
      const val = filters[col.key_name] || {};
      return (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Filtrar por {col.label}
          </h4>
          <div className="space-y-2">
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-medium">De</label>
              <Input
                type="date"
                value={val.from ?? ""}
                onChange={(e) => {
                  setFilters((prev) => ({
                    ...prev,
                    [col.key_name]: { ...prev[col.key_name], from: e.target.value || undefined },
                  }));
                }}
                className="h-8 text-xs bg-muted border-border"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-muted-foreground uppercase font-medium">Até</label>
              <Input
                type="date"
                value={val.to ?? ""}
                onChange={(e) => {
                  setFilters((prev) => ({
                    ...prev,
                    [col.key_name]: { ...prev[col.key_name], to: e.target.value || undefined },
                  }));
                }}
                className="h-8 text-xs bg-muted border-border"
              />
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs border-border"
            onClick={() => {
              setFilters((prev) => {
                const next = { ...prev };
                delete next[col.key_name];
                return next;
              });
            }}
          >
            Limpar filtro
          </Button>
        </div>
      );
    }

    if (col.field_type === "file_upload") {
      const val = filters[col.key_name];
      return (
        <div className="space-y-3">
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Filtrar por {col.label}
          </h4>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`filter-${col.id}-has-file`}
                checked={val === "has_file"}
                onCheckedChange={(checked) => {
                  setFilters((prev) => ({
                    ...prev,
                    [col.key_name]: checked ? "has_file" : undefined,
                  }));
                }}
              />
              <label htmlFor={`filter-${col.id}-has-file`} className="text-xs text-foreground cursor-pointer flex-1">
                Com arquivo
              </label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id={`filter-${col.id}-no-file`}
                checked={val === "no_file"}
                onCheckedChange={(checked) => {
                  setFilters((prev) => ({
                    ...prev,
                    [col.key_name]: checked ? "no_file" : undefined,
                  }));
                }}
              />
              <label htmlFor={`filter-${col.id}-no-file`} className="text-xs text-foreground cursor-pointer flex-1">
                Sem arquivo
              </label>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full h-7 text-xs border-border"
            onClick={() => {
              setFilters((prev) => {
                const next = { ...prev };
                delete next[col.key_name];
                return next;
              });
            }}
          >
            Limpar filtro
          </Button>
        </div>
      );
    }

    const val = (filters[col.key_name] as string) || "";
    return (
      <div className="space-y-3">
        <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider">
          Filtrar por {col.label}
        </h4>
        <Input
          placeholder="Buscar..."
          value={val}
          onChange={(e) => {
            setFilters((prev) => ({
              ...prev,
              [col.key_name]: e.target.value || undefined,
            }));
          }}
          className="h-8 text-xs bg-muted border-border"
        />
        <Button
          variant="outline"
          size="sm"
          className="w-full h-7 text-xs border-border"
          onClick={() => {
            setFilters((prev) => {
              const next = { ...prev };
              delete next[col.key_name];
              return next;
            });
          }}
        >
          Limpar filtro
        </Button>
      </div>
    );
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
      {/* Global Search and Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-card border border-border p-3 rounded-lg">
        <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-md">
          <Input
            placeholder="Buscar em todos os campos..."
            value={globalSearch}
            onChange={(e) => setGlobalSearch(e.target.value)}
            className="h-9 text-xs bg-muted border-border flex-1"
          />
          {isAnyFilterActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setFilters({})}
              className="h-9 text-xs border-border text-muted-foreground hover:text-foreground shrink-0"
            >
              Limpar filtros
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between md:justify-end gap-3 shrink-0">
          <div className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span>
              Total de <span className="font-semibold text-foreground">{totalCount}</span> resposta
              {totalCount !== 1 ? "s" : ""}
            </span>
            {selectedIds.length > 0 && (
              <span className="text-xs text-muted-foreground/80 font-medium">
                · {selectedIds.length} de {totalCount} selecionadas
              </span>
            )}
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
      </div>

      {/* Batch Selections Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              Ações em lote ({selectedIds.length} selecionada{selectedIds.length !== 1 ? "s" : ""})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              Desmarcar todas
            </Button>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportSelectedCSV}
              className="h-7 text-xs border-border hover:border-accent/50"
            >
              <Download className="h-3.5 w-3.5 mr-1" />
              Exportar selecionadas
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-7 text-xs"
            >
              Excluir selecionadas
            </Button>
          </div>
        </div>
      )}

      {/* Responses Data Table */}
      <div className="rounded-lg border border-border overflow-hidden bg-card">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-muted/80 backdrop-blur z-10">
              <TableRow className="border-border hover:bg-muted/50">
                <TableHead className="w-12 text-center p-2">
                  <Checkbox
                    checked={
                      filteredResponses.length > 0
                        ? filteredResponses.every((res) => selectedIds.includes(res.id))
                          ? true
                          : filteredResponses.some((res) => selectedIds.includes(res.id))
                          ? "indeterminate"
                          : false
                        : false
                    }

                    onCheckedChange={(checked) => {
                      if (checked) {
                        setSelectedIds((prev) => {
                          const newIds = [...prev];
                          for (const res of filteredResponses) {
                            if (!newIds.includes(res.id)) {
                              newIds.push(res.id);
                            }
                          }
                          return newIds;
                        });
                      } else {
                        setSelectedIds((prev) =>
                          prev.filter((id) => !filteredResponses.some((r) => r.id === id))
                        );
                      }
                    }}
                    aria-label="Selecionar todas as respostas da página"
                  />
                </TableHead>
                <TableHead className="text-muted-foreground text-xs whitespace-nowrap w-44">
                  <div className="flex items-center gap-1.5 justify-between">
                    <button
                      type="button"
                      onClick={() => handleSort("submitted_at")}
                      className="flex items-center gap-1 hover:text-foreground font-semibold"
                    >
                      Enviado em
                      {sortColumn === "submitted_at" && (
                        sortOrder === "asc" ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5" />
                        )
                      )}
                    </button>

                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-6 w-6 p-0 hover:bg-muted ${
                            isFilterActive("submitted_at")
                              ? "text-primary"
                              : "text-muted-foreground/60"
                          }`}
                        >
                          <Filter className="h-3.5 w-3.5" fill={isFilterActive("submitted_at") ? "currentColor" : "none"} />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-64 bg-card border-border p-3 z-50">
                        {renderSubmittedAtFilter()}
                      </PopoverContent>
                    </Popover>
                  </div>
                </TableHead>
                {orderedFields.map((field) => (
                  <TableHead
                    key={field.id}
                    className="text-muted-foreground text-xs align-top whitespace-normal break-words min-w-[140px] max-w-[220px]"
                  >
                    <div className="flex items-start gap-1.5 justify-between font-semibold">
                      <button
                        type="button"
                        onClick={() => handleSort(field.key_name)}
                        className="flex items-start gap-1 hover:text-foreground font-semibold text-left whitespace-normal break-words leading-snug line-clamp-2"
                      >
                        {field.label}
                        {sortColumn === field.key_name && (
                          sortOrder === "asc" ? (
                            <ChevronUp className="h-3 w-3" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )
                        )}
                      </button>

                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-6 w-6 p-0 hover:bg-muted ${
                              isFilterActive(field.key_name)
                                ? "text-primary"
                                : "text-muted-foreground/60"
                            }`}
                          >
                            <Filter className="h-3.5 w-3.5" fill={isFilterActive(field.key_name) ? "currentColor" : "none"} />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-60 bg-card border-border p-3 z-50">
                          {renderColumnFilter(field)}
                        </PopoverContent>
                      </Popover>
                    </div>
                  </TableHead>
                ))}
                <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap w-28 font-semibold">
                  Ações
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResponses.map((res) => (
                <TableRow key={res.id} className="border-border hover:bg-muted/30">
                  <TableCell className="w-12 text-center p-2">
                    <Checkbox
                      checked={selectedIds.includes(res.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedIds((prev) => [...prev, res.id]);
                        } else {
                          setSelectedIds((prev) =>
                            prev.filter((id) => id !== res.id)
                          );
                        }
                      }}
                      aria-label={`Selecionar resposta ${res.id}`}
                    />
                  </TableCell>
                  <TableCell className="text-xs font-medium whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      {isResponseNew(res) && !seenIds.has(res.id) && (
                        <span className="px-1.5 py-0.5 rounded bg-success/20 text-success text-[10px] font-bold uppercase tracking-wider shrink-0">
                          Novo
                        </span>
                      )}
                      <span>{formatDateBR(res.submitted_at)}</span>
                    </div>
                  </TableCell>
                  {orderedFields.map((field) => {
                    const value = res.response_data[field.key_name];
                    const text = value === undefined || value === null ? "" : String(value);
                    return (
                      <TableCell key={field.id} className="text-sm max-w-[220px]">
                        {text === "" ? (
                          <span className="text-muted-foreground/45">—</span>
                        ) : isUrlValue(text) ? (
                          <a
                            href={text}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-primary hover:underline text-xs font-medium"
                          >
                            <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                            Ver arquivo
                          </a>
                        ) : (
                          <span className="block truncate" title={text}>
                            {text}
                          </span>
                        )}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-right p-1.5">
                    {hasPhoneField(res) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-success hover:text-success hover:bg-success/10"
                        onClick={() => handleIniciarConversa(res)}
                        aria-label="Iniciar conversa no CRM"
                      >
                        <MessageCircle className="h-3.5 w-3.5 mr-1" />
                        Conversa
                      </Button>
                    )}
                  </TableCell>
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

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Respostas</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir as {selectedIds.length} respostas selecionadas? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:bg-muted">
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSelected}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
