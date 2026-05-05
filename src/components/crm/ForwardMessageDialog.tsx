import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface ForwardMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  messages: { content: string | null; content_type: string; media_url: string | null }[];
  sourceContactId: string;
}

export function ForwardMessageDialog({
  open,
  onOpenChange,
  messages,
  sourceContactId,
}: ForwardMessageDialogProps) {
  const [search, setSearch] = useState("");
  const { data: org } = useUserOrganization();

  const { data: contacts, isLoading } = useQuery({
    queryKey: ["crm-forward-contacts", org?.id],
    queryFn: async () => {
      if (!org?.id) return [];
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone, avatar_url")
        .eq("organization_id", org.id)
        .neq("id", sourceContactId)
        .order("name", { ascending: true })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: open && !!org?.id,
  });

  const forwardMutation = useMutation({
    mutationFn: async (targetContactId: string) => {
      // Get conversation for target contact
      const { data: conv, error: convErr } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", targetContactId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (convErr) throw convErr;
      if (!conv) throw new Error("Contato não possui conversa ativa");

      // Send each message
      for (const msg of messages) {
        if (!msg.content && !msg.media_url) continue;
        const { error } = await supabase.functions.invoke("crm-send-message", {
          body: {
            conversation_id: conv.id,
            message: msg.content || "",
          },
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`${messages.length} mensagem(ns) encaminhada(s)`);
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao encaminhar");
    },
  });

  const filtered = contacts?.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Encaminhar {messages.length} mensagem(ns)</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="max-h-[300px]">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered?.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum contato encontrado
            </p>
          ) : (
            <div className="space-y-1">
              {filtered?.map((contact) => {
                const name = contact.name || contact.phone;
                const initials = name.slice(0, 2).toUpperCase();
                return (
                  <button
                    key={contact.id}
                    onClick={() => forwardMutation.mutate(contact.id)}
                    disabled={forwardMutation.isPending}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted transition-colors text-left disabled:opacity-50"
                  >
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={contact.avatar_url || undefined} />
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{name}</p>
                      <p className="text-xs text-muted-foreground truncate">{contact.phone}</p>
                    </div>
                    {forwardMutation.isPending && forwardMutation.variables === contact.id ? (
                      <Loader2 className="h-4 w-4 animate-spin text-accent shrink-0" />
                    ) : (
                      <Send className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
