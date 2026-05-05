import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getYouTubeThumbnail } from "@/lib/youtube";

interface TutorialHeroProps {
  title: string;
  description?: string | null;
  youtubeVideoId: string;
  thumbnailUrl?: string | null;
  onClick: () => void;
}

export function TutorialHero({ title, description, youtubeVideoId, thumbnailUrl, onClick }: TutorialHeroProps) {
  const thumb = thumbnailUrl || getYouTubeThumbnail(youtubeVideoId);

  return (
    <div
      className="relative w-full rounded-xl overflow-hidden cursor-pointer group"
      style={{ aspectRatio: "21/9", minHeight: 200 }}
      onClick={onClick}
    >
      <img
        src={thumb}
        alt={title}
        className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
      />
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-background/95 via-background/70 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />

      {/* Content */}
      <div className="relative z-10 flex flex-col justify-end h-full p-5 sm:p-8 max-w-xl">
        <span className="text-xs font-medium uppercase tracking-wider text-primary mb-2">
          ▶ Em destaque
        </span>
        <h2 className="text-xl sm:text-3xl font-bold text-foreground leading-tight mb-2">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground line-clamp-2 mb-4 hidden sm:block">
            {description}
          </p>
        )}
        <Button
          size="sm"
          className="gradient-primary text-primary-foreground w-fit gap-2"
          onClick={(e) => { e.stopPropagation(); onClick(); }}
        >
          <Play className="h-4 w-4" />
          Assistir Agora
        </Button>
      </div>
    </div>
  );
}
