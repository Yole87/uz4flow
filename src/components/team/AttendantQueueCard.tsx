import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  MessageSquare,
  AlertCircle,
  User,
} from "lucide-react";

export interface QueueRow {
  member_id: string;
  member_name: string;
  user_email?: string | null;
  department: string | null;
  role_title: string | null;
  active_conversations: number;
  pending_response: number;
  avg_wait_minutes: number | null;
  last_activity_at: string | null;
  last_seen_at: string | null;
}

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function smartInitials(name: string | null | undefined, email?: string | null): string {
  const n = (name || "").trim();
  if (n) {
    return n
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();
  }
  const e = (email || "").trim();
  if (e) return e[0]!.toUpperCase();
  return "";
}

interface Props {
  row: QueueRow;
}

/**
 * Mini-card usado APENAS na aba "Visão geral".
 * Painel individual com lista de conversas vive em AttendantQueuePanel.
 */
export function AttendantQueueCard({ row }: Props) {
  const online = isOnline(row.last_seen_at);
  const display = row.member_name || row.user_email || "Atendente sem nome";
  const subtitle =
    [row.department, row.role_title].filter(Boolean).join(" · ") ||
    "Sem departamento";
  const initials = smartInitials(row.member_name, row.user_email);

  return (
    <Card className="quantum-glass border border-primary/10 hover:border-primary/30 transition-colors">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <Avatar className="h-11 w-11">
              <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-primary font-semibold">
                {initials || <User className="h-5 w-5" />}
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
              <span className="font-semibold truncate text-foreground">
                {display}
              </span>
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
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-border/30 text-center">
          <Metric
            icon={<MessageSquare className="h-3.5 w-3.5" />}
            label="Ativas"
            value={row.active_conversations}
          />
          <Metric
            icon={<AlertCircle className="h-3.5 w-3.5 text-amber-500" />}
            label="Aguard."
            value={row.pending_response}
            highlight={row.pending_response > 0}
          />
          <Metric
            icon={<Clock className="h-3.5 w-3.5" />}
            label="Espera"
            value={
              row.avg_wait_minutes != null
                ? `${Math.round(row.avg_wait_minutes)}min`
                : "—"
            }
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Metric({
  icon,
  label,
  value,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-xs uppercase tracking-wide">{label}</span>
      </div>
      <span
        className={`font-semibold tabular-nums text-sm ${
          highlight ? "text-amber-500" : "text-foreground"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
