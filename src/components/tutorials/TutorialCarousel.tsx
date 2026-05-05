import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TutorialCard } from "./TutorialCard";

interface Tutorial {
  id: string;
  title: string;
  description?: string | null;
  youtube_video_id: string;
  thumbnail_url?: string | null;
  duration_seconds?: number | null;
}

interface TutorialCarouselProps {
  title: string;
  tutorials: Tutorial[];
  onSelect: (tutorial: Tutorial) => void;
}

export function TutorialCarousel({ title, tutorials, onSelect }: TutorialCarouselProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (!scrollRef.current) return;
    const amount = scrollRef.current.clientWidth * 0.7;
    scrollRef.current.scrollBy({ left: direction === "left" ? -amount : amount, behavior: "smooth" });
  };

  if (tutorials.length === 0) return null;

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-base sm:text-lg font-semibold text-foreground">{title}</h3>
        {tutorials.length > 2 && (
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll("left")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => scroll("right")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div
        ref={scrollRef}
        className="flex gap-3 sm:gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 scrollbar-hide"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {tutorials.map((t) => (
          <div key={t.id} className="snap-start shrink-0 w-[260px] sm:w-[300px]">
            <TutorialCard
              title={t.title}
              description={t.description}
              youtubeVideoId={t.youtube_video_id}
              thumbnailUrl={t.thumbnail_url}
              durationSeconds={t.duration_seconds}
              onClick={() => onSelect(t)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}
