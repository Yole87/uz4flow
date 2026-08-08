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
import { Loader2, MessageCircle, Download, ChevronLeft, ChevronRight, Inbox } from "lucide-react";
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

  useEffect(() => {
    setSelectedIds([]);
  }, [page, source.id]);

  const sortedColumns = [...columns].sort((a, b) => a.col_order - b.col_order);

  const { data, isLoading } = useQuery({
    queryKey: ["prospect-leads", source.id, page],
    queryFn: () => getLeads(source.id, page, PAGE_SIZE),
    placeholderData: (prev) => prev,
  });

  const leads = data?.data ?? [];
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
      <div className="flex items-center justify-between">
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
                          leads.length > 0 &&
                          (leads.every((lead) => selectedIds.includes(lead.id))
                            ? true
                            : leads.some((lead) => selectedIds.includes(lead.id))
                            ? "indeterminate"
                            : false)
                        }
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedIds((prev) => {
                              const newIds = [...prev];
                              for (const lead of leads) {
                                if (!newIds.includes(lead.id)) {
                                  newIds.push(lead.id);
                                }
                              }
                              return newIds;
                            });
                          } else {
                            setSelectedIds((prev) =>
                              prev.filter((id) => !leads.some((l) => l.id === id))
                            );
                          }
                        }}
                        aria-label="Selecionar todos os leads da página"
                      />
                    </TableHead>
                    <TableHead className="text-muted-foreground text-xs whitespace-nowrap w-36">
                      Recebido em
                    </TableHead>
                    {sortedColumns.map((col) => (
                      <TableHead
                        key={col.id}
                        className="text-muted-foreground text-xs whitespace-nowrap min-w-[120px]"
                      >
                        {col.label}
                      </TableHead>
                    ))}
                    <TableHead className="text-muted-foreground text-xs text-right whitespace-nowrap w-28">
                      Ações
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead) => (
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
