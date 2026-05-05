import { useEffect, useState, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { X, ChevronLeft, ChevronRight, CheckCircle2, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLia } from "./LiaProvider";
import { LiaAvatar } from "./LiaAvatar";

export function GuidedOverlay() {
  const { guidedSteps, setGuidedSteps, currentGuidedIndex, setCurrentGuidedIndex, onGuidedComplete, setIsOpen, setMessages } = useLia();
  const navigate = useNavigate();
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [interactionDetected, setInteractionDetected] = useState(false);
  const observerRef = useRef<MutationObserver | null>(null);

  const step = guidedSteps?.[currentGuidedIndex];

  const updateRect = useCallback(() => {
    if (!step?.selector) return;
    const el = document.querySelector(step.selector);
    if (el) {
      setTargetRect(el.getBoundingClientRect());
    } else {
      setTargetRect(null);
    }
  }, [step?.selector]);

  // Navigate to route and find element
  useEffect(() => {
    if (!step) return;
    setInteractionDetected(false);
    if (step.route && step.route !== "/" && window.location.pathname !== step.route) {
      navigate(step.route);
    }
    const timer = setTimeout(updateRect, 500);
    return () => clearTimeout(timer);
  }, [step, navigate, updateRect]);

  // Update rect on resize/scroll
  useEffect(() => {
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect]);

  // Observe changes on the target element (input, clicks, value changes)
  useEffect(() => {
    if (!step?.selector) return;

    const setupObserver = () => {
      const el = document.querySelector(step.selector);
      if (!el) return;

      // Listen for user interactions
      const handleInteraction = () => setInteractionDetected(true);
      el.addEventListener("click", handleInteraction);
      el.addEventListener("input", handleInteraction);
      el.addEventListener("change", handleInteraction);

      // MutationObserver for DOM changes within the element
      observerRef.current = new MutationObserver(() => {
        setInteractionDetected(true);
      });
      observerRef.current.observe(el, {
        childList: true,
        subtree: true,
        attributes: true,
        characterData: true,
      });

      return () => {
        el.removeEventListener("click", handleInteraction);
        el.removeEventListener("input", handleInteraction);
        el.removeEventListener("change", handleInteraction);
        observerRef.current?.disconnect();
      };
    };

    const timer = setTimeout(setupObserver, 600);
    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [step?.selector, currentGuidedIndex]);

  const handleClose = () => {
    onGuidedComplete?.onSkip?.();
    setGuidedSteps(null);
    setCurrentGuidedIndex(0);
  };

  const handleNext = () => {
    if (!guidedSteps) return;
    if (currentGuidedIndex < guidedSteps.length - 1) {
      setCurrentGuidedIndex(currentGuidedIndex + 1);
    } else {
      onGuidedComplete?.onComplete?.();
      setGuidedSteps(null);
      setCurrentGuidedIndex(0);
    }
  };

  const handlePrev = () => {
    if (currentGuidedIndex > 0) {
      setCurrentGuidedIndex(currentGuidedIndex - 1);
    }
  };

  const handleNeedHelp = () => {
    if (!step) return;
    setIsOpen(true);
    setMessages((prev) => [
      ...prev,
      {
        role: "user" as const,
        content: `Estou com dificuldade no passo "${step.title}": ${step.description}`,
      },
    ]);
  };

  // Highlight the target element and make it interactive
  useEffect(() => {
    if (!step?.selector) return;
    const el = document.querySelector(step.selector) as HTMLElement | null;
    if (el) {
      el.classList.add("lia-tour-highlight");
      el.style.position = "relative";
      el.style.zIndex = "10002";
      el.style.pointerEvents = "auto";
    }
    return () => {
      if (el) {
        el.classList.remove("lia-tour-highlight");
        el.style.position = "";
        el.style.zIndex = "";
        el.style.pointerEvents = "";
      }
    };
  }, [step?.selector]);

  if (!guidedSteps || !step) return null;

  const padding = 8;
  const spotlightStyle = targetRect
    ? {
        top: targetRect.top - padding,
        left: targetRect.left - padding,
        width: targetRect.width + padding * 2,
        height: targetRect.height + padding * 2,
      }
    : null;

  // Responsive tooltip positioning
  const getTooltipStyle = (): React.CSSProperties => {
    if (!targetRect) {
      return {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        maxWidth: "360px",
      };
    }

    const tooltipHeight = 220;
    const spaceBelow = window.innerHeight - targetRect.bottom - padding - 12;
    const spaceAbove = targetRect.top - padding - 12;
    const isMobile = window.innerWidth < 640;

    if (spaceBelow >= tooltipHeight || spaceBelow >= spaceAbove) {
      return {
        position: "fixed",
        top: targetRect.bottom + padding + 12,
        left: isMobile ? 16 : Math.max(16, Math.min(targetRect.left, window.innerWidth - 340)),
        maxWidth: isMobile ? "calc(100vw - 32px)" : "320px",
      };
    }

    return {
      position: "fixed",
      bottom: window.innerHeight - targetRect.top + padding + 12,
      left: isMobile ? 16 : Math.max(16, Math.min(targetRect.left, window.innerWidth - 340)),
      maxWidth: isMobile ? "calc(100vw - 32px)" : "320px",
    };
  };

  return createPortal(
    <div className="fixed inset-0 z-[10000]" style={{ pointerEvents: "none" }}>
      {/* Spotlight overlay with cutout — dark area blocks clicks, spotlight area is open */}
      {spotlightStyle ? (
        <>
          {/* Top dark band */}
          <div className="absolute" style={{ top: 0, left: 0, right: 0, height: spotlightStyle.top, background: "rgba(0,0,0,0.7)", pointerEvents: "auto", zIndex: 10000 }} />
          {/* Bottom dark band */}
          <div className="absolute" style={{ top: spotlightStyle.top + spotlightStyle.height, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.7)", pointerEvents: "auto", zIndex: 10000 }} />
          {/* Left dark band */}
          <div className="absolute" style={{ top: spotlightStyle.top, left: 0, width: spotlightStyle.left, height: spotlightStyle.height, background: "rgba(0,0,0,0.7)", pointerEvents: "auto", zIndex: 10000 }} />
          {/* Right dark band */}
          <div className="absolute" style={{ top: spotlightStyle.top, left: spotlightStyle.left + spotlightStyle.width, right: 0, height: spotlightStyle.height, background: "rgba(0,0,0,0.7)", pointerEvents: "auto", zIndex: 10000 }} />
          {/* Spotlight border ring (no pointer-events, just visual) */}
          <div
            className="absolute rounded-lg border-2 border-primary/50 transition-all duration-500 ease-out"
            style={{
              ...spotlightStyle,
              boxShadow: "0 0 20px hsl(338 100% 53% / 0.4)",
              zIndex: 10001,
              pointerEvents: "none",
            }}
          />
        </>
      ) : (
        <div className="absolute inset-0 bg-black/70" style={{ pointerEvents: "auto" }} />
      )}

      {/* Tooltip */}
      <div style={{ ...getTooltipStyle(), zIndex: 10003, pointerEvents: "auto" }} className="quantum-glass-strong rounded-xl p-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start gap-3 mb-3">
          <LiaAvatar size={32} />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-semibold text-foreground">{step.title}</h4>
              {interactionDetected && (
                <CheckCircle2 className="h-4 w-4 text-emerald-400 animate-in zoom-in duration-300" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{step.description}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-6 w-6 -mt-1 -mr-1" onClick={handleClose}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Progress + Nav */}
        <div className="space-y-3">
          {/* Progress dots centered */}
          <div className="flex justify-center gap-1.5">
            {guidedSteps.map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === currentGuidedIndex ? "w-4 bg-primary" : i < currentGuidedIndex ? "w-1.5 bg-primary/50" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
          {/* Buttons */}
          <div className="flex items-center justify-between gap-0.5 sm:gap-1">
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs sm:text-xs" onClick={handlePrev} disabled={currentGuidedIndex === 0}>
              <ChevronLeft className="h-3 w-3 mr-0.5" />
              Voltar
            </Button>
            <Button variant="ghost" size="sm" className="h-6 sm:h-7 px-1.5 sm:px-2 text-xs sm:text-xs text-muted-foreground" onClick={handleNeedHelp}>
              <HelpCircle className="h-3 w-3 mr-0.5" />
              Ajuda
            </Button>
            <Button size="sm" className="h-6 sm:h-7 px-2 sm:px-3 text-xs sm:text-xs gradient-primary border-0" onClick={handleNext}>
              {currentGuidedIndex === guidedSteps.length - 1 ? "Concluir" : "Próximo"}
              {currentGuidedIndex < guidedSteps.length - 1 && <ChevronRight className="h-3 w-3 ml-0.5" />}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
