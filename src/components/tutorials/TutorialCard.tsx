import { Play, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { getYouTubeThumbnail, formatDuration } from "@/lib/youtube";

interface TutorialCardProps {
  title: string;
  description?: string | null;
  youtubeVideoId: string;
  thumbnailUrl?: string | null;
  durationSeconds?: number | null;
  onClick: () => void;
}

export function TutorialCard({
  title,
  description,
  youtubeVideoId,
  thumbnailUrl,
  durationSeconds,
  onClick,
}: TutorialCardProps) {
  const thumb = thumbnailUrl || getYouTubeThumbnail(youtubeVideoId);

  return (
    <Card
      className="group cursor-pointer overflow-hidden border-border/50 bg-card hover:border-primary/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary/5"
      onClick={onClick}
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={thumb}
          alt={title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <div className="flex h-10 w-10 sm:h-14 sm:w-14 items-center justify-center rounded-full bg-primary/90 text-primary-foreground shadow-lg">
            <Play className="h-5 w-5 sm:h-6 sm:w-6 ml-0.5" />
          </div>
        </div>
        {durationSeconds != null && durationSeconds > 0 && (
          <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded bg-black/75 px-2 py-0.5 text-xs font-medium text-white">
            <Clock className="h-3 w-3" />
            {formatDuration(durationSeconds)}
          </span>
        )}
      </div>
      <div className="p-3 sm:p-4">
        <h3 className="font-semibold text-foreground line-clamp-2 text-sm leading-snug">
          {title}
        </h3>
        {description && (
          <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">
            {description}
          </p>
        )}
      </div>
    </Card>
  );
}
