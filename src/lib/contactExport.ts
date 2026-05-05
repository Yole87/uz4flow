import * as XLSX from "xlsx";
import { stripPhone } from "@/lib/phoneFormat";

export interface ExportableContact {
  id: string;
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  tags?: string[] | null;
  channel?: string | null;
  is_blocked?: boolean | null;
  is_archived?: boolean | null;
  last_interaction_at?: string | null;
  created_at?: string | null;
  metadata?: any;
  // Joined relations (any of the shapes used across the app)
  stage?: { name?: string | null; pipeline?: { name?: string | null } | null } | null;
  pipeline_stage?: { name?: string | null; pipeline?: { name?: string | null } | null } | null;
  instances?: { name?: string | null; channel?: string | null } | null;
  instance?: { name?: string | null; channel?: string | null } | null;
  team_members?: { first_name?: string | null; last_name?: string | null } | null;
  assigned_member?: { first_name?: string | null; last_name?: string | null } | null;
}

export const EXPORT_COLUMNS = [
  "Nome",
  "Telefone",
  "Email",
  "Tags",
  "Funil",
  "Etapa",
  "Atendente",
  "Instância",
  "Canal",
  "Última interação",
  "Bloqueado",
  "Arquivado",
  "Criado em",
  "Notas",
] as const;

function fmtDate(value?: string | null): string {
  if (!value) return "";
  try {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString("pt-BR");
  } catch {
    return "";
  }
}

export function contactToRow(c: ExportableContact): string[] {
  const stage = c.stage || c.pipeline_stage || null;
  const pipelineName = stage?.pipeline?.name || "";
  const stageName = stage?.name || "";
  const inst = c.instances || c.instance || null;
  const member = c.team_members || c.assigned_member || null;
  const memberName = member
    ? `${member.first_name || ""} ${member.last_name || ""}`.trim()
    : "";
  const channel = c.channel || inst?.channel || "";
  const notes =
    typeof c.metadata === "object" && c.metadata && "notes" in c.metadata
      ? String(c.metadata.notes ?? "")
      : "";

  return [
    c.name || "",
    c.phone ? stripPhone(c.phone) : "",
    c.email || "",
    (c.tags || []).join(";"),
    pipelineName,
    stageName,
    memberName,
    inst?.name || "",
    channel,
    fmtDate(c.last_interaction_at),
    c.is_blocked ? "Sim" : "Não",
    c.is_archived ? "Sim" : "Não",
    fmtDate(c.created_at),
    notes,
  ];
}

function triggerDownload(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeCsv(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

export function exportContactsCSV(contacts: ExportableContact[], baseFilename: string) {
  const header = EXPORT_COLUMNS.map(escapeCsv).join(",");
  const rows = contacts.map((c) => contactToRow(c).map(escapeCsv).join(","));
  // BOM for Excel UTF-8
  const csv = "\uFEFF" + [header, ...rows].join("\n");
  triggerDownload(csv, `${baseFilename}.csv`, "text/csv;charset=utf-8;");
}

export function exportContactsXLSX(contacts: ExportableContact[], baseFilename: string) {
  const aoa = [EXPORT_COLUMNS as unknown as string[], ...contacts.map(contactToRow)];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Contatos");
  const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  triggerDownload(
    buf,
    `${baseFilename}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}

export function exportContactsTXT(contacts: ExportableContact[], baseFilename: string) {
  const lines = contacts.map((c) => {
    const row = contactToRow(c);
    return EXPORT_COLUMNS.map((col, i) => `${col}: ${row[i]}`).join(" | ");
  });
  triggerDownload(lines.join("\n"), `${baseFilename}.txt`, "text/plain;charset=utf-8;");
}
