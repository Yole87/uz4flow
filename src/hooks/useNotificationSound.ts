import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "crm_notification_sound";
const SOUND_URL = "/sounds/notification.mp3";
const THROTTLE_MS = 2000;
const TITLE_PREFIX = "🔔 Nova mensagem • ";

function readEnabled(): boolean {
  if (typeof window === "undefined") return true;
  const v = localStorage.getItem(STORAGE_KEY);
  return v === null ? true : v === "1";
}

let audioSingleton: HTMLAudioElement | null = null;
let lastPlayAt = 0;
let originalTitle: string | null = null;

function ensureAudio(): HTMLAudioElement {
  if (!audioSingleton) {
    audioSingleton = new Audio(SOUND_URL);
    audioSingleton.preload = "auto";
    audioSingleton.volume = 0.5;
  }
  return audioSingleton;
}

function isTabActive(): boolean {
  if (typeof document === "undefined") return true;
  return document.visibilityState === "visible" && document.hasFocus();
}

/**
 * Notification sound + tab title flash for new inbound CRM messages.
 * - User toggle persisted in localStorage.
 * - Throttled to avoid sound spam.
 * - Falls back silently if browser blocks audio (no prior user interaction).
 */
export function useNotificationSound() {
  const [enabled, setEnabledState] = useState<boolean>(() => readEnabled());
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // Restore tab title on focus
  useEffect(() => {
    if (originalTitle === null) originalTitle = document.title;
    const onVisibility = () => {
      if (isTabActive() && originalTitle) {
        document.title = originalTitle;
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("focus", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("focus", onVisibility);
    };
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    setEnabledState(v);
  }, []);

  const playNotification = useCallback(() => {
    if (!enabledRef.current) return;

    const now = Date.now();
    if (now - lastPlayAt < THROTTLE_MS) return;
    lastPlayAt = now;

    // Tab title flash when not focused
    if (!isTabActive()) {
      if (originalTitle === null) originalTitle = document.title;
      const base = originalTitle ?? "";
      if (!document.title.startsWith(TITLE_PREFIX)) {
        document.title = `${TITLE_PREFIX}${base.replace(TITLE_PREFIX, "")}`;
      }
    }

    try {
      const audio = ensureAudio();
      audio.currentTime = 0;
      const p = audio.play();
      if (p && typeof p.catch === "function") {
        p.catch(() => {
          // Browser blocked autoplay (no user interaction yet) — ignore
        });
      }
    } catch {
      // ignore
    }
  }, []);

  return { enabled, setEnabled, playNotification };
}
