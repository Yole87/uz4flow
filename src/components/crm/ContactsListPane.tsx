import { useState, useMemo, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
import { AddContactDialog } from "./AddContactDialog";
import { ImportContactsWizard } from "./import/ImportContactsWizard";
import { ContactDetailPane } from "./ContactDetailPane";
import { ContactFoldersDialog } from "./ContactFoldersDialog";
import { AssignToFolderDialog } from "./AssignToFolderDialog";
import { useContactFolders, useContactsInFolder } from "@/hooks/useContactFolders";
import {
  Search,
  Plus,
  User,
  Ban,
  MoreHorizontal,
  Upload,
  Download,
  Archive,
  ArrowLeft,
  ArchiveRestore,
  Trash2,
  Loader2,
  MessageSquare,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Folder,
  FolderOpen,
  FolderPlus,
} from "lucide-react";
import { toast } from "sonner";
import { stripPhone } from "@/lib/phoneFormat";
import { ChannelIcon, getChannelLabel } from "@/components/icons/ChannelIcon";
import { useInternalIgAccounts } from "@/hooks/useInternalIgAccounts";
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  exportContactsCSV,
  exportContactsXLSX,
  exportContactsTXT,
} from "@/lib/contactExport";
import { FileSpreadsheet, File as FileIcon, FileText as FileTextIcon } from "lucide-react";

type SortField = "name" | "phone" | "email" | "tags" | "created_at";
type SortDirection = "asc" | "desc";

interface ContactsListPaneProps {
  onNavigateToConversation?: (contactId: string) => void;
  globalInstanceId?: string | null;
}

export function ContactsListPane({ onNavigateToConversation, globalInstanceId }: ContactsListPaneProps) {
  const [searchField, setSearchField] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchDate, setSearchDate] = useState("");
  const [appliedField, setAppliedField] = useState("todos");
  const [appliedTerm, setAppliedTerm] = useState("");
  const [appliedDate, setAppliedDate] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [deleteContactId, setDeleteContactId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedContactIds, setSelectedContactIds] = useState<Set<string>>(new Set());
  const [showBulkDeleteAlert, setShowBulkDeleteAlert] = useState(false);
  const [filterInstanceId, setFilterInstanceId] = useState<string>("all");
  const [filterFolderId, setFilterFolderId] = useState<string>("all");
  const [showFoldersDialog, setShowFoldersDialog] = useState(false);
  const [showAssignFolderDialog, setShowAssignFolderDialog] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const { data: internalIgIds } = useInternalIgAccounts();
  const { data: folders } = useContactFolders();
  const { data: folderContactIds } = useContactsInFolder(filterFolderId === "all" ? null : filterFolderId);

  // Fetch instances for filter
  const { data: instancesList } = useQuery({
    queryKey: ["crm-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Array<{ id: string; name: string }>;
    },
    enabled: !!organization?.id,
  });

  // Sync with global instance filter from CRMLayout
  useEffect(() => {
    if (globalInstanceId) {
      setFilterInstanceId(globalInstanceId);
    } else {
      setFilterInstanceId("all");
    }
  }, [globalInstanceId]);

  // Auto-apply when searchTerm is cleared
  useEffect(() => {
    if (searchTerm === "" && appliedTerm !== "") {
      setAppliedTerm("");
    }
  }, [searchTerm, appliedTerm]);

  // Auto-apply date filter reactively
  useEffect(() => {
    setAppliedDate(searchDate);
  }, [searchDate]);

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["crm-all-contacts", organization?.id, showArchived, filterInstanceId],
    queryFn: async () => {
      if (!organization?.id) return [];
      let query = supabase
        .from("contacts")
        .select(
          `id, name, phone, email, tags, instance_id, channel, metadata, ig_user_scoped_id,
           created_at, last_interaction_at, is_blocked, is_archived,
           instances:instance_id(name, channel),
           stage:pipeline_stage_id(name, pipeline:pipelines(name)),
           team_members:assigned_to_member_id(first_name, last_name)`
        )
        .eq("organization_id", organization.id)
        .eq("is_archived", showArchived)
        .order("created_at", { ascending: false })
        .limit(500);
      
      if (filterInstanceId && filterInstanceId !== "all") {
        query = query.eq("instance_id", filterInstanceId);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      const contactsData = (data || []) as any[];
      const instagramScopedIds = contactsData
        .filter((contact) => ((contact.channel || contact.instances?.channel) === "instagram") && contact.ig_user_scoped_id)
        .map((contact) => contact.ig_user_scoped_id);

      if (instagramScopedIds.length === 0) {
        return contactsData;
      }

      const { data: instagramLeads, error: instagramLeadsError } = await supabase
        .from("instagram_leads")
        .select("ig_user_scoped_id, ig_handle, ig_name")
        .eq("organization_id", organization.id)
        .in("ig_user_scoped_id", instagramScopedIds);

      if (instagramLeadsError) throw instagramLeadsError;

      const instagramLeadMap = new Map((instagramLeads || []).map((lead) => [lead.ig_user_scoped_id, lead]));

      return contactsData.map((contact) => ({
        ...contact,
        instagram_lead: contact.ig_user_scoped_id ? instagramLeadMap.get(contact.ig_user_scoped_id) || null : null,
      }));
    },
    enabled: !!organization?.id,
  });

  // Archive / Unarchive mutation
  const archiveMutation = useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ is_archived: archived } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, { archived }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-all-contacts"] });
      toast.success(archived ? "Contato arquivado!" : "Contato desarquivado!");
    },
    onError: () => toast.error("Erro ao atualizar contato"),
  });

  // Permanent delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-all-contacts"] });
      setDeleteContactId(null);
      toast.success("Contato excluído permanentemente!");
    },
    onError: () => toast.error("Erro ao excluir contato"),
  });

  // Bulk delete mutation
  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      for (const id of ids) {
        const { error } = await supabase.from("contacts").delete().eq("id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-all-contacts"] });
      setSelectedContactIds(new Set());
      setShowBulkDeleteAlert(false);
      toast.success(`${selectedContactIds.size} contato(s) excluído(s)!`);
    },
    onError: () => toast.error("Erro ao excluir contatos"),
  });

  // Smart Import CSV/TXT mutation
  const importMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!organization?.id) throw new Error("Sem organização");
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length === 0) throw new Error("Arquivo vazio");

      const firstLine = lines[0];
      const firstCols = firstLine.split(",").map((c) => c.trim().replace(/^"|"$/g, "").toLowerCase());
      const looksLikeHeader = firstCols.some(
        (c) => ["nome", "name", "telefone", "phone", "email", "e-mail"].includes(c)
      );

      const dataLines = looksLikeHeader ? lines.slice(1) : lines;
      const parsedRows: { name: string | null; phone: string; email: string | null }[] = [];

      for (const line of dataLines) {
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        if (cols.length === 0 || cols.every((c) => !c)) continue;

        let name: string | null = null;
        let phone = "";
        let email: string | null = null;

        if (cols.length === 1) {
          const stripped = stripPhone(cols[0]);
          if (stripped.length >= 8 && /^\d+$/.test(stripped)) {
            phone = stripped;
          } else {
            name = cols[0] || null;
          }
        } else if (cols.length >= 2) {
          const col0Digits = stripPhone(cols[0]);
          const col1Digits = stripPhone(cols[1]);
          const col0IsPhone = col0Digits.length >= 8 && /^\d+$/.test(col0Digits);
          const col1IsPhone = col1Digits.length >= 8 && /^\d+$/.test(col1Digits);

          if (looksLikeHeader) {
            const nameIdx = firstCols.findIndex((c) => ["nome", "name"].includes(c));
            const phoneIdx = firstCols.findIndex((c) => ["telefone", "phone"].includes(c));
            const emailIdx = firstCols.findIndex((c) => ["email", "e-mail"].includes(c));
            name = nameIdx >= 0 ? cols[nameIdx] || null : null;
            phone = phoneIdx >= 0 ? stripPhone(cols[phoneIdx] || "") : "";
            email = emailIdx >= 0 ? cols[emailIdx] || null : null;
          } else if (col0IsPhone && !col1IsPhone) {
            phone = col0Digits;
            name = cols[1] || null;
            email = cols[2] || null;
          } else {
            name = cols[0] || null;
            phone = col1IsPhone ? col1Digits : stripPhone(cols[1] || "");
            email = cols[2] || null;
          }
        }

        if (phone) {
          parsedRows.push({ name, phone, email });
        }
      }

      if (parsedRows.length === 0) throw new Error("Nenhum registro válido encontrado");

      const phoneMap = new Map<string, typeof parsedRows[0]>();
      for (const row of parsedRows) {
        if (!phoneMap.has(row.phone)) {
          phoneMap.set(row.phone, row);
        }
      }
      const uniqueRows = Array.from(phoneMap.values());
      const duplicatesRemoved = parsedRows.length - uniqueRows.length;

      const toInsert = uniqueRows.map((r) => ({
        name: r.name,
        phone: r.phone,
        email: r.email,
        organization_id: organization.id,
      }));

      let insertedCount = 0;
      let skippedCount = 0;

      for (const row of toInsert) {
        const { error } = await supabase.from("contacts").insert(row);
        if (error) {
          if (error.code === "23505") {
            skippedCount++;
          }
        } else {
          insertedCount++;
        }
      }

      return { insertedCount, skippedCount: skippedCount + duplicatesRemoved };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["crm-all-contacts"] });
      setShowImportDialog(false);
      let msg = `${result.insertedCount} contato(s) importado(s)!`;
      if (result.skippedCount > 0) {
        msg += ` ${result.skippedCount} duplicado(s) ignorado(s).`;
      }
      toast.success(msg);
    },
    onError: () => toast.error("Erro ao importar contatos"),
  });

  const handleApplyFilters = () => {
    setAppliedField(searchField);
    setAppliedTerm(searchTerm);
    setAppliedDate(searchDate);
  };

  const handleToggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-3 w-3 ml-1" />
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const handleToggleSelect = (id: string) => {
    setSelectedContactIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedContactIds.size === filtered.length) {
      setSelectedContactIds(new Set());
    } else {
      setSelectedContactIds(new Set(filtered.map((c) => c.id)));
    }
  };

  const handleExport = (kind: "csv" | "xlsx" | "txt" = "csv") => {
    const toExport = selectedContactIds.size > 0
      ? filtered.filter((c) => selectedContactIds.has(c.id))
      : filtered;
    if (!toExport.length) { toast.error("Nenhum contato para exportar"); return; }
    const baseFilename = `contatos_${new Date().toISOString().slice(0, 10)}`;
    if (kind === "csv") exportContactsCSV(toExport as any, baseFilename);
    else if (kind === "xlsx") exportContactsXLSX(toExport as any, baseFilename);
    else exportContactsTXT(toExport as any, baseFilename);
    toast.success(`${toExport.length} contato(s) exportado(s)!`);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) importMutation.mutate(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const filtered = useMemo(() => {
    if (!contacts) return [];
    let result = [...contacts];

    if (appliedTerm.trim()) {
      const q = appliedTerm.toLowerCase();
      result = result.filter((c) => {
        switch (appliedField) {
          case "name": return c.name?.toLowerCase().includes(q) || (c as any).instagram_lead?.ig_name?.toLowerCase().includes(q);
          case "email": return c.email?.toLowerCase().includes(q);
          case "phone": return c.phone?.toLowerCase().includes(q) || (c as any).instagram_lead?.ig_handle?.toLowerCase().includes(q);
          default:
            return (
              c.name?.toLowerCase().includes(q) ||
              c.phone?.toLowerCase().includes(q) ||
              c.email?.toLowerCase().includes(q) ||
              (c as any).instagram_lead?.ig_handle?.toLowerCase().includes(q) ||
              (c as any).instagram_lead?.ig_name?.toLowerCase().includes(q)
            );
        }
      });
    }

    if (appliedDate) {
      result = result.filter((c) => c.created_at?.slice(0, 10) === appliedDate);
    }

    if (filterFolderId !== "all" && folderContactIds) {
      result = result.filter((c) => folderContactIds.has(c.id));
    }

    // Sort
    result.sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "name":
          cmp = (a.name || "").localeCompare(b.name || "", "pt-BR");
          break;
        case "phone":
          cmp = (a.phone || "").localeCompare(b.phone || "");
          break;
        case "email":
          cmp = (a.email || "").localeCompare(b.email || "", "pt-BR");
          break;
        case "tags": {
          const tagA = a.tags?.[0] || "";
          const tagB = b.tags?.[0] || "";
          cmp = tagA.localeCompare(tagB, "pt-BR");
          break;
        }
        case "created_at":
          cmp = (a.created_at || "").localeCompare(b.created_at || "");
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });

    return result;
  }, [contacts, appliedField, appliedTerm, appliedDate, sortField, sortDirection, filterFolderId, folderContactIds]);

  if (selectedContactId) {
    return (
      <ContactDetailPane
        contactId={selectedContactId}
        onClose={() => setSelectedContactId(null)}
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 p-4 border-b border-border shrink-0">
        {/* Row 1: Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          {showArchived && (
            <Button variant="ghost" size="icon" onClick={() => setShowArchived(false)} className="h-9 w-9 shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          )}
          {folders && folders.length > 0 && (
            <Select value={filterFolderId} onValueChange={setFilterFolderId}>
              <SelectTrigger className="w-full sm:w-[160px] shrink-0 bg-background">
                <SelectValue placeholder="Pasta" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span className="flex items-center gap-2">
                    <FolderOpen className="h-3.5 w-3.5 text-muted-foreground" />
                    Todas as pastas
                  </span>
                </SelectItem>
                {folders.map((f) => (
                  <SelectItem key={f.id} value={f.id}>
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: f.color }} />
                      {f.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {instancesList && instancesList.length > 1 && (
            <Select value={filterInstanceId} onValueChange={setFilterInstanceId}>
              <SelectTrigger className="w-full sm:w-[150px] shrink-0 bg-background">
                <SelectValue placeholder="Instância" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as instâncias</SelectItem>
                {instancesList.map((inst) => (
                  <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Select value={searchField} onValueChange={setSearchField}>
            <SelectTrigger className="w-full sm:w-[130px] shrink-0 bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os campos</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
              <SelectItem value="phone">Telefone</SelectItem>
            </SelectContent>
          </Select>
          <div className="relative flex-1 min-w-[120px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={showArchived ? "Buscar arquivado..." : "Buscar por..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleApplyFilters()}
              className="pl-9 bg-background border-border"
            />
          </div>
          <Input
            type="date"
            value={searchDate}
            onChange={(e) => setSearchDate(e.target.value)}
            className="w-full sm:w-[160px] shrink-0 bg-background border-border"
            placeholder="Selecionar data"
          />
        </div>
        {/* Row 2: Actions */}
        <div className="flex items-center gap-2 justify-between flex-wrap">
          <div className="flex items-center gap-2">
            {selectedContactIds.size > 0 && !showArchived && (
              <>
                <span className="text-xs text-muted-foreground">{selectedContactIds.size} selecionado(s)</span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAssignFolderDialog(true)}
                >
                  <FolderPlus className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Mover p/ pasta</span>
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowBulkDeleteAlert(true)}
                >
                  <Trash2 className="h-4 w-4 sm:mr-1" />
                  <span className="hidden sm:inline">Excluir</span>
                </Button>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={handleApplyFilters} size="sm" variant="secondary">
              <Search className="h-4 w-4 sm:mr-1" />
              <span className="hidden sm:inline">Buscar</span>
            </Button>
            {!showArchived && (
              <Button onClick={() => setShowAddDialog(true)} size="sm" data-guide="add-contact">
                <Plus className="h-4 w-4 sm:mr-1" />
                <span className="hidden sm:inline">Novo Contato</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {!showArchived && (
                  <>
                    <DropdownMenuItem onClick={() => setShowImportDialog(true)} data-guide="import-csv">
                      <Upload className="h-4 w-4 mr-2" />
                      Importar Registros
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("csv")}>
                      <FileTextIcon className="h-4 w-4 mr-2" />
                      {selectedContactIds.size > 0
                        ? `Exportar ${selectedContactIds.size} (.csv)`
                        : "Exportar .csv"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("xlsx")}>
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      {selectedContactIds.size > 0
                        ? `Exportar ${selectedContactIds.size} (.xlsx)`
                        : "Exportar .xlsx"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleExport("txt")}>
                      <FileIcon className="h-4 w-4 mr-2" />
                      {selectedContactIds.size > 0
                        ? `Exportar ${selectedContactIds.size} (.txt)`
                        : "Exportar .txt"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                  </>
                )}
                <DropdownMenuItem onClick={() => setShowFoldersDialog(true)}>
                  <Folder className="h-4 w-4 mr-2" />
                  Gerenciar pastas
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setShowArchived(!showArchived)}>
                  <Archive className="h-4 w-4 mr-2" />
                  {showArchived ? "Voltar aos ativos" : "Registros arquivados"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {showArchived && (
        <div className="px-4 py-2 bg-muted/50 border-b border-border text-sm text-muted-foreground flex items-center gap-2">
          <Archive className="h-4 w-4" />
          Exibindo registros arquivados
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {isLoading ? (
          <div className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2 p-8">
            <User className="h-10 w-10" />
            <p className="text-sm">
              {appliedTerm || appliedDate
                ? "Nenhum contato encontrado"
                : showArchived
                ? "Nenhum registro arquivado"
                : "Nenhum contato cadastrado"}
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {!showArchived && (
                  <TableHead className="w-[40px]">
                    <Checkbox
                      checked={selectedContactIds.size > 0 && selectedContactIds.size === filtered.length}
                      onCheckedChange={handleSelectAll}
                      className="border-border"
                    />
                  </TableHead>
                )}
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleSort("name")} className="h-auto p-0 -ml-2 px-2 font-medium hover:bg-transparent hover:text-foreground">
                    Nome {getSortIcon("name")}
                  </Button>
                </TableHead>
                <TableHead>
                  <Button variant="ghost" size="sm" onClick={() => handleToggleSort("phone")} className="h-auto p-0 -ml-2 px-2 font-medium hover:bg-transparent hover:text-foreground">
                    Telefone {getSortIcon("phone")}
                  </Button>
                </TableHead>
                <TableHead className="hidden md:table-cell">
                  <Button variant="ghost" size="sm" onClick={() => handleToggleSort("email")} className="h-auto p-0 -ml-2 px-2 font-medium hover:bg-transparent hover:text-foreground">
                    Email {getSortIcon("email")}
                  </Button>
                </TableHead>
                <TableHead className="hidden lg:table-cell">Instância</TableHead>
                <TableHead className="hidden md:table-cell">
                  <Button variant="ghost" size="sm" onClick={() => handleToggleSort("tags")} className="h-auto p-0 -ml-2 px-2 font-medium hover:bg-transparent hover:text-foreground">
                    Tags {getSortIcon("tags")}
                  </Button>
                </TableHead>
                {!showArchived && <TableHead className="w-[60px]"></TableHead>}
                {showArchived && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((contact) => {
                const channel = (contact as any).channel || (contact.instances as any)?.channel || "whatsapp";
                const meta = ((contact as any).metadata || {}) as Record<string, string | undefined>;
                const instagramHandle = (contact as any).instagram_lead?.ig_handle || meta.username || meta.ig_username;
                const instagramName = (contact as any).instagram_lead?.ig_name;
                const instagramLabel = instagramHandle ? `@${instagramHandle}` : "Instagram DM";
                const isInternalAccount =
                  channel === "instagram" &&
                  !!(contact as any).ig_user_scoped_id &&
                  !!internalIgIds?.has((contact as any).ig_user_scoped_id);

                return (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => !showArchived && setSelectedContactId(contact.id)}
                >
                  {!showArchived && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedContactIds.has(contact.id)}
                        onCheckedChange={() => handleToggleSelect(contact.id)}
                        className="border-border"
                      />
                    </TableCell>
                  )}
                  <TableCell className="font-medium">
                    <div className="flex items-start gap-2 min-w-0">
                      <ChannelIcon
                        channel={channel}
                        size={18}
                        aria-label={getChannelLabel(channel)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 min-w-0">
                          {contact.is_blocked && (
                            <Ban className="h-3.5 w-3.5 text-destructive shrink-0" />
                          )}
                          <span className="truncate max-w-[200px]">
                            {contact.name || instagramName || "Sem nome"}
                          </span>
                          {isInternalAccount && (
                            <TooltipProvider delayDuration={150}>
                              <Tooltip>
                                <TooltipTrigger asChild onClick={(e) => e.stopPropagation()}>
                                  <Badge
                                    variant="outline"
                                    className="h-5 shrink-0 border-muted-foreground/30 bg-muted px-1.5 text-[9px] font-semibold text-muted-foreground"
                                  >
                                    CONTA INTERNA
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[240px] text-xs">
                                  Esta DM veio de outra conta do Instagram conectada à sua organização.
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        {channel === "instagram" && (
                          <div className="truncate pt-0.5 text-xs text-muted-foreground">
                            {instagramLabel}
                          </div>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {(() => {
                      if (channel === "instagram") {
                        return instagramLabel;
                      }
                      return contact.phone || "—";
                    })()}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">
                    {contact.email || "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground">
                    {(contact.instances as any)?.name || "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex gap-1 flex-wrap">
                      {contact.tags?.slice(0, 3).map((tag) => (
                        <Badge
                          key={tag}
                          variant="outline"
                          className="text-xs bg-accent/15 text-accent border-accent/30 font-normal"
                        >
                          {tag}
                        </Badge>
                      ))}
                      {(contact.tags?.length ?? 0) > 3 && (
                        <Badge variant="outline" className="text-xs">
                          +{(contact.tags?.length ?? 0) - 3}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  {!showArchived && (
                    <TableCell>
                      <div onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-accent hover:text-accent hover:bg-accent/10"
                          title="Conversar"
                          onClick={() => onNavigateToConversation?.(contact.id)}
                        >
                          <MessageSquare className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  {showArchived && (
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Desarquivar"
                          onClick={() => archiveMutation.mutate({ id: contact.id, archived: false })}
                        >
                          <ArchiveRestore className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          title="Excluir permanentemente"
                          onClick={() => setDeleteContactId(contact.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              )})}
            </TableBody>
          </Table>
        )}
      </div>

      <AddContactDialog open={showAddDialog} onOpenChange={setShowAddDialog} />

      {/* Import Wizard */}
      {organization?.id && (
        <ImportContactsWizard
          open={showImportDialog}
          onOpenChange={setShowImportDialog}
          organizationId={organization.id}
        />
      )}

      {/* Delete Single Confirmation */}
      <AlertDialog open={!!deleteContactId} onOpenChange={(open) => !open && setDeleteContactId(null)}>
        <AlertDialogContent className="z-[100]" style={{ position: 'fixed' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O contato e todos os dados associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteContactId && deleteMutation.mutate(deleteContactId)}
            >
              {deleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={showBulkDeleteAlert} onOpenChange={setShowBulkDeleteAlert}>
        <AlertDialogContent className="z-[100]" style={{ position: 'fixed' }}>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedContactIds.size} contato(s)?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Todos os contatos selecionados e seus dados associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => bulkDeleteMutation.mutate(Array.from(selectedContactIds))}
            >
              {bulkDeleteMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Excluir Selecionados
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Folder management dialogs */}
      <ContactFoldersDialog open={showFoldersDialog} onOpenChange={setShowFoldersDialog} />
      <AssignToFolderDialog
        open={showAssignFolderDialog}
        onOpenChange={setShowAssignFolderDialog}
        contactIds={Array.from(selectedContactIds)}
        onAssigned={() => setSelectedContactIds(new Set())}
      />
    </div>
  );
}
