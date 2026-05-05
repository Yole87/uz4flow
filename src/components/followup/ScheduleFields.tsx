import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock } from "lucide-react";

interface ScheduleFieldsProps {
  date: string;
  onDateChange: (v: string) => void;
  time: string;
  onTimeChange: (v: string) => void;
}

export function ScheduleFields({ date, onDateChange, time, onTimeChange }: ScheduleFieldsProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-accent" />
        <h4 className="text-sm font-semibold text-foreground">Agendamento</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Defina quando a campanha será executada. Se não informar, ela ficará como rascunho.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs text-muted-foreground">Data</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1"
          />
        </div>
        <div>
          <Label className="text-xs text-muted-foreground">Hora</Label>
          <Input
            type="time"
            value={time}
            onChange={(e) => onTimeChange(e.target.value)}
            className="mt-1"
          />
        </div>
      </div>
    </div>
  );
}
