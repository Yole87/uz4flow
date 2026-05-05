import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CheckCheck, Bot, User, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { MetaWindowTimer } from "./MetaWindowTimer";
import { ChannelIcon, getChannelLabel } from "@/components/icons/ChannelIcon";
import { SmartLabelList } from "./SmartLabelBadge";
import { useSmartLabels } from "@/hooks/useSmartLabels";

const MEMBER_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA"
];

function getMemberColor(name: string): string {
  let hash = 0;
  for (const char of name) hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0;
  return MEMBER_COLORS[Math.abs(hash) % MEMBER_COLORS.length];
}

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  avatar_url: string | null;
  smart_label_keys?: string[] | null;
  stage?: {
    id: string;
    name: string;
    color: string | null;
  } | null;
  assigned_member?: {
    id: string;
    first_name: string;
  } | null;
}

interface Conversation {
  id: string;
  last_message_at: string | null;
  last_message_preview: string | null;
  unread_count: number;
  last_sender_type?: "customer" | "ia" | "attendant" | null;
  contact: Contact | null;
}

interface ContactListItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  selectionMode?: boolean;
  isChecked?: boolean;
  hasActiveCall?: boolean;
  instanceName?: string;
  instanceProvider?: string;
  channel?: string | null;
}

export function ContactListItem({ 
  conversation, 
  isSelected, 
  onClick,
  selectionMode = false,
  isChecked = false,
  hasActiveCall = false,
  instanceName,
  instanceProvider,
  channel,
}: ContactListItemProps) {
  const isInstagram = channel === "instagram";
  const contact = conversation.contact;
  const { labels: smartLabels } = useSmartLabels();
  if (!contact) return null;

  const displayName = contact.name || contact.phone;
  const initials = displayName.slice(0, 2).toUpperCase();
  const lastSenderType = conversation.last_sender_type;
  const stage = contact.stage;
  const assignedMember = contact.assigned_member;
  const labelKeys = contact.smart_label_keys || [];

  const LastSenderIcon = () => {
    if (lastSenderType === "ia") {
      return <Bot className="h-3.5 w-3.5 text-secondary shrink-0" />;
    }
    if (lastSenderType === "attendant") {
      return <User className="h-3.5 w-3.5 text-primary shrink-0" />;
    }
    return <CheckCheck className="h-4 w-4 text-accent shrink-0" />;
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 sm:px-4 py-3 sm:py-3",
        "min-h-[72px] sm:min-h-[68px]",
        "hover:bg-muted/60 active:bg-muted transition-colors text-left",
        isSelected && "bg-muted",
        selectionMode && isChecked && "bg-accent/10"
      )}
      data-testid="contact-list-item"
    >
      {/* Selection Checkbox */}
      {selectionMode && (
        <Checkbox
          checked={isChecked}
          className="border-border data-[state=checked]:bg-accent data-[state=checked]:border-accent"
        />
      )}

      {/* Avatar */}
      <div className="relative">
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarImage src={contact.avatar_url || undefined} alt={displayName} />
          <AvatarFallback className="bg-accent text-accent-foreground text-sm">
            {initials}
          </AvatarFallback>
        </Avatar>
        
        {lastSenderType && lastSenderType !== "customer" && (
          <div className={cn(
            "absolute -bottom-0.5 -right-0.5 p-0.5 rounded-full",
            lastSenderType === "ia" ? "bg-secondary" : "bg-primary"
          )}>
            {lastSenderType === "ia" ? (
              <Bot className="h-2.5 w-2.5 text-secondary-foreground" />
            ) : (
              <User className="h-2.5 w-2.5 text-primary-foreground" />
            )}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Instance name + Channel icon + Assigned member tag in one row */}
        {(instanceName || assignedMember?.first_name || instanceProvider === "meta_official" || isInstagram) && (
          <div className="flex items-center gap-1.5 mb-0.5 min-w-0">
            <ChannelIcon
              channel={isInstagram ? "instagram" : "whatsapp"}
              size={12}
              aria-label={getChannelLabel(isInstagram ? "instagram" : "whatsapp")}
            />
            {instanceName && (
              <span
                className={cn(
                  "text-xs font-medium leading-none truncate",
                  isInstagram ? "text-pink-400" : "text-emerald-400"
                )}
              >
                {instanceName}
              </span>
            )}
            {instanceProvider === "meta_official" && (
              <MetaWindowTimer conversationId={conversation.id} />
            )}
            {assignedMember?.first_name && (
              <span
                className="text-xs font-semibold leading-none px-1.5 py-0.5 rounded-sm truncate max-w-[120px] shrink-0"
                style={{
                  backgroundColor: `${getMemberColor(assignedMember.first_name)}25`,
                  color: getMemberColor(assignedMember.first_name),
                }}
              >
                {assignedMember.first_name}
              </span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="font-medium text-sm sm:text-base text-foreground truncate">
              {displayName}
            </span>
            {hasActiveCall && (
              <Badge className="bg-accent/20 text-accent border-accent/30 text-[9px] h-4 px-1.5 shrink-0">
                <Phone className="h-2 w-2 mr-0.5" />
                Ligação
              </Badge>
            )}
            {stage && (
              <div
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: stage.color || "hsl(var(--muted-foreground))" }}
                title={stage.name}
              />
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            {conversation.last_message_at && (
              <span className="text-xs sm:text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(conversation.last_message_at), {
                  addSuffix: false,
                  locale: ptBR,
                })}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <LastSenderIcon />
          <p className="text-xs sm:text-sm text-muted-foreground truncate">
            {conversation.last_message_preview || "Sem mensagens"}
          </p>
        </div>
        {labelKeys.length > 0 && (
          <SmartLabelList
            labelKeys={labelKeys}
            allLabels={smartLabels}
            size="xs"
            max={3}
            className="mt-1"
          />
        )}
      </div>

      {/* Unread Badge */}
      {conversation.unread_count > 0 && (
        <Badge className="bg-accent text-accent-foreground hover:bg-accent shrink-0 h-5 min-w-[20px] text-xs">
          {conversation.unread_count}
        </Badge>
      )}
    </button>
  );
}
