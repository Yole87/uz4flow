import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageSquare,
  AlertCircle,
  Clock,
  ArrowRightCircle,
  Inbox,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { QueueRow } from "./AttendantQueueCard";

interface Props {
  row: QueueRow;
}

const PAGE_SIZE = 50;

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function memberInitials(name: string | null | undefined): string {
  const v = (name || "").trim();
  if (!v) return "?";
  return v
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function AttendantQueuePanel({ row }: Props) {
  const [visible, setVisible] = useState(PAGE_SIZE);
  const online = isOnline(row.last_seen_at);
  const display = row.member_name || row.user_email || "Atendente sem nome";
  const subtitle =
    [row.department, row.role_title].filter(Boolean).join(" · ") ||
    row.user_email ||
    "Sem departamento";

  const { data: realConversations, isLoading: isLoadingReal } = useQuery({
    queryKey: ["queue-panel-conversations", row.member_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select(
          "id, name, phone, conversations(id, last_message_at, last_message_preview, last_sender_type, status)",
        )
        .eq("assigned_to_member_id", row.member_id)
        .limit(200);
      if (error) throw error;
      const flat = (data ?? [])
        .flatMap((c: any) =>
          (c.conversations ?? [])
            .filter((conv: any) => conv.status === "active")
            .map((conv: any) => ({
              contactId: c.id,
              contactName: c.name || c.phone || "Sem nome",
              ...conv,
            })),
        )
        .sort(
          (a: any, b: any) =>
            new Date(b.last_message_at || 0).getTime() -
            new Date(a.last_message_at || 0).getTime(),
        );
      return flat;
    },
    enabled: !row.member_id.startsWith("mock-"),
    staleTime: 30 * 1000,
  });

  // 🧪 MOCK TEMPORÁRIO — gera conversas fictícias para member_id mock-*
  const mockNames = [
    "João Pereira", "Maria Santos", "Lucas Oliveira", "Beatriz Lima",
    "Gabriel Souza", "Larissa Cardoso", "Rafael Martins", "Juliana Rocha",
    "Pedro Henrique", "Camila Nogueira", "Thiago Ribeiro", "Fernanda Dias",
  ];
  const mockPreviews = [
    "Oi, queria saber sobre o plano Pro",
    "Já posso fazer o pagamento?",
    "Bom dia! Tudo certo com meu pedido?",
    "Recebi a fatura, mas tenho uma dúvida…",
    "Obrigado pelo atendimento!",
    "Pode me ajudar com a integração?",
    "Quanto custa o upgrade?",
    "Estou esperando há 10 minutos",
    "Aguardando retorno do suporte",
    "Quando vai chegar o produto?",
    "Posso parcelar em 3x?",
    "Acabei de fazer a compra",
  ];
  const isLoading = !row.member_id.startsWith("mock-") && isLoadingReal;
  const mockConversations = row.member_id.startsWith("mock-")
    ? Array.from({ length: row.active_conversations }).map((_, i) => ({
        id: `mock-conv-${row.member_id}-${i}`,
        contactId: `mock-contact-${row.member_id}-${i}`,
        contactName: mockNames[i % mockNames.length],
        last_message_at: new Date(
          Date.now() - (i + 1) * (3 + Math.floor(Math.random() * 20)) * 60 * 1000,
        ).toISOString(),
        last_message_preview: mockPreviews[i % mockPreviews.length],
        last_sender_type: i < row.pending_response ? "customer" : "agent",
        status: "active",
      }))
    : null;

  const conversations = mockConversations ?? realConversations;

  const list = conversations ?? [];
  const showing = list.slice(0, visible);

  return (
    <Card className="quantum-glass border-border/60 h-full">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start gap-3 pb-3 border-b border-border/40">
          <div className="relative shrink-0">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-primary font-semibold">
                {memberInitials(row.member_name || row.user_email)}
              </AvatarFallback>
            </Avatar>
            <span
              className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                online
                  ? "bg-emerald-500 shadow-[0_0_8px_hsl(142_71%_45%/0.6)]"
                  : "bg-muted-foreground/40"
              }`}
            />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-foreground truncate">
                {display}
              </h3>
              {online && (
                <Badge
                  variant="outline"
                  className="text-xs py-0 h-4 border-emerald-500/40 text-emerald-500"
                >
                  Online
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate">{subtitle}</p>

            <div className="flex items-center gap-4 mt-2 text-xs">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <MessageSquare className="h-3.5 w-3.5" />
                <span>
                  <span className="font-semibold text-foreground tabular-nums">
                    {row.active_conversations}
                  </span>{" "}
                  ativas
                </span>
              </div>
              <div
                className={`flex items-center gap-1.5 ${
                  row.pending_response > 0
                    ? "text-amber-500"
                    : "text-muted-foreground"
                }`}
              >
                <AlertCircle className="h-3.5 w-3.5" />
                <span>
                  <span className="font-semibold tabular-nums">
                    {row.pending_response}
                  </span>{" "}
                  aguardando
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>
                  Espera{" "}
                  <span className="font-semibold text-foreground tabular-nums">
                    {row.avg_wait_minutes != null
                      ? `${Math.round(row.avg_wait_minutes)}min`
                      : "—"}
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de conversas */}
        {isLoading && (
          <p className="text-xs text-muted-foreground py-4 text-center">
            Carregando conversas…
          </p>
        )}

        {!isLoading && list.length === 0 && (
          <EmptyState
            size="sm"
            icon={Inbox}
            title="Fila zerada"
            description="Todas as conversas deste atendente foram atendidas ou aguardam ação do cliente."
          />
        )}

        {!isLoading && list.length > 0 && (
          <ScrollArea className="max-h-[60vh] quantum-scrollbar pr-2">
            <div className="space-y-1">
              {showing.map((conv: any) => (
                <Link
                  key={conv.id}
                  to={`/crm?conversation=${conv.id}&contact=${conv.contactId}`}
                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md hover:bg-primary/5 transition-colors group border border-transparent hover:border-primary/20"
                >
                  <div className="flex items-center gap-2.5 flex-1 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                        {memberInitials(conv.contactName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate text-foreground">
                          {conv.contactName}
                        </p>
                        {conv.last_sender_type === "customer" && (
                          <Badge
                            variant="outline"
                            className="text-[9px] py-0 h-4 border-amber-500/40 text-amber-500 shrink-0"
                          >
                            aguardando
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conv.last_message_preview || "Sem prévia"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {conv.last_message_at
                        ? formatDistanceToNow(new Date(conv.last_message_at), {
                            locale: ptBR,
                            addSuffix: false,
                          })
                        : "—"}
                    </span>
                    <ArrowRightCircle className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </Link>
              ))}
            </div>

            {list.length > visible && (
              <div className="pt-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setVisible((v) => v + PAGE_SIZE)}
                >
                  Carregar mais ({list.length - visible} restantes)
                </Button>
              </div>
            )}
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
