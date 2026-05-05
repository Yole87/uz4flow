import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { InlineProgressHeader } from "./InlineProgressHeader";
import { ProspectionErrorCard } from "./ProspectionErrorCard";
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  Users, 
  Phone, 
  Mail, 
  Globe, 
  MessageCircle,
  Instagram,
  Facebook,
  Linkedin,
  Map,
  ExternalLink,
  Search,
  Loader2,
  UserPlus,
  Sparkles,
  CheckCircle2,
  XCircle,
  Download,
  FileSpreadsheet,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatPhoneInput } from "@/lib/phoneFormat";

interface Lead {
  business_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  address: string | null;
  social_urls: Record<string, string>;
  has_whatsapp: boolean;
  ai_score: number;
  ai_analysis?: { summary?: string };
  source_url: string;
}

interface SearchMetrics {
  pages_processed?: number;
  additional_scrapes?: number;
  duplicates_removed?: number;
  search_depth?: string;
  requests_made?: number;
  tiles_total?: number;
  tiles_processed?: number;
}

interface SearchStatus {
  status: "pending" | "running" | "processing" | "completed" | "failed" | "stopped";
  total_found: number;
  current_phase: string;
  progress_percent: number;
  leads: Lead[];
  error_message?: string | null;
  metrics?: SearchMetrics;
}

interface ProspectionResultsProps {
  results: Lead[];
  isLoading: boolean;
  searchId: string | null;
  metrics?: SearchMetrics | null;
  searchStatus?: SearchStatus | null;
  elapsedTime?: number;
  onStopSearch?: () => void;
  onNewSearch?: () => void;
  onGoToConfig?: () => void;
  onLeadsSaved?: () => void;
}

export function ProspectionResults({ 
  results, 
  isLoading, 
  searchId, 
  metrics,
  searchStatus,
  elapsedTime = 0,
  onStopSearch,
  onNewSearch,
  onGoToConfig,
  onLeadsSaved,
}: ProspectionResultsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();
  const [selectedLeads, setSelectedLeads] = useState<Set<number>>(new Set());
  const [isImporting, setIsImporting] = useState(false);
  const [importInstanceId, setImportInstanceId] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<"empresa" | "contato" | "score" | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Fetch instances for import
  const { data: importInstances } = useQuery({
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
  
  const prevLeadsRef = useRef<string[]>([]);
  const [newLeadIds, setNewLeadIds] = useState<Set<string>>(new Set());

  const displayResultsRaw = searchStatus?.leads || results;
  const displayMetrics = searchStatus?.metrics || metrics;
  const isProcessing = searchStatus?.status === "processing" || searchStatus?.status === "running" || searchStatus?.status === "pending";
  const isCompleted = searchStatus?.status === "completed";
  const isStopped = searchStatus?.status === "stopped";
  const isFailed = searchStatus?.status === "failed";

  const formatPhoneDisplay = (phone: string): string => {
    const formatted = formatPhoneInput(phone);
    // Replace last hyphen with dot: +55 (11) 91234-5678 → +55 (11) 91234.5678
    return formatted.replace(/-([^-]*)$/, ".$1");
  };

  const toggleSort = (column: "empresa" | "contato" | "score") => {
    if (sortColumn === column) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortColumn(null); setSortDirection("asc"); }
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: "empresa" | "contato" | "score") => {
    if (sortColumn !== column) return <ArrowUpDown className="h-3 w-3 ml-1 opacity-40" />;
    return sortDirection === "asc" 
      ? <ArrowUp className="h-3 w-3 ml-1" /> 
      : <ArrowDown className="h-3 w-3 ml-1" />;
  };

  const displayResults = useMemo(() => {
    if (!sortColumn) return displayResultsRaw;
    const sorted = [...displayResultsRaw];
    sorted.sort((a, b) => {
      let cmp = 0;
      switch (sortColumn) {
        case "empresa":
          cmp = (a.business_name || "").localeCompare(b.business_name || "");
          break;
        case "contato":
          cmp = (a.phone || a.email ? 1 : 0) - (b.phone || b.email ? 1 : 0);
          break;
        case "score":
          cmp = (a.ai_score || 0) - (b.ai_score || 0);
          break;
      }
      return sortDirection === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [displayResultsRaw, sortColumn, sortDirection]);

  useEffect(() => {
    const currentIds = displayResults.map(l => l.business_name);
    const prevIds = prevLeadsRef.current;
    const newIds = currentIds.filter(id => !prevIds.includes(id));
    if (newIds.length > 0 && prevIds.length > 0) {
      setNewLeadIds(new Set(newIds));
      const timeout = setTimeout(() => {
        setNewLeadIds(new Set());
      }, 2000);
      return () => clearTimeout(timeout);
    }
    prevLeadsRef.current = currentIds;
  }, [displayResults]);

  const toggleLead = (index: number) => {
    setSelectedLeads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const toggleAll = () => {
    if (selectedLeads.size === displayResults.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(displayResults.map((_, i) => i)));
    }
  };

  const importLeadsMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("Organização não encontrada");
      const leadsToImport = displayResults.filter((_, i) => selectedLeads.has(i));
      
      // Deduplicate by phone within the batch
      const seen = new Set<string>();
      const uniqueContacts = leadsToImport.filter(lead => {
        const phone = lead.phone?.trim() || "";
        if (!phone) return true; // leads without phone always pass (will use null)
        if (seen.has(phone)) return false;
        seen.add(phone);
        return true;
      });

      const contacts = uniqueContacts.map(lead => ({
        organization_id: organization.id,
        name: lead.business_name,
        phone: lead.phone?.trim() || null,
        email: lead.email,
        instance_id: importInstanceId || null,
        metadata: {
          source: "prospection",
          search_id: searchId,
          website: lead.website,
          address: lead.address,
          social_urls: lead.social_urls,
          ai_score: lead.ai_score,
          ai_analysis: lead.ai_analysis,
        },
        tags: ["prospecção"],
      }));

      // Split: contacts with phone (can upsert) and without phone (insert individually)
      const withPhone = contacts.filter(c => c.phone);
      const withoutPhone = contacts.filter(c => !c.phone);

      let imported = 0;
      let skipped = 0;

      if (withPhone.length > 0) {
        const { data, error } = await supabase.from("contacts").upsert(
          withPhone as any,
          { onConflict: "organization_id,phone", ignoreDuplicates: true }
        ).select("id");
        if (error) throw error;
        imported += data?.length || 0;
        skipped += withPhone.length - (data?.length || 0);
      }

      // Insert contacts without phone one by one (no unique constraint issue with null)
      for (const contact of withoutPhone) {
        const { error } = await supabase.from("contacts").insert({ ...contact, phone: "" });
        if (!error) imported++;
        else skipped++;
      }

      return { imported, skipped, total: leadsToImport.length };
    },
    onSuccess: ({ imported, skipped }) => {
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      const desc = skipped > 0 
        ? `${imported} contatos adicionados, ${skipped} já existiam no CRM`
        : `${imported} contatos adicionados ao CRM`;
      toast({ title: "Leads importados!", description: desc });
      setSelectedLeads(new Set());
      // Marca a busca persistida como salva
      onLeadsSaved?.();
    },
    onError: (error) => {
      toast({ title: "Erro ao importar", description: error.message, variant: "destructive" });
    },
    onSettled: () => {
      setIsImporting(false);
    },
  });

  const handleImport = () => {
    if (selectedLeads.size === 0) {
      toast({ title: "Selecione pelo menos um lead", variant: "destructive" });
      return;
    }
    if (!importInstanceId) {
      toast({ title: "Selecione uma instância para importar", variant: "destructive" });
      return;
    }
    setIsImporting(true);
    importLeadsMutation.mutate();
  };

  const escapeXml = (str: string): string => {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  };

  const exportToCSV = () => {
    if (displayResults.length === 0) {
      toast({ title: "Nenhum lead para exportar", variant: "destructive" });
      return;
    }
    const headers = ["Empresa", "Telefone", "Email", "Website", "WhatsApp", "Score IA", "Fonte"];
    const rows = displayResults.map(lead => [
      lead.business_name || "", lead.phone || "", lead.email || "", lead.website || "",
      lead.has_whatsapp ? "Sim" : "Não", String(lead.ai_score || 0), lead.source_url || "",
    ]);
    const csvContent = [headers.join(","), ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_prospeccao_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV exportado!", description: `${displayResults.length} leads exportados` });
  };

  const exportToExcel = () => {
    if (displayResults.length === 0) {
      toast({ title: "Nenhum lead para exportar", variant: "destructive" });
      return;
    }
    const headers = ["Empresa", "Telefone", "Email", "Website", "WhatsApp", "Score IA", "Fonte"];
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<?mso-application progid="Excel.Sheet"?>\n';
    xml += '<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n';
    xml += '<Worksheet ss:Name="Leads">\n<Table>\n';
    xml += '<Row>\n';
    headers.forEach(header => { xml += `<Cell><Data ss:Type="String">${escapeXml(header)}</Data></Cell>\n`; });
    xml += '</Row>\n';
    displayResults.forEach(lead => {
      xml += '<Row>\n';
      xml += `<Cell><Data ss:Type="String">${escapeXml(lead.business_name || "")}</Data></Cell>\n`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(lead.phone || "")}</Data></Cell>\n`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(lead.email || "")}</Data></Cell>\n`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(lead.website || "")}</Data></Cell>\n`;
      xml += `<Cell><Data ss:Type="String">${lead.has_whatsapp ? "Sim" : "Não"}</Data></Cell>\n`;
      xml += `<Cell><Data ss:Type="Number">${lead.ai_score || 0}</Data></Cell>\n`;
      xml += `<Cell><Data ss:Type="String">${escapeXml(lead.source_url || "")}</Data></Cell>\n`;
      xml += '</Row>\n';
    });
    xml += '</Table>\n</Worksheet>\n</Workbook>';
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads_prospeccao_${new Date().toISOString().split("T")[0]}.xls`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Excel exportado!", description: `${displayResults.length} leads exportados` });
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-success drop-shadow-[0_0_6px_hsl(var(--success)/0.5)]";
    if (score >= 60) return "text-accent drop-shadow-[0_0_6px_hsl(var(--accent)/0.4)]";
    if (score >= 40) return "text-warning";
    return "text-destructive";
  };

  const getSocialIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case "instagram": return <Instagram className="h-4 w-4 text-pink-400" />;
      case "facebook": return <Facebook className="h-4 w-4 text-secondary" />;
      case "linkedin": return <Linkedin className="h-4 w-4 text-secondary" />;
      case "googlemaps":
      case "maps": return <Map className="h-4 w-4 text-success" />;
      default: return <Globe className="h-4 w-4 text-muted-foreground" />;
    }
  };

  // Initial loading state
  if (isLoading && !searchStatus) {
    return (
      <Card className="border-accent/20 h-full">
        <CardContent className="flex flex-col items-center justify-center h-96 gap-4">
          <Loader2 className="h-12 w-12 animate-spin text-accent" />
          <p className="text-muted-foreground">Iniciando busca...</p>
        </CardContent>
      </Card>
    );
  }

  // Stopped state with zero results
  if (isStopped && displayResults.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={XCircle}
        title="Busca interrompida"
        description="Nenhum lead foi encontrado antes da interrupção. Tente uma nova busca com termos ou localização diferentes."
        action={
          onNewSearch
            ? {
                label: "Nova Busca",
                onClick: onNewSearch,
                icon: Search,
              }
            : undefined
        }
      />
    );
  }

  // Empty state
  if (displayResults.length === 0 && !isProcessing && !isFailed) {
    return (
      <EmptyState
        variant="card"
        icon={Search}
        title="Nenhuma prospecção ativa"
        description="Use o formulário ao lado para encontrar leads qualificados com IA. Defina palavra-chave, localização e canais para começar."
        action={
          onNewSearch
            ? {
                label: "Nova busca",
                onClick: onNewSearch,
                icon: Search,
              }
            : undefined
        }
      />
    );
  }

  // Error state
  if (isFailed) {
    return (
      <ProspectionErrorCard
        errorMessage={searchStatus?.error_message}
        onRetry={onNewSearch}
        onGoToConfig={onGoToConfig}
        leadsFound={displayResults.length}
      />
    );
  }

  // Unified table view
  return (
    <Card className="border-accent/20 flex flex-col h-full hover:shadow-[0_0_25px_hsl(var(--accent)/0.1)]">
      {isProcessing && searchStatus && onStopSearch ? (
        <InlineProgressHeader
          currentPhase={searchStatus.current_phase}
          progressPercent={searchStatus.progress_percent}
          leadsFound={searchStatus.total_found}
          elapsedTime={elapsedTime}
          onStop={onStopSearch}
        />
      ) : (
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <CardTitle className="text-foreground flex items-center gap-2">
              {isCompleted && <CheckCircle2 className="h-5 w-5 text-success" />}
              {isStopped && <XCircle className="h-5 w-5 text-warning" />}
              <Sparkles className="h-5 w-5 text-accent" />
              Resultados ({displayResults.length})
            </CardTitle>
            <CardDescription className="text-muted-foreground space-y-1">
              <span>{selectedLeads.size} leads selecionados</span>
              {isStopped && (
                <Badge variant="outline" className="ml-2 bg-warning/10 text-warning border-warning/30">
                  Busca interrompida
                </Badge>
              )}
              {displayMetrics && (
                <div className="flex flex-wrap gap-2 text-xs mt-1">
                  <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                    {displayMetrics.pages_processed} páginas
                  </Badge>
                  {displayMetrics.additional_scrapes > 0 && (
                    <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                      +{displayMetrics.additional_scrapes} páginas extras
                    </Badge>
                  )}
                  {displayMetrics.duplicates_removed > 0 && (
                    <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                      {displayMetrics.duplicates_removed} duplicatas removidas
                    </Badge>
                  )}
                </div>
              )}
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={toggleAll}
              className="border-border text-foreground hover:bg-muted"
            >
              {selectedLeads.size === displayResults.length ? "Desmarcar" : "Selecionar"}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={displayResults.length === 0}
                  className="border-border text-foreground hover:bg-muted"
                >
                  <Download className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Exportar</span>
                  <ChevronDown className="h-3 w-3 ml-1" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportToCSV} className="cursor-pointer">
                  <Download className="h-4 w-4 mr-2" />
                  CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={exportToExcel} className="cursor-pointer">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Excel (.xls)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {/* Instance selector for import */}
            {importInstances && importInstances.length > 0 && (
              <Select value={importInstanceId} onValueChange={setImportInstanceId}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue placeholder="Instância..." />
                </SelectTrigger>
                <SelectContent>
                  {importInstances.map(inst => (
                    <SelectItem key={inst.id} value={inst.id}>{inst.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button
              size="sm"
              onClick={handleImport}
              disabled={selectedLeads.size === 0 || isImporting || !importInstanceId}
              className="gradient-primary hover:opacity-90 text-primary-foreground"
            >
              {isImporting ? (
                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 sm:mr-2" />
              )}
              <span className="hidden sm:inline">Importar CRM</span>
            </Button>
          </div>
        </CardHeader>
      )}

      {/* Results table */}
      <CardContent className={`p-0 flex-1 overflow-hidden ${isProcessing ? "pt-0" : ""}`}>
        <div className="rounded-lg border border-border overflow-hidden mx-3 sm:mx-6 mb-3 sm:mb-6 h-full">
          <div className="max-h-[calc(100vh-320px)] overflow-x-auto overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-muted/80 z-10">
                <TableRow className="border-border hover:bg-muted/50">
                  <TableHead className="w-10 text-muted-foreground"></TableHead>
                  <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("empresa")}>
                    <span className="flex items-center">Empresa {getSortIcon("empresa")}</span>
                  </TableHead>
                  <TableHead className="text-muted-foreground cursor-pointer select-none" onClick={() => toggleSort("contato")}>
                    <span className="flex items-center">Contato {getSortIcon("contato")}</span>
                  </TableHead>
                  <TableHead className="text-muted-foreground">Redes Sociais</TableHead>
                  <TableHead className="text-muted-foreground text-center cursor-pointer select-none" onClick={() => toggleSort("score")}>
                    <span className="flex items-center justify-center">Score IA {getSortIcon("score")}</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayResults.map((lead, index) => {
                  const isNew = newLeadIds.has(lead.business_name);
                  return (
                    <TableRow 
                      key={`${lead.business_name}-${index}`}
                      className={`
                        border-border hover:bg-muted/50 cursor-pointer
                        ${selectedLeads.has(index) ? "bg-accent/10" : ""}
                        ${isNew ? "animate-slide-in-up animate-highlight-new" : ""}
                      `}
                      onClick={() => toggleLead(index)}
                    >
                      <TableCell>
                        <Checkbox 
                          checked={selectedLeads.has(index)}
                          onCheckedChange={() => toggleLead(index)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-medium text-foreground">
                            {lead.business_name || "Sem nome"}
                            {isNew && (
                              <Badge className="ml-2 text-xs bg-accent/20 text-accent border-accent/30">
                                Novo
                              </Badge>
                            )}
                          </p>
                          {lead.ai_analysis?.summary && (
                            <p className="text-xs text-muted-foreground line-clamp-2">
                              {lead.ai_analysis.summary}
                            </p>
                          )}
                          {lead.source_url && (
                            <a 
                              href={lead.source_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs text-secondary hover:underline flex items-center gap-1"
                            >
                              <ExternalLink className="h-3 w-3" />
                              Ver fonte
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {lead.phone && (
                            <div className="flex items-center gap-1.5 text-sm">
                              {lead.has_whatsapp ? (
                                <MessageCircle className="h-4 w-4 text-success" />
                              ) : (
                                <Phone className="h-4 w-4 text-muted-foreground" />
                              )}
                              <span className="text-foreground">{formatPhoneDisplay(lead.phone)}</span>
                              {lead.has_whatsapp && (
                                <Badge className="text-xs bg-success/20 text-success border-success/30">
                                  WhatsApp
                                </Badge>
                              )}
                            </div>
                          )}
                          {lead.email && (
                            <div className="flex items-center gap-1.5 text-sm">
                              <Mail className="h-4 w-4 text-muted-foreground" />
                              <span className="text-muted-foreground">{lead.email}</span>
                            </div>
                          )}
                          {!lead.phone && !lead.email && (
                            <span className="text-muted-foreground text-sm">Sem contato</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {lead.social_urls && Object.entries(lead.social_urls).map(([platform, url]) => (
                            url && (
                              <a
                                key={platform}
                                href={url as string}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1.5 rounded-full hover:bg-muted transition-colors"
                                title={platform}
                              >
                                {getSocialIcon(platform)}
                              </a>
                            )
                          ))}
                          {(!lead.social_urls || Object.keys(lead.social_urls).length === 0) && (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-lg font-bold ${getScoreColor(lead.ai_score || 0)}`}>
                            {lead.ai_score || 0}%
                          </span>
                          <Progress 
                            value={lead.ai_score || 0} 
                            className="w-16 h-1.5 bg-muted"
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {isProcessing && displayResults.length > 0 && (
          <p className="text-center text-xs text-muted-foreground pb-4">
            Os leads já encontrados serão mantidos mesmo após parar a busca
          </p>
        )}
      </CardContent>
    </Card>
  );
}
