import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDraggable } from "@dnd-kit/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { MessageSquare, ArrowRightLeft } from "lucide-react";
import { KanbanMigrateDialog } from "./KanbanMigrateDialog";
import { ChannelIcon } from "@/components/icons/ChannelIcon";
import { SmartLabelList } from "./SmartLabelBadge";
import { useSmartLabels } from "@/hooks/useSmartLabels";

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  avatar_url: string | null;
  pipeline_stage_id: string | null;
  last_interaction_at: string | null;
  tags: string[] | null;
  smart_label_keys?: string[] | null;
  channel?: string | null;
  ig_handle?: string | null;
  assigned_to_member_id?: string | null;
  conversations?: {
    last_message_preview: string | null;
  }[];
  team_members?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface KanbanCardProps {
  contact: Contact;
  isDragging?: boolean;
}

export function KanbanCard({ contact, isDragging }: KanbanCardProps) {
  const navigate = useNavigate();
  const [showMigrate, setShowMigrate] = useState(false);
  const { labels: smartLabels } = useSmartLabels();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: contact.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const lastMessage = contact.conversations?.[0]?.last_message_preview;
  const timeInStage = contact.last_interaction_at
    ? formatDistanceToNow(new Date(contact.last_interaction_at), {
        addSuffix: true,
        locale: ptBR,
      })
    : null;

  // Mock priority based on tags
  const priority = contact.tags?.includes("urgente")
    ? "high"
    : contact.tags?.includes("importante")
    ? "medium"
    : "low";

  const priorityColors = {
    high: "bg-red-500/20 text-red-400 border-red-500/30",
    medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    low: "bg-muted text-muted-foreground border-border",
  };

  const priorityLabels = {
    high: "Alta",
    medium: "Média",
    low: "Baixa",
  };

  const handleOpenChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/crm?contact=${contact.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "bg-card rounded-lg p-3 border border-border cursor-grab active:cursor-grabbing",
        "hover:border-muted-foreground/30 transition-all group",
        isDragging && "opacity-50 shadow-2xl shadow-primary/20"
      )}
    >
      {/* Header with Avatar and Name */}
      <div className="flex items-center gap-2 mb-2">
        <Avatar className="h-8 w-8">
          <AvatarImage src={contact.avatar_url || undefined} />
          <AvatarFallback className="bg-primary/20 text-primary text-xs">
            {(contact.name || contact.phone).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <ChannelIcon channel={contact.channel} size={16} />
            <p className="text-sm font-medium text-foreground truncate">
              {contact.name || contact.phone || "(sem nome)"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {contact.channel === "instagram"
              ? (contact.ig_handle ? `@${contact.ig_handle}` : "Instagram DM")
              : (contact.phone || "")}
          </p>
        </div>
        {/* Action buttons - visible on hover */}
        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => { e.stopPropagation(); setShowMigrate(true); }}
            className="h-7 w-7 text-accent hover:text-accent hover:bg-accent/10"
            title="Migrar funil"
          >
            <ArrowRightLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleOpenChat}
            className="h-7 w-7 text-primary hover:text-primary hover:bg-primary/10"
            title="Abrir chat"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Smart Labels */}
      {contact.smart_label_keys && contact.smart_label_keys.length > 0 && (
        <SmartLabelList
          labelKeys={contact.smart_label_keys}
          allLabels={smartLabels}
          size="xs"
          max={3}
          className="mb-2"
        />
      )}

      {/* Last Message Preview */}
      {lastMessage && (
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
          {lastMessage}
        </p>
      )}

      {/* Footer with Time, Priority, and Assigned */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {timeInStage && (
            <span className="text-xs text-muted-foreground">{timeInStage}</span>
          )}
          {contact.team_members && (
            <span className="text-xs text-accent truncate">
              {contact.team_members.first_name} {contact.team_members.last_name?.[0] || ""}.
            </span>
          )}
        </div>
        <Badge
          variant="outline"
          className={cn("text-xs px-1.5 py-0 shrink-0", priorityColors[priority])}
        >
          {priorityLabels[priority]}
        </Badge>
      </div>

      <KanbanMigrateDialog
        open={showMigrate}
        onOpenChange={setShowMigrate}
        preSelectedContactId={contact.id}
        currentPipelineId={null}
      />
    </div>
  );
}
