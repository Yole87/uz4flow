import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Upload, Trash2, FileText, XCircle } from "lucide-react";
import { toast } from "sonner";

export interface ManualContact {
  name: string;
  phone: string;
  id: string;
}

interface ContactImportTabProps {
  contacts: ManualContact[];
  onChange: (contacts: ManualContact[]) => void;
}

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, "");
}

function deduplicateContacts(
  newContacts: ManualContact[],
  existing: ManualContact[]
): { unique: ManualContact[]; duplicates: number; invalid: number } {
  const existingPhones = new Set(existing.map((c) => normalizePhone(c.phone)));
  const seenPhones = new Set<string>();
  const unique: ManualContact[] = [];
  let duplicates = 0;
  let invalid = 0;

  for (const c of newContacts) {
    const phone = normalizePhone(c.phone);
    if (phone.length < 10) {
      invalid++;
      continue;
    }
    if (existingPhones.has(phone) || seenPhones.has(phone)) {
      duplicates++;
      continue;
    }
    seenPhones.add(phone);
    unique.push({ ...c, phone });
  }

  return { unique, duplicates, invalid };
}

function parseCSV(text: string): ManualContact[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length === 0) return [];

  const firstLine = lines[0];
  const separator = firstLine.includes("\t") ? "\t" : firstLine.includes(";") ? ";" : ",";

  const rows = lines.map((l) => l.split(separator).map((c) => c.trim().replace(/^["']|["']$/g, "")));
  const header = rows[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, ""));

  const nameIdx = header.findIndex((h) => h.includes("nome") || h === "name");
  const phoneIdx = header.findIndex((h) => h.includes("telefone") || h.includes("phone") || h.includes("celular") || h.includes("fone"));

  const hasHeader = phoneIdx >= 0;
  const dataRows = hasHeader ? rows.slice(1) : rows;

  const contacts: ManualContact[] = [];
  for (const row of dataRows) {
    if (row.every((c) => !c)) continue;

    let name = "";
    let phone = "";

    if (hasHeader) {
      name = nameIdx >= 0 ? row[nameIdx] || "" : "";
      phone = row[phoneIdx] || "";
    } else if (row.length === 1) {
      phone = row[0];
    } else {
      const isPhone = /^\+?\d{10,15}$/.test(row[0].replace(/\D/g, ""));
      if (isPhone) {
        phone = row[0];
        name = row[1] || "";
      } else {
        name = row[0];
        phone = row[1] || "";
      }
    }

    phone = phone.replace(/\D/g, "");
    if (phone.length >= 10) {
      contacts.push({ name, phone, id: crypto.randomUUID() });
    }
  }
  return contacts;
}

export function ContactImportTab({ contacts, onChange }: ContactImportTabProps) {
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addContact = () => {
    const phone = normalizePhone(newPhone);
    if (phone.length < 10) {
      toast.error("Telefone inválido. Use DDI+DDD+Número (ex: 5511983226145)");
      return;
    }
    // Check duplicate
    if (contacts.some((c) => normalizePhone(c.phone) === phone)) {
      toast.error("Este telefone já está na lista");
      return;
    }
    onChange([...contacts, { name: newName, phone, id: crypto.randomUUID() }]);
    setNewName("");
    setNewPhone("");
  };

  const removeContact = (id: string) => onChange(contacts.filter((c) => c.id !== id));

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseCSV(text);
      const { unique, duplicates, invalid } = deduplicateContacts(parsed, contacts);

      if (unique.length === 0 && parsed.length === 0) {
        toast.error("Nenhum contato válido encontrado no arquivo");
        return;
      }

      onChange([...contacts, ...unique]);

      const parts: string[] = [];
      if (unique.length > 0) parts.push(`${unique.length} contatos importados`);
      if (duplicates > 0) parts.push(`${duplicates} duplicados removidos`);
      if (invalid > 0) parts.push(`${invalid} inválidos removidos`);
      toast.success(parts.join(", "));
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearAll = () => {
    onChange([]);
    toast.success("Lista de contatos limpa");
  };

  return (
    <div className="space-y-4">
      {/* Add manual */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input placeholder="Nome (opcional)" value={newName} onChange={(e) => setNewName(e.target.value)} className="flex-1" />
        <div className="flex gap-2 flex-1">
          <Input placeholder="5511983226145" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} className="flex-1" />
          <Button size="icon" variant="outline" onClick={addContact} className="shrink-0">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Import + Clear buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <input ref={fileInputRef} type="file" accept=".csv,.txt" className="hidden" onChange={handleFileImport} />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-2" />
            Importar CSV/TXT
          </Button>
          {contacts.length > 0 && (
            <Button variant="ghost" size="sm" className="text-destructive" onClick={clearAll}>
              <XCircle className="h-4 w-4 mr-2" />
              Limpar lista
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground sm:ml-auto">Colunas: Nome, Telefone (DDI+DDD+Número)</p>
      </div>

      {/* Contact list */}
      {contacts.length > 0 && (
        <div className="border border-border rounded-md divide-y divide-border max-h-60 overflow-y-auto">
          {contacts.map((c) => (
            <div key={c.id} className="flex items-center justify-between px-3 py-2 text-sm">
              <div className="flex-1 min-w-0">
                <span className="text-foreground">{c.name || <span className="text-muted-foreground italic">Sem nome</span>}</span>
                <span className="text-muted-foreground ml-2">{c.phone}</span>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeContact(c.id)}>
                <Trash2 className="h-3 w-3 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {contacts.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <FileText className="h-3 w-3 inline mr-1" />
          {contacts.length} contato(s) na lista
        </p>
      )}
    </div>
  );
}
