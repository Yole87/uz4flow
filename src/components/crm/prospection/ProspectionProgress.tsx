import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { StopCircle, Clock, Users } from "lucide-react";

interface ProspectionProgressProps {
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

export function ProspectionProgress({
  currentPhase,
  progressPercent,
  leadsFound,
  elapsedTime,
  onStop,
}: ProspectionProgressProps) {
  return (
    <div className="space-y-4 p-4 sm:p-6 bg-card border border-border rounded-lg">
      {/* Phase indicator */}
      <div className="flex items-center justify-center gap-2 text-sm text-accent">
        <div className="h-2 w-2 bg-accent rounded-full animate-pulse" />
        <span className="font-medium">{currentPhase || "Processando..."}</span>
      </div>

      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Progresso</span>
          <span className="text-accent font-medium">{progressPercent}%</span>
        </div>
        <Progress 
          value={progressPercent} 
          className="h-2 bg-muted"
        />
      </div>

      {/* Stats */}
      <div className="flex items-center justify-center gap-4 sm:gap-8">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Users className="h-5 w-5 text-accent" />
            <span className="text-3xl font-bold text-accent tabular-nums">
              {leadsFound}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">leads encontrados</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-medium text-foreground tabular-nums">
              {formatTime(elapsedTime)}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">tempo decorrido</div>
        </div>
      </div>

      {/* Stop button */}
      <Button
        variant="destructive"
        onClick={onStop}
        className="w-full"
      >
        <StopCircle className="h-4 w-4 mr-2" />
        Parar Busca
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Os leads já encontrados serão mantidos mesmo após parar a busca
      </p>
    </div>
  );
}
