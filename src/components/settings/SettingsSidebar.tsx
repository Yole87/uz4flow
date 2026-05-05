import { useMemo } from "react";
import { LucideIcon, Bot, Phone, Brain, Zap, CreditCard, HardDrive } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type SettingsSectionKey =
  | "whatsapp"
  | "voice"
  | "ai"
  | "quick-replies"
  | "subscription"
  | "storage";

interface SectionDef {
  key: SettingsSectionKey;
  label: string;
  icon: LucideIcon;
}

interface GroupDef {
  label: string;
  items: SectionDef[];
}

const GROUPS: GroupDef[] = [
  {
    label: "Conexões",
    items: [
      { key: "whatsapp", label: "WhatsApp", icon: Bot },
      { key: "voice", label: "Voice AI", icon: Phone },
    ],
  },
  {
    label: "Inteligência",
    items: [
      { key: "ai", label: "Provedor de IA", icon: Brain },
      { key: "quick-replies", label: "Respostas Rápidas", icon: Zap },
    ],
  },
  {
    label: "Conta",
    items: [
      { key: "subscription", label: "Assinatura", icon: CreditCard },
      { key: "storage", label: "Armazenamento", icon: HardDrive },
    ],
  },
];

interface Props {
  active: SettingsSectionKey;
  onChange: (key: SettingsSectionKey) => void;
}

export function SettingsSidebar({ active, onChange }: Props) {
  const flat = useMemo(() => GROUPS.flatMap((g) => g.items), []);

  return (
    <>
      {/* Mobile / tablet: Select dropdown */}
      <div className="lg:hidden">
        <Select value={active} onValueChange={(v) => onChange(v as SettingsSectionKey)}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GROUPS.map((group) => (
              <div key={group.label}>
                <div className="px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <SelectItem key={item.key} value={item.key}>
                    <div className="flex items-center gap-2">
                      <item.icon className="h-4 w-4" />
                      <span>{item.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Desktop: vertical sidebar */}
      <nav className="hidden lg:block sticky top-4 self-start">
        <div className="space-y-5">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <h3 className="px-3 mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {group.label}
              </h3>
              <ul className="space-y-0.5">
                {group.items.map((item) => {
                  const isActive = item.key === active;
                  return (
                    <li key={item.key}>
                      <button
                        onClick={() => onChange(item.key)}
                        className={cn(
                          "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                          isActive
                            ? "bg-primary/10 text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                        )}
                      >
                        <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-primary")} />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

export const SETTINGS_SECTIONS_FLAT = GROUPS.flatMap((g) => g.items);
