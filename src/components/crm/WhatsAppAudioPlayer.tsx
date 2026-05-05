import { useState, useRef, useEffect, useCallback } from "react";
import { Play, Pause, MicOff, ChevronDown, ChevronUp, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

interface WhatsAppAudioPlayerProps {
  src: string;
  mime?: string;
  isOutbound?: boolean;
  transcript?: string | null;
  loading?: boolean;
}

const SPEEDS = [1, 1.5, 2] as const;

export function WhatsAppAudioPlayer({ src, mime, isOutbound = false, transcript, loading = false }: WhatsAppAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speedIdx, setSpeedIdx] = useState(0);
  const [error, setError] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);

  const formatTime = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
    } else {
      audio.play().catch(() => setError(true));
      setHasPlayed(true);
    }
    setPlaying(!playing);
  }, [playing]);

  const cycleSpeed = useCallback(() => {
    const next = (speedIdx + 1) % SPEEDS.length;
    setSpeedIdx(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = SPEEDS[next];
    }
  }, [speedIdx]);

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
    setCurrentTime(audio.currentTime);
  }, [duration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onDurationChange = () => setDuration(audio.duration);
    const onEnded = () => { setPlaying(false); setCurrentTime(0); };
    const onError = () => setError(true);
    const onLoadedMetadata = () => setDuration(audio.duration);

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("durationchange", onDurationChange);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("loadedmetadata", onLoadedMetadata);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, []);

  if (loading) {
    return (
      <div className="min-w-[160px]">
        <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg animate-pulse">
          <Play className="h-5 w-5 shrink-0" />
          <span className="text-sm">Carregando áudio...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-w-[160px]">
        <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <MicOff className="h-5 w-5 shrink-0" />
          <span className="text-sm">Áudio (link expirado)</span>
        </div>
        {transcript && (
          <div className="mt-1.5">
            <button
              onClick={() => setShowTranscript(!showTranscript)}
              className={cn(
                "flex items-center gap-1 text-xs transition-colors",
                isOutbound ? "text-white/60 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="h-3 w-3" />
              <span>Transcrição</span>
              {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showTranscript && (
              <p className={cn(
                "text-xs mt-1 p-2 rounded-md whitespace-pre-wrap",
                isOutbound ? "bg-white/10 text-white/80" : "bg-muted/50 text-foreground/80"
              )}>
                {transcript}
              </p>
            )}
          </div>
        )}
      </div>
    );
  }

  // Determine the actual MIME type
  const audioMime = src.startsWith("data:")
    ? src.substring(5, src.indexOf(";"))
    : (mime || "audio/ogg");

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="min-w-[180px] sm:min-w-[220px] max-w-[300px]">
      <div className="flex items-center gap-2">
        {/* Hidden audio element */}
        <audio ref={audioRef} preload="metadata">
          <source src={src} type={audioMime} />
        </audio>

        {/* Play/Pause button */}
        <button
          onClick={togglePlay}
          className={cn(
            "h-9 w-9 shrink-0 rounded-full flex items-center justify-center transition-colors",
            isOutbound
              ? "bg-white/20 hover:bg-white/30 text-white"
              : "bg-accent/20 hover:bg-accent/30 text-accent"
          )}
          aria-label={playing ? "Pausar" : "Reproduzir"}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 ml-0.5" />}
        </button>

        {/* Progress + time */}
        <div className="flex-1 min-w-0 flex flex-col gap-1">
          {/* Seekable progress bar */}
          <div
            ref={progressRef}
            className="h-1.5 bg-muted/50 rounded-full cursor-pointer relative"
            onClick={handleSeek}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-100",
                isOutbound ? "bg-white/70" : "bg-accent"
              )}
              style={{ width: `${progress}%` }}
            />
            {/* Thumb */}
            <div
              className={cn(
                "absolute top-1/2 -translate-y-1/2 h-3 w-3 rounded-full shadow-sm transition-[left] duration-100",
                isOutbound ? "bg-white" : "bg-accent"
              )}
              style={{ left: `calc(${progress}% - 6px)` }}
            />
          </div>

          {/* Time display */}
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-xs font-terminal",
              isOutbound ? "text-white/60" : "text-muted-foreground"
            )}>
              {formatTime(currentTime)}
            </span>
            <span className={cn(
              "text-xs font-terminal",
              isOutbound ? "text-white/60" : "text-muted-foreground"
            )}>
              {formatTime(duration)}
            </span>
          </div>
        </div>

        {/* Speed button - only visible after first play */}
        {hasPlayed && (
          <button
            onClick={cycleSpeed}
            className={cn(
              "shrink-0 text-xs font-terminal font-bold px-1.5 py-0.5 rounded border transition-colors",
              isOutbound
                ? "border-white/30 text-white/80 hover:bg-white/10"
                : "border-accent/30 text-accent hover:bg-accent/10"
            )}
          >
            {SPEEDS[speedIdx]}x
          </button>
        )}
      </div>

      {/* Expandable transcript */}
      {transcript && (
        <div className="mt-1.5">
          <button
            onClick={() => setShowTranscript(!showTranscript)}
            className={cn(
              "flex items-center gap-1 text-xs transition-colors",
              isOutbound ? "text-white/60 hover:text-white/80" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <FileText className="h-3 w-3" />
            <span>Transcrição</span>
            {showTranscript ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
          {showTranscript && (
            <p className={cn(
              "text-xs mt-1 p-2 rounded-md whitespace-pre-wrap",
              isOutbound ? "bg-white/10 text-white/80" : "bg-muted/50 text-foreground/80"
            )}>
              {transcript}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
