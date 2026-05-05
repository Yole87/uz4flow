import { useRef, memo } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ContactListItem } from "./ContactListItem";
import { Search } from "lucide-react";

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  avatar_url: string | null;
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
  contact_id: string;
  contact: Contact | null;
  instance_id?: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  last_sender_type?: "customer" | "ia" | "attendant" | null;
  unread_count: number;
  status: string;
}

interface VirtualContactListProps {
  conversations: Conversation[];
  selectedContactId: string | null;
  onSelectContact: (contactId: string, conversationId?: string) => void;
  selectionMode?: boolean;
  selectedConversationIds?: string[];
  onToggleSelection?: (conversationId: string) => void;
  instancesMap?: Record<string, string>;
  instancesProviderMap?: Record<string, string>;
  instancesChannelMap?: Record<string, string>;
}

export const VirtualContactList = memo(function VirtualContactList({
  conversations,
  selectedContactId,
  onSelectContact,
  selectionMode = false,
  selectedConversationIds = [],
  onToggleSelection,
  instancesMap = {},
  instancesProviderMap = {},
  instancesChannelMap = {},
}: VirtualContactListProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 85,
    overscan: 5,
  });

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
        <Search className="h-10 w-10 mb-2 opacity-50" />
        <p className="text-sm">Nenhuma conversa encontrada</p>
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full overflow-auto"
      style={{ contain: "strict" }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const conv = conversations[virtualItem.index];
          const isConvSelected = selectedConversationIds.includes(conv.id);
          const instanceName = conv.instance_id ? instancesMap[conv.instance_id] : undefined;
          const instanceProvider = conv.instance_id ? instancesProviderMap[conv.instance_id] : undefined;
          const instanceChannel = conv.instance_id ? instancesChannelMap[conv.instance_id] : undefined;
          // Fallback: detectar canal pela conversation se mapa estiver vazio
          const channel = instanceChannel || (conv as any).channel || "whatsapp";
          return (
            <div
              key={conv.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              <ContactListItem
                conversation={conv}
                isSelected={selectedContactId === conv.contact?.id}
                onClick={() => {
                  if (selectionMode && onToggleSelection) {
                    onToggleSelection(conv.id);
                  } else if (conv.contact) {
                    // Pass both contactId and conversationId for proper isolation
                    onSelectContact(conv.contact.id, conv.id);
                  }
                }}
                selectionMode={selectionMode}
                isChecked={isConvSelected}
                instanceName={instanceName}
                instanceProvider={instanceProvider}
                channel={channel}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
});
