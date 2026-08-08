import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  getLeads,
  updateLeadFieldData,
  exportLeadsAsCSV,
  deleteLeads,
} from "@/services/prospectSourceService";
import type { ProspectSource, ProspectColumn, ProspectLead } from "@/types/prospect";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Loader2, MessageCircle, Download, ChevronLeft, ChevronRight, Inbox, ChevronUp, ChevronDown, Filter } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE = 50;

function formatDateBR(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const PHONE_KEYS_LOWER = ["whatsapp", "telefone", "phone", "celular"];

function getPhoneFromLead(lead: ProspectLead): string | null {
  for (const [key, value] of Object.entries(lead.field_data)) {
    if (PHONE_KEYS_LOWER.includes(key.toLowerCase()) && value && value.trim() !== "") {
      const digits = value.replace(/\D/g, "");
      if (digits) {
        return digits.startsWith("55") ? digits : `55${digits}`;
      }
    }
  }
  return null;
}
function normalizeSelectOptions(options: any): Array<{ label: string; color: string }> {
  if (!Array.isArray(options)) return [];
  return options.map((opt) => {
    if (typeof opt === "string") {
      return { label: opt, color: "#6366f1" };
    }
    if (opt && typeof opt === "object" && typeof opt.label === "string") {
      return { label: opt.label, color: opt.color || "#6366f1" };
    }
    return { label: String(opt), color: "#6366f1" };
  });
}

interface EditableCellProps {
  leadId: string;
  fieldKey: string;
  value: string;
  col: ProspectColumn;
  allFieldData: Record<string, string>;
  onSaved: () => void;
}

function EditableCell({ leadId, fieldKey, value, col, allFieldData, onSaved }: EditableCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const saveMutation = useMutation({
    mutationFn: (newVal: string) =>
      updateLeadFieldData(leadId, { ...allFieldData, [fieldKey]: newVal }),
    onSuccess: () => {
      toast.success("Dados atualizados. Lembre-se: isso não altera o envio original do formulário.");
      onSaved();
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  if (col.col_type === "select") {
    const normalizedOptions = normalizeSelectOptions(col.select_options);
    const selectedOpt = normalizedOptions.find((o) => o.label === value);

    const triggerStyle = selectedOpt
      ? {
          backgroundColor: `${selectedOpt.color}15`,
          color: selectedOpt.color,
          borderColor: `${selectedOpt.color}40`,
        }
      : undefined;

    return (
      <Select
        value={value || ""}
        onValueChange={(v) => saveMutation.mutate(v)}
      >
        <SelectTrigger 
          className="h-7 text-xs bg-transparent border-border w-full"
          style={triggerStyle}
        >
          <SelectValue placeholder="—" />
        </SelectTrigger>
        <SelectContent>
          {normalizedOptions.map((opt) => (
            <SelectItem key={opt.label} value={opt.label} className="text-xs">
              <span className="flex items-center gap-2">
                <span 
                  className="w-2 h-2 rounded-full shrink-0" 
                  style={{ backgroundColor: opt.color }}
                />
                {opt.label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (editing) {
    return (
      <Input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          setEditing(false);
          if (draft !== value) saveMutation.mutate(draft);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            setEditing(false);
            if (draft !== value) saveMutation.mutate(draft);
          }
          if (e.key === "Escape") { setDraft(value); setEditing(false); }
        }}
        className="h-7 text-xs bg-background border-border"
      />
    );
  }

  return (
    <button
      type="button"
      className="text-left text-xs w-full hover:bg-muted/40 rounded px-1 py-0.5 min-h-[1.75rem] text-foreground transition-colors"
      onClick={() => { setDraft(value); setEditing(true); }}
    >
      {value || <span className="text-muted-foreground/40">—</span>}
    </button>
  );
}

interface LeadsTableProps {
  source: ProspectSource;
  columns: ProspectColumn[];
}

export function LeadsTable({ source, columns }: LeadsTableProps) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc" | null>(null);
  const [filters, setFilters] = useState<Record<string, any>>({});
  const [globalSearch, setGlobalSearch] = useState("");

  useEffect(() => {
    setSelectedIds([]);
  }, [page, source.id]);

  const sortedColumns = [...columns].sort((a, b) => a.col_order - b.col_order);

  const { data, isLoading } = useQuery({
    queryKey: ["prospect-leads", source.id, page, sortColumn === "received_at" ? sortOrder : null],
    queryFn: () => getLeads(source.id, page, PAGE_SIZE, sortColumn === "received_at" ? (sortOrder ?? undefined) : undefined),
    placeholderData: (prev) => prev,
  });

  const leads = data?.data ?? [];
  const isAnyFilterActive = useMemo(() => {
    for (const [key, value] of Object.entries(filters)) {
      if (key === "received_at") {
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
    if (colKey === "received_at") {
      return !!(val.from || val.to);
    }
    if (Array.isArray(val)) {
      return val.length > 0;
    }
    return typeof val === "string" && val.trim() !== "";
  };

  const filteredLeads = useMemo(() => {
    let result = [...leads];

    // Global Search
    if (globalSearch && globalSearch.trim() !== "") {
      const searchLower = globalSearch.toLowerCase().trim();
      result = result.filter((lead) => {
        return Object.values(lead.field_data).some((val) =>
          val && val.toLowerCase().includes(searchLower)
        );
      });
    }

    // Column Filters
    for (const [colKey, filterVal] of Object.entries(filters)) {
      if (!filterVal) continue;

      if (colKey === "received_at") {
        const { from, to } = filterVal;
        if (from || to) {
          result = result.filter((lead) => {
            const leadDate = new Date(lead.received_at);
            if (from) {
              const fromDate = new Date(from);
              fromDate.setHours(0, 0, 0, 0);
              if (leadDate < fromDate) return false;
            }
            if (to) {
              const toDate = new Date(to);
              toDate.setHours(23, 59, 59, 999);
              if (leadDate > toDate) return false;
            }
            return true;
          });
        }
      } else {
        const column = columns.find((c) => c.key_name === colKey);
        if (!column) continue;

        if (column.col_type === "select") {
          const selectedOptions = filterVal as string[];
          if (selectedOptions.length > 0) {
            result = result.filter((lead) => {
              const val = lead.field_data[colKey] ?? "";
              return selectedOptions.includes(val);
            });
          }
        } else {
          const searchStr = (filterVal as string).toLowerCase().trim();
          if (searchStr !== "") {
            result = result.filter((lead) => {
              const val = (lead.field_data[colKey] ?? "").toLowerCase();
              return val.includes(searchStr);
            });
          }
        }
      }
    }

    // Dynamic Columns Sorting (client-side)
    if (sortColumn && sortColumn !== "received_at" && sortOrder) {
      result.sort((a, b) => {
        const valA = a.field_data[sortColumn] ?? "";
        const valB = b.field_data[sortColumn] ?? "";
        const comp = valA.localeCompare(valB, undefined, { numeric: true, sensitivity: "base" });
        return sortOrder === "asc" ? comp : -comp;
      });
    }

    return result;
  }, [leads, globalSearch, filters, sortColumn, sortOrder, columns]);

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

  const renderReceivedAtFilter = () => {
    const val = filters["received_at"] || {};
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
                  received_at: { ...prev.received_at, from: e.target.value || undefined },
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
                  received_at: { ...prev.received_at, to: e.target.value || undefined },
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
              delete next.received_at;
              return next;
            });
          }}
        >
          Limpar filtro
        </Button>
      </div>
    );
  };

  const renderColumnFilter = (col: ProspectColumn) => {
    if (col.col_type === "select") {
      const options = normalizeSelectOptions(col.select_options);
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
                const isChecked = selected.includes(opt.label);
                return (
                  <div key={opt.label} className="flex items-center gap-2">
                    <Checkbox
                      id={`filter-${col.id}-${opt.label}`}
                      checked={isChecked}
                      onCheckedChange={(checked) => {
                        setFilters((prev) => {
                          const currentSelected = (prev[col.key_name] as string[]) || [];
                          const nextSelected = checked
                            ? [...currentSelected, opt.label]
                            : currentSelected.filter((l) => l !== opt.label);
                          return {
                            ...prev,
                            [col.key_name]: nextSelected,
                          };
                        });
                      }}
                    />
                    <label
                      htmlFor={`filter-${col.id}-${opt.label}`}
                      className="text-xs text-foreground cursor-pointer flex items-center gap-1.5 flex-1"
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: opt.color }}
                      />
                      <span className="truncate">{opt.label}</span>
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
  const totalCount = data?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const handleInvalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["prospect-leads", source.id, page] });
  }, [queryClient, source.id, page]);

  const handleExportCSV = async () => {
    try {
      const csv = await exportLeadsAsCSV(source.id, sortedColumns);
      const bom = "\uFEFF"; // UTF-8 BOM for Excel compatibility
      const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `${source.name.replace(/[^a-z0-9]/gi, "_")}_leads_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com sucesso");
    } catch {
      toast.error("Erro ao exportar CSV");
    }
  };

  const handleExportSelectedCSV = async () => {
    try {
      const csv = await exportLeadsAsCSV(source.id, sortedColumns, selectedIds);
      const bom = "\uFEFF";
      const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const date = new Date().toISOString().split("T")[0];
      a.download = `${source.name.replace(/[^a-z0-9]/gi, "_")}_leads_selecionados_${date}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("CSV exportado com sucesso");
    } catch {
      toast.error("Erro ao exportar CSV");
    }
  };

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => deleteLeads(ids),
    onSuccess: () => {
      toast.success("Leads excluídos com sucesso");
      setSelectedIds([]);
      handleInvalidate();
    },
    onError: () => {
      toast.error("Erro ao excluir leads");
    },
  });

  const handleDeleteSelected = () => {
    deleteMutation.mutate(selectedIds);
  };

  const handleIniciarConversa = (lead: ProspectLead) => {
    if (lead.crm_contact_id) {
      navigate(`/crm?contact=${lead.crm_contact_id}`);
      return;
    }
    const phone = getPhoneFromLead(lead);
    if (!phone) return;
    navigate("/crm", { state: { phone } });
  };

  const hasPhoneField = (lead: ProspectLead) =>
    getPhoneFromLead(lead) !== null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
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
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 flex-wrap">
            <span>{totalCount} lead{totalCount !== 1 ? "s" : ""}</span>
            {selectedIds.length > 0 && (
              <span className="text-xs text-muted-foreground/80 font-medium">
                · {selectedIds.length} de {totalCount} selecionados
              </span>
            )}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCSV}
            disabled={totalCount === 0}
            className="border-border hover:border-accent/50"
          >
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-foreground">
              Ações em lote ({selectedIds.length} selecionado{selectedIds.length !== 1 ? "s" : ""})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds([])}
              className="h-7 text-xs text-muted-foreground hover:text-foreground px-2"
            >
              Desmarcar todos
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
              Exportar selecionados
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteConfirm(true)}
              className="h-7 text-xs"
            >
              Excluir selecionados
            </Button>
          </div>
        </div>
      )}

      {leads.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 gap-3 border border-dashed border-border rounded-lg">
          <Inbox className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground text-center">
            Nenhum lead recebido ainda.<br />
            Configure o webhook e publique seu formulário.
          </p>
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto max-h-[calc(100vh-360px)] overflow-y-auto">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/80 z-10">
                  <TableRow className="border-border hover:bg-muted/50">
                    <TableHead className="w-12 text-center p-2">
                      <Checkbox
                        checked={
                          filteredLeads.length > 0 &&
                          (filteredLeads.every((lead) => selectedIds.includes(lead.id))
                            ? true
                            : filteredLeads.some((lead) => selectedIds.includes(lead.id))
                            ? "indeterminate"
                            : false)
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((prev) => {
                              const newIds = [...prev];
                              for (const lead of filteredLeads) {
                                if (!newIds.includes(lead.id)) {
                                  newIds.push(lead.id);
                                }
                              }
                              return newIds;
                            });
                          } else {
                            setSelectedIds((prev) =>
                              prev.filter((id) => !filteredLeads.some((l) => l.id === id))
                            );
                          }
                        }}
                        aria-label="Selecionar todos os leads da página"
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs whitespace-nowrap w-44">
                      <div className="flex items-center gap-1.5 justify-between">
                        <button
                          type="button"
                          onClick={() => handleSort("received_at")}
                          className="flex items-center gap-1 hover:text-foreground font-semibold"
                        >
                          Recebido em
                          {sortColumn === "received_at" && (
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
                                isFilterActive("received_at")
                                  ? "text-primary"
                                  : "text-muted-foreground/60"
                              }`}
                            >
                              <Filter className="h-3.5 w-3.5" fill={isFilterActive("received_at") ? "currentColor" : "none"} />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 bg-card border-border p-3 z-50">
                            {renderReceivedAtFilter()}
                          </PopoverContent>
                        </Popover>
                      </div>
                    </TableHead>
                    {sortedColumns.map((col) => (
                      <TableHead
                        key={col.id}
                        className="text-muted-foreground text-xs whitespace-nowrap min-w-[140px]"
                      >
                        <div className="flex items-center gap-1.5 justify-between font-semibold">
                          <button
                            type="button"
                            onClick={() => handleSort(col.key_name)}
                            className="flex items-center gap-1 hover:text-foreground font-semibold"
                          >
                            {col.label}
                            {sortColumn === col.key_name && (
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
                                  isFilterActive(col.key_name)
                                    ? "text-primary"
                                    : "text-muted-foreground/60"
                                }`}
                              >
                                <Filter className="h-3.5 w-3.5" fill={isFilterActive(col.key_name) ? "currentColor" : "none"} />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-60 bg-card border-border p-3 z-50">
                              {renderColumnFilter(col)}
                            </PopoverContent>
                          </Popover>
                        </div>
                      </TableHead>
                    ))}
                    <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap w-28">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="border-border hover:bg-muted/30">
                      <TableCell className="w-12 text-center p-2">
                        <Checkbox
                          checked={selectedIds.includes(lead.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIds((prev) => [...prev, lead.id]);
                            } else {
                              setSelectedIds((prev) =>
                                prev.filter((id) => id !== lead.id)
                              );
                            }
                          }}
                          aria-label={`Selecionar lead ${lead.id}`}
                        />
                      </TableCell>
                      {/* Received at — read-only */}
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateBR(lead.received_at)}
                      </TableCell>
                      
                      {/* Dynamic columns — editable */}
                      {sortedColumns.map((col) => (
                        <TableCell key={col.id} className="p-1.5">
                          <EditableCell
                            leadId={lead.id}
                            fieldKey={col.key_name}
                            value={lead.field_data[col.key_name] ?? ""}
                            col={col}
                            allFieldData={lead.field_data}
                            onSaved={handleInvalidate}
                          />
                        </TableCell>
                      ))}

                      {/* Actions */}
                      <TableCell className="text-right p-1.5">
                        {hasPhoneField(lead) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-success hover:text-success hover:bg-success/10"
                            onClick={() => handleIniciarConversa(lead)}
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
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                Página {page + 1} de {totalPages} · {totalCount} leads
              </span>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  className="h-7 px-2 border-border"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  className="h-7 px-2 border-border"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">Excluir Leads</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              Tem certeza que deseja excluir os {selectedIds.length} leads selecionados? Esta ação não pode ser desfeita.
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
