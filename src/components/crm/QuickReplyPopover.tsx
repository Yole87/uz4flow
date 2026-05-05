import { useEffect, useRef } from "react";
import { useQuickReplies, type QuickReply } from "@/hooks/useQuickReplies";
import {
  Command,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import {
  Zap,
  MessageSquareText,
  Mic,
  Image as ImageIcon,
  Video,
  FileText,
} from "lucide-react";

interface QuickReplyPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelect: (qr: QuickReply) => void;
  filter: string;
  instanceId?: string | null;
}

const ICONS = {
  text: MessageSquareText,
  audio: Mic,
  image: ImageIcon,
  video: Video,
  document: FileText,
} as const;

export function QuickReplyPopover({ open, onClose, onSelect, filter, instanceId }: QuickReplyPopoverProps) {
  const { quickReplies, isLoading } = useQuickReplies(instanceId || null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const filtered = filter
    ? quickReplies.filter(
        (qr) =>
          qr.title.toLowerCase().includes(filter.toLowerCase()) ||
          (qr.content || "").toLowerCase().includes(filter.toLowerCase()),
      )
    : quickReplies;

  // Group by media_type
  const grouped = filtered.reduce<Record<string, QuickReply[]>>((acc, qr) => {
    (acc[qr.media_type] ||= []).push(qr);
    return acc;
  }, {});

  const order = ["text", "image", "audio", "video", "document"] as const;

  return (
    <div ref={ref} className="absolute bottom-full left-0 right-0 mb-1 z-50 mx-2 sm:mx-3">
      <Command className="rounded-lg border border-border shadow-lg bg-popover max-h-[320px]">
        <CommandList>
          {isLoading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <CommandEmpty>
              <div className="flex flex-col items-center gap-1 py-2">
                <MessageSquareText className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {quickReplies.length === 0
                    ? "Nenhuma resposta rápida cadastrada"
                    : "Nenhum resultado para a busca"}
                </span>
              </div>
            </CommandEmpty>
          ) : (
            order.map((type) => {
              const items = grouped[type];
              if (!items?.length) return null;
              const Icon = ICONS[type];
              return (
                <CommandGroup key={type} heading={type.toUpperCase()}>
                  {items.map((qr) => (
                    <CommandItem
                      key={qr.id}
                      value={qr.title + " " + (qr.content || "") + " " + type}
                      onSelect={() => onSelect(qr)}
                      className="flex items-start gap-2 cursor-pointer data-[selected=true]:bg-muted data-[selected=true]:text-foreground data-[selected=true]:border-l-2 data-[selected=true]:border-accent"
                    >
                      <Icon className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground truncate">{qr.title}</p>
                        <p className="text-xs text-muted-foreground truncate">
                          {qr.media_type === "text" ? qr.content : `📎 ${qr.file_name}`}
                        </p>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })
          )}
        </CommandList>
      </Command>
    </div>
  );
}
