import { Card, CardContent } from "@/components/ui/card";
import { PlayCircle } from "lucide-react";
import { YouTubePlayer } from "@/components/tutorials/YouTubePlayer";

interface ServiceTutorialVideoProps {
  videoId?: string;
  title?: string;
  description?: string;
}

export function ServiceTutorialVideo({ videoId, title, description }: ServiceTutorialVideoProps) {
  if (!videoId) {
    return (
      <Card className="border-border">
        <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center">
            <PlayCircle className="h-7 w-7 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-muted-foreground">Vídeo tutorial em breve</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Estamos preparando um vídeo explicativo para esta configuração.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border overflow-hidden">
      {(title || description) && (
        <div className="p-4 pb-0 space-y-1">
          {title && <p className="text-sm font-medium text-foreground">{title}</p>}
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      <CardContent className="p-4">
        <YouTubePlayer videoId={videoId} />
      </CardContent>
    </Card>
  );
}
