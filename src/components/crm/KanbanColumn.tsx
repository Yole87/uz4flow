import { useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { KanbanCard } from "./KanbanCard";
import { cn } from "@/lib/utils";
import { Download, FileText, FileSpreadsheet, File, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  exportContactsCSV,
  exportContactsXLSX,
  exportContactsTXT,
  type ExportableContact,
} from "@/lib/contactExport";

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  avatar_url: string | null;
  pipeline_stage_id: string | null;
  last_interaction_at: string | null;
  tags: string[] | null;
  assigned_to_member_id?: string | null;
  conversations?: {
    last_message_preview: string | null;
  }[];
  team_members?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface KanbanColumnProps {
  id: string;
  title: string;
  color: string;
  contacts: Contact[];
  description?: string | null;
}

function slugify(text: string) {
  return text.toLowerCase().replace(/\s+/g, "_").replace(/[^\w]/g, "");
}

export function KanbanColumn({ id, title, color, contacts, description }: KanbanColumnProps) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const [exporting, setExporting] = useState(false);
  const baseFilename = `${slugify(title)}_contatos`;

  async function fetchEnriched(): Promise<ExportableContact[]> {
    const ids = contacts.map((c) => c.id);
    if (ids.length === 0) return [];
    const { data, error } = await supabase
      .from("contacts")
      .select(
        `id, name, phone, email, tags, channel, is_blocked, is_archived,
         last_interaction_at, created_at, metadata,
         instances:instance_id(name, channel),
         stage:pipeline_stage_id(name, pipeline:pipelines(name)),
         team_members:assigned_to_member_id(first_name, last_name)`,
      )
      .in("id", ids);
    if (error) throw error;
    return (data || []) as unknown as ExportableContact[];
  }

  const runExport = async (kind: "csv" | "xlsx" | "txt") => {
    if (exporting) return;
    setExporting(true);
    try {
      const enriched = await fetchEnriched();
      if (enriched.length === 0) {
        toast.error("Nenhum contato para exportar");
        return;
      }
      if (kind === "csv") exportContactsCSV(enriched, baseFilename);
      else if (kind === "xlsx") exportContactsXLSX(enriched, baseFilename);
      else exportContactsTXT(enriched, baseFilename);
      toast.success(`${enriched.length} contato(s) exportado(s)`);
    } catch (e) {
      console.error("Kanban export error:", e);
      toast.error("Erro ao exportar contatos");
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex-shrink-0 w-64 sm:w-72 flex flex-col bg-muted/50 rounded-xl border transition-colors",
        isOver ? "border-primary/50 bg-muted" : "border-border"
      )}
    >
      {/* Header */}
      <div className="p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: color }}
          />
          <h3 className="font-medium text-foreground text-sm">{title}</h3>
          <span className="ml-auto text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {contacts.length}
          </span>
          {contacts.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={exporting}
                  className="h-6 w-6 text-muted-foreground hover:text-foreground"
                  title="Exportar contatos"
                >
                  {exporting ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="bg-card border-border">
                <DropdownMenuItem onClick={() => runExport("csv")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Exportar .csv
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("xlsx")}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Exportar .xlsx
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => runExport("txt")}>
                  <File className="h-4 w-4 mr-2" />
                  Exportar .txt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1 leading-tight">{description}</p>
        )}
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-12rem)] quantum-scrollbar">
        {contacts.map((contact) => (
          <KanbanCard key={contact.id} contact={contact} />
        ))}
        
        {contacts.length === 0 && (
          <div className="text-center py-8 text-muted-foreground text-sm">
            Arraste contatos aqui
          </div>
        )}
      </div>
    </div>
  );
}
