import { useState, useRef, useCallback } from "react";
import { useLia } from "./LiaProvider";
import { LiaChatPanel } from "./LiaChatPanel";
import { GuidedOverlay } from "./GuidedOverlay";
import { LiaAvatar } from "./LiaAvatar";
import { useOnboardingTour } from "@/hooks/useOnboardingTour";

const STORAGE_KEY = "lia-fab-pos";
const DRAG_THRESHOLD = 5;
const FAB_SIZE = 56;

function getDefaultPos() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { right: 24, bottom: 96 };
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

export function LiaFab() {
  const { isOpen, setIsOpen, guidedSteps } = useLia();
  useOnboardingTour();

  const [pos, setPos] = useState(getDefaultPos);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startX: 0, startY: 0, startRight: 0, startBottom: 0, moved: false });

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startRight: pos.right,
      startBottom: pos.bottom,
      moved: false,
    };
    setDragging(true);
  }, [pos]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      dragRef.current.moved = true;
    }
    if (!dragRef.current.moved) return;
    const maxRight = window.innerWidth - FAB_SIZE;
    const maxBottom = window.innerHeight - FAB_SIZE;
    setPos({
      right: clamp(dragRef.current.startRight - dx, 0, maxRight),
      bottom: clamp(dragRef.current.startBottom + dy, 0, maxBottom),
    });
  }, [dragging]);

  const onPointerUp = useCallback((e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    setDragging(false);
    if (!dragRef.current.moved) {
      setIsOpen(!isOpen);
    } else {
      const maxRight = window.innerWidth - FAB_SIZE;
      const maxBottom = window.innerHeight - FAB_SIZE;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const finalPos = {
        right: clamp(dragRef.current.startRight - dx, 0, maxRight),
        bottom: clamp(dragRef.current.startBottom + dy, 0, maxBottom),
      };
      setPos(finalPos);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(finalPos)); } catch {}
    }
  }, [isOpen, setIsOpen]);

  return (
    <>
      {/* FAB Button */}
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className="fixed z-[9999] group select-none"
        style={{
          right: pos.right,
          bottom: pos.bottom,
          touchAction: "none",
          cursor: dragging ? "grabbing" : "grab",
        }}
        aria-label="Abrir assistente LIA"
      >
        <div className="relative">
          {/* Pulse ring */}
          <div className="absolute inset-0 rounded-full gradient-primary opacity-30 animate-ping" style={{ animationDuration: "3s" }} />
          
          {/* Button body */}
          <div className="relative h-14 w-14 rounded-full gradient-primary flex items-center justify-center shadow-lg neon-glow-pink transition-transform duration-200 group-hover:scale-110 group-active:scale-95 overflow-hidden">
            <LiaAvatar size={42} animate />
          </div>

          {/* Online badge */}
          <div className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-success border-2 border-background flex items-center justify-center">
            <div className="h-1.5 w-1.5 rounded-full bg-white" />
          </div>
        </div>
      </button>

      {/* Chat Panel */}
      <LiaChatPanel />

      {/* Guided Overlay */}
      {guidedSteps && <GuidedOverlay />}
    </>
  );
}
