import { WhatsAppIcon } from "./WhatsAppIcon";
import { InstagramIcon } from "./InstagramIcon";
import { cn } from "@/lib/utils";

interface ChannelIconProps {
  channel?: string | null;
  className?: string;
  size?: number;
}

/**
 * Ícone outline oficial do canal de comunicação.
 * - Instagram: outline com gradiente oficial (rosa→magenta→roxo)
 * - WhatsApp: outline verde esmeralda
 */
export function ChannelIcon({ channel, className, size = 18 }: ChannelIconProps) {
  if (channel === "instagram") {
    return <InstagramIcon size={size} className={cn("shrink-0", className)} />;
  }
  // default: whatsapp
  return <WhatsAppIcon size={size} strokeWidth={2.2} className={cn("text-emerald-500 shrink-0", className)} />;
}

export function getChannelLabel(channel?: string | null): string {
  return channel === "instagram" ? "Instagram" : "WhatsApp";
}
