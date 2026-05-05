import { Instagram, MessageSquare, Globe } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type ChannelFilter = "all" | "whatsapp" | "instagram";

interface ChannelFilterProps {
  value: ChannelFilter;
  onChange: (next: ChannelFilter) => void;
}

export function ChannelFilterSelect({ value, onChange }: ChannelFilterProps) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ChannelFilter)}>
      <SelectTrigger className="h-8 w-[140px] text-xs">
        <SelectValue>
          <div className="flex items-center gap-1.5 min-w-0">
            {value === "whatsapp" && <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />}
            {value === "instagram" && <Instagram className="h-3.5 w-3.5 text-muted-foreground" />}
            {value === "all" && <Globe className="h-3.5 w-3.5 text-muted-foreground" />}
            <span className="truncate">
              {value === "all" ? "Todos canais" : value === "whatsapp" ? "WhatsApp" : "Instagram"}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> Todos canais
          </div>
        </SelectItem>
        <SelectItem value="whatsapp">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" /> WhatsApp
          </div>
        </SelectItem>
        <SelectItem value="instagram">
          <div className="flex items-center gap-1.5">
            <Instagram className="h-3.5 w-3.5" /> Instagram
          </div>
        </SelectItem>
      </SelectContent>
    </Select>
  );
}
