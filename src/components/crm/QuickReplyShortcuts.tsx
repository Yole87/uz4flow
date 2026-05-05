import { useRef, useState, useEffect, useCallback } from "react";
import { useQuickReplies, type QuickReply } from "@/hooks/useQuickReplies";
import { Button } from "@/components/ui/button";
import {
  MessageSquareText,
  Mic,
  Image as ImageIcon,
  Video,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

interface QuickReplyShortcutsProps {
  onSelect: (qr: QuickReply) => void;
  disabled?: boolean;
  instanceId?: string | null;
}

const ICONS = {
  text: MessageSquareText,
  audio: Mic,
  image: ImageIcon,
  video: Video,
  document: FileText,
} as const;

/**
 * Shows ALL quick replies in a horizontally scrollable bar with chevron nav.
 */
export function QuickReplyShortcuts({ onSelect, disabled, instanceId }: QuickReplyShortcutsProps) {
  const { quickReplies, isLoading } = useQuickReplies(instanceId || null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(false);

  const updateChevrons = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 4);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateChevrons();
    const el = scrollRef.current;
    if (!el) return;
    const handle = () => updateChevrons();
    el.addEventListener("scroll", handle, { passive: true });
    window.addEventListener("resize", handle);
    return () => {
      el.removeEventListener("scroll", handle);
      window.removeEventListener("resize", handle);
    };
  }, [updateChevrons, quickReplies.length]);

  if (isLoading || quickReplies.length === 0) return null;

  // All quick replies, most recent first
  const sorted = [...quickReplies].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const scrollBy = (delta: number) => {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  return (
    <div className="relative border-t border-border bg-muted/30">
      {showLeft && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mais respostas à esquerda"
          title="Mais respostas"
          onClick={() => scrollBy(-200)}
          className="absolute left-0 top-1/2 -translate-y-1/2 z-10 h-7 w-6 rounded-none bg-background/90 hover:bg-background border-r border-border text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      )}
      {showRight && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Mais respostas à direita"
          title="Mais respostas"
          onClick={() => scrollBy(200)}
          className="absolute right-0 top-1/2 -translate-y-1/2 z-10 h-7 w-6 rounded-none bg-background/90 hover:bg-background border-l border-border text-muted-foreground hover:text-foreground"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
      <div
        ref={scrollRef}
        className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 overflow-x-auto quantum-scrollbar scroll-smooth"
        style={{
          maskImage:
            showLeft && showRight
              ? "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
              : showLeft
              ? "linear-gradient(to right, transparent 0, black 24px, black 100%)"
              : showRight
              ? "linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)"
              : undefined,
          WebkitMaskImage:
            showLeft && showRight
              ? "linear-gradient(to right, transparent 0, black 24px, black calc(100% - 24px), transparent 100%)"
              : showLeft
              ? "linear-gradient(to right, transparent 0, black 24px, black 100%)"
              : showRight
              ? "linear-gradient(to right, black 0, black calc(100% - 24px), transparent 100%)"
              : undefined,
        }}
      >
        {sorted.map((qr) => {
          const Icon = ICONS[qr.media_type];
          return (
            <Button
              key={qr.id}
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => onSelect(qr)}
              className="h-7 shrink-0 text-xs gap-1.5 bg-background hover:bg-accent/10 hover:text-accent hover:border-accent/40"
              title={qr.media_type === "text" ? qr.content || "" : qr.file_name || ""}
            >
              <Icon className="h-3 w-3" />
              <span className="max-w-[110px] truncate">{qr.title}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
