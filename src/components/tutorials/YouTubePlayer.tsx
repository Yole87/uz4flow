import { useEffect, useRef, useState, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize, Loader2, Settings } from "lucide-react";
import { formatDuration } from "@/lib/youtube";
import { cn } from "@/lib/utils";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: (() => void) | undefined;
  }
}

interface YouTubePlayerProps {
  videoId: string;
  autoplay?: boolean;
  className?: string;
}

let apiLoadPromise: Promise<void> | null = null;

function loadYTApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();
  if (apiLoadPromise) return apiLoadPromise;
  apiLoadPromise = new Promise<void>((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiLoadPromise;
}

export function YouTubePlayer({ videoId, autoplay = false, className }: YouTubePlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>();

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(80);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [loading, setLoading] = useState(true);
  const [availableQualities, setAvailableQualities] = useState<string[]>([]);
  const [selectedQuality, setSelectedQuality] = useState("auto");
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const hideTimeout = useRef<ReturnType<typeof setTimeout>>();
  const qualityMenuRef = useRef<HTMLDivElement>(null);

  // Create player
  useEffect(() => {
    let destroyed = false;
    const id = `yt-player-${videoId}-${Math.random().toString(36).slice(2, 8)}`;

    loadYTApi().then(() => {
      if (destroyed || !iframeContainerRef.current) return;

      const div = document.createElement("div");
      div.id = id;
      iframeContainerRef.current.innerHTML = "";
      iframeContainerRef.current.appendChild(div);

      playerRef.current = new window.YT.Player(id, {
        videoId,
        playerVars: {
          autoplay: autoplay ? 1 : 0,
          controls: 0,
          modestbranding: 1,
          showinfo: 0,
          rel: 0,
          iv_load_policy: 3,
          disablekb: 1,
          
          fs: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            if (destroyed) return;
            setReady(true);
            setLoading(false);
            setDuration(e.target.getDuration());
            e.target.setVolume(80);
            const qualities = e.target.getAvailableQualityLevels?.() || [];
            setAvailableQualities(qualities.filter((q: string) => q !== 'auto'));
          },
          onStateChange: (e: any) => {
            if (destroyed) return;
            const state = e.data;
            setPlaying(state === 1);
            if (state === 1) {
              setLoading(false);
              setDuration(e.target.getDuration());
              const qualities = e.target.getAvailableQualityLevels?.() || [];
              if (qualities.length) setAvailableQualities(qualities.filter((q: string) => q !== 'auto'));
            } else if (state === 3) {
              setLoading(true);
            } else {
              setLoading(false);
            }
          },
        },
      });
    });

    return () => {
      destroyed = true;
      try { playerRef.current?.destroy(); } catch {}
      playerRef.current = null;
    };
  }, [videoId, autoplay]);

  // Time tracking
  useEffect(() => {
    if (playing) {
      intervalRef.current = setInterval(() => {
        if (playerRef.current?.getCurrentTime) {
          setCurrentTime(playerRef.current.getCurrentTime());
        }
      }, 250);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  // Fullscreen listener
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Auto-hide controls
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimeout.current);
    if (playing) {
      hideTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  }, [playing]);

  useEffect(() => {
    if (!playing) setShowControls(true);
    else resetHideTimer();
  }, [playing, resetHideTimer]);

  const togglePlay = () => {
    if (!playerRef.current) return;
    if (playing) playerRef.current.pauseVideo();
    else playerRef.current.playVideo();
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    playerRef.current.seekTo(pct * duration, true);
    setCurrentTime(pct * duration);
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    if (muted) {
      playerRef.current.unMute();
      playerRef.current.setVolume(volume);
    } else {
      playerRef.current.mute();
    }
    setMuted(!muted);
  };

  const handleVolume = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!playerRef.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const v = Math.round(pct * 100);
    setVolume(v);
    playerRef.current.setVolume(v);
    if (v === 0) { playerRef.current.mute(); setMuted(true); }
    else if (muted) { playerRef.current.unMute(); setMuted(false); }
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else containerRef.current.requestFullscreen();
  };

  const qualityLabels: Record<string, string> = {
    hd2160: "4K",
    hd1440: "1440p",
    hd1080: "1080p",
    hd720: "720p",
    large: "480p",
    medium: "360p",
    small: "240p",
    tiny: "144p",
  };

  const handleQualityChange = (quality: string) => {
    if (!playerRef.current) return;
    playerRef.current.setPlaybackQuality(quality);
    setSelectedQuality(quality);
    setShowQualityMenu(false);
  };

  // Close quality menu on outside click
  useEffect(() => {
    if (!showQualityMenu) return;
    const handler = (e: MouseEvent) => {
      if (qualityMenuRef.current && !qualityMenuRef.current.contains(e.target as Node)) {
        setShowQualityMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showQualityMenu]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full bg-black rounded-lg overflow-hidden group select-none", className)}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => playing && setShowControls(false)}
      style={{ aspectRatio: "16/9" }}
    >
      {/* YouTube iframe container */}
      <div ref={iframeContainerRef} className="absolute inset-0 w-full h-full [&>iframe]:w-full [&>iframe]:h-full" />

      {/* Protection overlay — blocks clicks on YT elements */}
      <div
        className="absolute inset-0 z-10 cursor-pointer"
        onClick={togglePlay}
        onDoubleClick={toggleFullscreen}
      />

      {/* Loading spinner */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <Loader2 className="h-10 w-10 animate-spin text-white/70" />
        </div>
      )}

      {/* Big play button when paused */}
      {ready && !playing && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full bg-primary/90 flex items-center justify-center shadow-lg">
            <Play className="h-7 w-7 text-primary-foreground ml-1" fill="currentColor" />
          </div>
        </div>
      )}

      {/* Custom controls bar */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300",
          showControls || !playing ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        {/* Gradient fade */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent pointer-events-none" />

        <div className="relative px-3 pb-2.5 pt-8 space-y-1.5">
          {/* Progress bar */}
          <div
            className="w-full h-1.5 bg-white/20 rounded-full cursor-pointer group/bar hover:h-2.5 transition-all"
            onClick={handleSeek}
          >
            <div
              className="h-full bg-primary rounded-full relative transition-all"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-md opacity-0 group-hover/bar:opacity-100 transition-opacity" />
            </div>
          </div>

          {/* Controls row */}
          <div className="flex items-center gap-3 text-white">
            <button onClick={togglePlay} className="hover:text-primary transition-colors p-1">
              {playing ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
            </button>

            {/* Volume */}
            <div className="flex items-center gap-1.5 group/vol">
              <button onClick={toggleMute} className="hover:text-primary transition-colors p-1">
                {muted || volume === 0 ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <div
                className="w-0 group-hover/vol:w-16 overflow-hidden transition-all duration-200 cursor-pointer"
                onClick={handleVolume}
              >
                <div className="w-16 h-1 bg-white/30 rounded-full">
                  <div className="h-full bg-white rounded-full" style={{ width: `${muted ? 0 : volume}%` }} />
                </div>
              </div>
            </div>

            {/* Time */}
            <span className="text-xs text-white/70 tabular-nums">
              {formatDuration(Math.floor(currentTime))} / {formatDuration(Math.floor(duration))}
            </span>

            <div className="flex-1" />

            {/* Quality selector */}
            {availableQualities.length > 0 && (
              <div className="relative" ref={qualityMenuRef}>
                <button
                  onClick={() => setShowQualityMenu((v) => !v)}
                  className="hover:text-primary transition-colors p-1 flex items-center gap-1"
                >
                  <Settings className="h-4 w-4" />
                  <span className="text-xs font-medium">
                    {selectedQuality === "auto" ? "Auto" : qualityLabels[selectedQuality] || selectedQuality}
                  </span>
                </button>
                {showQualityMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-black/90 border border-white/10 rounded-md py-1 min-w-[100px] backdrop-blur-sm">
                    <button
                      onClick={() => handleQualityChange("auto")}
                      className={cn(
                        "w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors",
                        selectedQuality === "auto" && "text-primary font-semibold"
                      )}
                    >
                      Auto
                    </button>
                    {availableQualities.map((q) => (
                      <button
                        key={q}
                        onClick={() => handleQualityChange(q)}
                        className={cn(
                          "w-full text-left px-3 py-1.5 text-xs hover:bg-white/10 transition-colors",
                          selectedQuality === q && "text-primary font-semibold"
                        )}
                      >
                        {qualityLabels[q] || q}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Fullscreen */}
            <button onClick={toggleFullscreen} className="hover:text-primary transition-colors p-1">
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
