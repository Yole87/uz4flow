import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StopCircle, Clock, Users, Loader2 } from "lucide-react";

interface InlineProgressHeaderProps {
  currentPhase: string;
  progressPercent: number;
  leadsFound: number;
  elapsedTime: number;
  onStop: () => void;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export function InlineProgressHeader({
  currentPhase,
  progressPercent,
  leadsFound,
  elapsedTime,
  onStop,
}: InlineProgressHeaderProps) {
  return (
    <div className="quantum-glass border-b border-accent/20 p-4 space-y-3">
      {/* Top row: Phase and Stop button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-accent animate-spin" />
          <span className="text-sm font-medium text-accent">
            {currentPhase || "Processando..."}
          </span>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={onStop}
          className="h-8"
        >
          <StopCircle className="h-4 w-4 mr-1.5" />
          Parar Busca
        </Button>
      </div>

      {/* Progress bar row */}
      <div className="flex items-center gap-4">
        <Progress 
          value={progressPercent} 
          className="flex-1 h-2 bg-muted"
        />
        <span className="text-sm font-medium text-accent tabular-nums min-w-[3ch]">
          {progressPercent}%
        </span>
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-center gap-6 text-sm">
        <div className="flex items-center gap-1.5 text-foreground">
          <Users className="h-4 w-4 text-accent" />
          <span className="font-medium tabular-nums">{leadsFound}</span>
          <span className="text-muted-foreground">leads</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="h-4 w-4" />
          <span className="tabular-nums">{formatTime(elapsedTime)}</span>
        </div>
      </div>
    </div>
  );
}
