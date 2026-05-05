import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Users } from "lucide-react";
import { ManualContact } from "./ContactImportTab";

export interface CRMSelectedContact {
  id: string;
  name: string | null;
  phone: string;
}

interface CRMContactsTabProps {
  selected: CRMSelectedContact[];
  onChange: (selected: CRMSelectedContact[]) => void;
  manualContacts?: ManualContact[];
}

export function CRMContactsTab({ selected, onChange, manualContacts = [] }: CRMContactsTabProps) {
  const [search, setSearch] = useState("");
  const { data: organization } = useUserOrganization();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["crm-contacts-followup", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone, pipeline_stage_id, tags, stages:pipeline_stage_id(name)")
        .eq("organization_id", organization.id)
        .eq("is_archived", false)
        .order("name", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!organization?.id,
  });

  // Build set of phones already in manual list for dedup
  const manualPhones = new Set(manualContacts.map((c) => c.phone.replace(/\D/g, "")));

  const filtered = contacts.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.name?.toLowerCase().includes(q) || c.phone.includes(q);
  });

  const selectedIds = new Set(selected.map((s) => s.id));

  const toggleContact = (contact: CRMSelectedContact) => {
    if (selectedIds.has(contact.id)) {
      onChange(selected.filter((s) => s.id !== contact.id));
    } else {
      // Check dedup against manual contacts
      const normalizedPhone = contact.phone.replace(/\D/g, "");
      if (manualPhones.has(normalizedPhone)) {
        return; // Already in manual list, silently ignore
      }
      // Check dedup against already selected CRM contacts
      if (selected.some((s) => s.phone.replace(/\D/g, "") === normalizedPhone)) {
        return;
      }
      onChange([...selected, contact]);
    }
  };

  const selectAll = () => {
    const deduped = filtered.filter((c) => {
      const phone = c.phone.replace(/\D/g, "");
      return !manualPhones.has(phone);
    });
    // Deduplicate by phone within CRM list
    const seen = new Set<string>();
    const unique: CRMSelectedContact[] = [];
    for (const c of deduped) {
      const phone = c.phone.replace(/\D/g, "");
      if (!seen.has(phone)) {
        seen.add(phone);
        unique.push({ id: c.id, name: c.name, phone: c.phone });
      }
    }
    onChange(unique);
  };

  const clearAll = () => onChange([]);

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button variant="outline" size="sm" onClick={selectAll}>Selecionar todos</Button>
        <Button variant="ghost" size="sm" onClick={clearAll}>Limpar</Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full bg-muted" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-40" />
          Nenhum contato encontrado
        </div>
      ) : (
        <div className="border border-border rounded-md divide-y divide-border max-h-60 overflow-y-auto">
          {filtered.map((c) => {
            const normalizedPhone = c.phone.replace(/\D/g, "");
            const isDuplicate = manualPhones.has(normalizedPhone);
            const stageName = (c as any).stages?.name;

            return (
              <label
                key={c.id}
                className={`flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors ${isDuplicate ? "opacity-50" : ""}`}
              >
                <Checkbox
                  checked={selectedIds.has(c.id)}
                  onCheckedChange={() => toggleContact({ id: c.id, name: c.name, phone: c.phone })}
                  disabled={isDuplicate}
                />
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-foreground">{c.name || <span className="text-muted-foreground italic">Sem nome</span>}</span>
                    <span className="text-muted-foreground">{c.phone}</span>
                    {isDuplicate && <Badge variant="outline" className="text-xs h-4">Duplicado</Badge>}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                    {stageName && (
                      <Badge variant="secondary" className="text-xs h-4">
                        {stageName}
                      </Badge>
                    )}
                    {c.tags?.map((tag: string) => (
                      <Badge key={tag} variant="outline" className="text-xs h-4">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </div>
              </label>
            );
          })}
        </div>
      )}

      {selected.length > 0 && (
        <p className="text-xs text-muted-foreground">
          <Users className="h-3 w-3 inline mr-1" />
          {selected.length} contato(s) selecionado(s)
        </p>
      )}
    </div>
  );
}
