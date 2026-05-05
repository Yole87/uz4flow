import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { YouTubePlayer } from "./YouTubePlayer";

interface Tutorial {
  id: string;
  title: string;
  description?: string | null;
  youtube_video_id: string;
}

interface TutorialPlayerDialogProps {
  tutorial: Tutorial | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export function TutorialPlayerDialog({
  tutorial,
  open,
  onOpenChange,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: TutorialPlayerDialogProps) {
  if (!tutorial) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 overflow-hidden">
        <YouTubePlayer videoId={tutorial.youtube_video_id} autoplay />
        <div className="p-3 sm:p-5">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg">{tutorial.title}</DialogTitle>
            {tutorial.description && (
              <DialogDescription className="text-sm mt-1">
                {tutorial.description}
              </DialogDescription>
            )}
          </DialogHeader>
          {(hasPrev || hasNext) && (
            <div className="flex justify-between mt-3 sm:mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={onPrev}
                disabled={!hasPrev}
              >
                <ChevronLeft className="h-4 w-4 mr-1" /> Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onNext}
                disabled={!hasNext}
              >
                Próximo <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
