import { cn } from "@/lib/utils";

interface CharCounterProps {
  current: number;
  max: number;
  className?: string;
}

export function CharCounter({ current, max, className }: CharCounterProps) {
  const isOver = current > max;
  const isNear = current > max * 0.85;

  return (
    <span
      className={cn(
        "text-xs tabular-nums transition-colors",
        isOver
          ? "text-destructive font-medium"
          : isNear
            ? "text-yellow-600 dark:text-yellow-400"
            : "text-muted-foreground",
        className
      )}
    >
      {current}/{max}
    </span>
  );
}
