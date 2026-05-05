import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useAuth } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users,
  MessageSquare,
  AlertCircle,
  Clock,
  Search,
  LayoutGrid,
  Inbox,
  Filter,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useIsMobile } from "@/hooks/use-mobile";
import { AttendantQueueCard, type QueueRow } from "./AttendantQueueCard";
import { AttendantQueuePanel } from "./AttendantQueuePanel";

const STORAGE_KEY = "queue:active-tab";

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < 5 * 60 * 1000;
}

function memberInitial(name: string | null | undefined): string {
  const v = (name || "").trim();
  if (!v) return "?";
  return v[0]!.toUpperCase();
}

export function QueueTabsView() {
  const { data: organization } = useUserOrganization();
  const { user } = useAuth();
  const { isOwner, can } = useUserPermissions();
  const canSeeAll = isOwner || can("team", "view_queue");
  const isMobile = useIsMobile();

  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEY) || "overview";
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, activeTab);
  }, [activeTab]);

  const { data: realRows, isLoading } = useQuery({
    queryKey: ["attendance-queue", organization?.id, canSeeAll, user?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      let query = supabase
        .from("attendance_queue_view" as any)
        .select("*")
        .eq("organization_id", organization.id);
      if (!canSeeAll && user?.id) {
        query = query.eq("user_id", user.id);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as QueueRow[];
    },
    enabled: !!organization?.id,
    refetchInterval: 30 * 1000,
  });

  // 🧪 MOCK TEMPORÁRIO — remover quando houver dados reais
  const MOCK_ENABLED = true;
  const mockRows: QueueRow[] = [
    {
      member_id: "mock-1",
      member_name: "Ana Carolina Silva",
      user_email: "ana.silva@empresa.com",
      department: "Vendas",
      role_title: "Consultora Sênior",
      active_conversations: 12,
      pending_response: 3,
      avg_wait_minutes: 4,
      last_activity_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
      last_seen_at: new Date(Date.now() - 1 * 60 * 1000).toISOString(),
    },
    {
      member_id: "mock-2",
      member_name: "Bruno Henrique Costa",
      user_email: "bruno.costa@empresa.com",
      department: "Suporte",
      role_title: "Atendente N2",
      active_conversations: 8,
      pending_response: 1,
      avg_wait_minutes: 2,
      last_activity_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
      last_seen_at: new Date(Date.now() - 30 * 1000).toISOString(),
    },
    {
      member_id: "mock-3",
      member_name: "Carla Mendes",
      user_email: "carla.mendes@empresa.com",
      department: "Vendas",
      role_title: "SDR",
      active_conversations: 15,
      pending_response: 7,
      avg_wait_minutes: 12,
      last_activity_at: new Date(Date.now() - 8 * 60 * 1000).toISOString(),
      last_seen_at: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
    },
    {
      member_id: "mock-4",
      member_name: "Diego Almeida",
      user_email: "diego.almeida@empresa.com",
      department: "Suporte",
      role_title: "Atendente N1",
      active_conversations: 5,
      pending_response: 0,
      avg_wait_minutes: 1,
      last_activity_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      last_seen_at: new Date(Date.now() - 20 * 60 * 1000).toISOString(),
    },
    {
      member_id: "mock-5",
      member_name: "Eduarda Ferreira",
      user_email: "eduarda.ferreira@empresa.com",
      department: "Pós-venda",
      role_title: "Customer Success",
      active_conversations: 9,
      pending_response: 2,
      avg_wait_minutes: 6,
      last_activity_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(),
      last_seen_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    },
    {
      member_id: "mock-6",
      member_name: "Felipe Rodrigues",
      user_email: "felipe.rodrigues@empresa.com",
      department: "Vendas",
      role_title: "Closer",
      active_conversations: 3,
      pending_response: 0,
      avg_wait_minutes: null,
      last_activity_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      last_seen_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    },
  ];

  const rows = MOCK_ENABLED ? mockRows : realRows;

  const departments = useMemo(() => {
    const set = new Set<string>();
    rows?.forEach((r) => r.department && set.add(r.department));
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    if (!rows) return [];
    return rows.filter((r) => {
      if (department !== "all" && r.department !== department) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        if (
          !(r.member_name || "").toLowerCase().includes(q) &&
          !(r.department || "").toLowerCase().includes(q) &&
          !(r.role_title || "").toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [rows, search, department]);

  const totals = useMemo(() => {
    const list = rows ?? [];
    const totalActive = list.reduce(
      (s, r) => s + (r.active_conversations || 0),
      0,
    );
    const totalPending = list.reduce(
      (s, r) => s + (r.pending_response || 0),
      0,
    );
    const onlineCount = list.filter((r) => isOnline(r.last_seen_at)).length;
    const waits = list
      .map((r) => r.avg_wait_minutes)
      .filter((v): v is number => v != null && v > 0);
    const avgWait = waits.length
      ? waits.reduce((s, v) => s + v, 0) / waits.length
      : 0;
    return { totalActive, totalPending, onlineCount, avgWait };
  }, [rows]);

  // Garante que aba ativa existe
  useEffect(() => {
    if (activeTab === "overview") return;
    if (!filtered.find((r) => r.member_id === activeTab)) {
      setActiveTab("overview");
    }
  }, [filtered, activeTab]);

  const activeMember = useMemo(
    () => filtered.find((r) => r.member_id === activeTab) ?? null,
    [filtered, activeTab],
  );

  return (
    <div className="space-y-6">
      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<Users className="h-4 w-4" />}
          label="Atendentes online"
          value={`${totals.onlineCount}/${rows?.length ?? 0}`}
          accent="emerald"
        />
        <StatCard
          icon={<MessageSquare className="h-4 w-4" />}
          label="Conversas ativas"
          value={totals.totalActive}
          accent="primary"
        />
        <StatCard
          icon={<AlertCircle className="h-4 w-4" />}
          label="Aguardando resposta"
          value={totals.totalPending}
          accent="amber"
        />
        <StatCard
          icon={<Clock className="h-4 w-4" />}
          label="Espera média (min)"
          value={
            totals.avgWait > 0 ? Math.round(totals.avgWait).toString() : "—"
          }
          accent="primary"
        />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar atendente, departamento ou cargo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={department} onValueChange={setDepartment}>
          <SelectTrigger className="w-full sm:w-56">
            <SelectValue placeholder="Departamento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os departamentos</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading && (
        <div className="space-y-3">
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      )}

      {!isLoading && filtered.length === 0 && (
        rows && rows.length === 0 ? (
          <EmptyState
            variant="card"
            icon={Inbox}
            title="Fila zerada"
            description="Nenhum atendente cadastrado ainda. Cadastre membros para começar a distribuir conversas."
          />
        ) : (
          <EmptyState
            variant="card"
            icon={Filter}
            title="Nenhum atendente com esses filtros"
            description="Tente remover um filtro ou trocar o departamento selecionado."
          />
        )
      )}

      {/* Mobile: select de atendentes + painel */}
      {!isLoading && filtered.length > 0 && isMobile && (
        <div className="space-y-3">
          <Select value={activeTab} onValueChange={setActiveTab}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="overview">
                <span className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Visão geral
                </span>
              </SelectItem>
              {filtered.map((r) => (
                <SelectItem key={r.member_id} value={r.member_id}>
                  {r.member_name || r.user_email || "Atendente sem nome"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeTab === "overview" ? (
            <OverviewGrid rows={filtered} />
          ) : activeMember ? (
            <AttendantQueuePanel row={activeMember} />
          ) : null}
        </div>
      )}

      {/* Desktop: abas verticais à esquerda + painel à direita */}
      {!isLoading && filtered.length > 0 && !isMobile && (
        <div className="grid grid-cols-[260px_1fr] gap-4 min-h-[400px]">
          <Card className="quantum-glass border-border/60">
            <CardContent className="p-2">
              <ScrollArea className="h-[60vh] quantum-scrollbar">
                <button
                  onClick={() => setActiveTab("overview")}
                  className={`w-full flex items-center gap-2 rounded-md px-3 py-2.5 text-left text-sm transition-colors mb-1 ${
                    activeTab === "overview"
                      ? "bg-primary/15 text-primary border-l-2 border-primary"
                      : "hover:bg-muted/40 text-foreground"
                  }`}
                >
                  <LayoutGrid className="h-4 w-4" />
                  <span className="font-medium">Visão geral</span>
                </button>

                <div className="my-2 border-t border-border/40" />

                {filtered.map((r) => {
                  const online = isOnline(r.last_seen_at);
                  const display =
                    r.member_name || r.user_email || "Sem nome";
                  const isActive = activeTab === r.member_id;
                  return (
                    <button
                      key={r.member_id}
                      onClick={() => setActiveTab(r.member_id)}
                      className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors mb-0.5 ${
                        isActive
                          ? "bg-primary/15 border-l-2 border-primary"
                          : "hover:bg-muted/40 border-l-2 border-transparent"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-gradient-to-br from-primary/30 to-accent/30 text-primary text-xs font-semibold">
                            {memberInitial(r.member_name || r.user_email)}
                          </AvatarFallback>
                        </Avatar>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background ${
                            online
                              ? "bg-emerald-500"
                              : "bg-muted-foreground/40"
                          }`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate text-foreground">
                          {display}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {r.department || "Sem dept."}
                        </p>
                      </div>
                      {r.pending_response > 0 && (
                        <Badge
                          variant="outline"
                          className="border-amber-500/40 bg-amber-500/10 text-amber-500 text-xs h-5 px-1.5 tabular-nums"
                        >
                          {r.pending_response}
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </ScrollArea>
            </CardContent>
          </Card>

          <div className="min-w-0">
            {activeTab === "overview" ? (
              <OverviewGrid rows={filtered} />
            ) : activeMember ? (
              <AttendantQueuePanel row={activeMember} />
            ) : (
              <Card className="quantum-glass">
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Atendente não encontrado.
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OverviewGrid({ rows }: { rows: QueueRow[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {rows.map((r) => (
        <AttendantQueueCard key={r.member_id} row={r} />
      ))}
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: "primary" | "amber" | "emerald";
}) {
  const accentClasses: Record<string, string> = {
    primary: "from-primary/15 to-primary/5 text-primary border-primary/20",
    amber:
      "from-amber-500/15 to-amber-500/5 text-amber-500 border-amber-500/20",
    emerald:
      "from-emerald-500/15 to-emerald-500/5 text-emerald-500 border-emerald-500/20",
  };
  return (
    <Card
      className={`bg-gradient-to-br ${accentClasses[accent]} border quantum-glass`}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="text-xs uppercase tracking-wide opacity-80">
            {label}
          </span>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  );
}
