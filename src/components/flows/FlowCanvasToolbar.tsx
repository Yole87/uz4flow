import { useReactFlow } from "@xyflow/react";
import { Button } from "@/components/ui/button";
import { ZoomIn, ZoomOut, Maximize, Plus, GitBranch, Sparkles } from "lucide-react";

interface FlowCanvasToolbarProps {
  onAddStep: () => void;
  onAddCondition?: () => void;
  onToggleAI?: () => void;
  aiPanelOpen?: boolean;
}

export function FlowCanvasToolbar({ onAddStep, onAddCondition, onToggleAI, aiPanelOpen }: FlowCanvasToolbarProps) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();

  return (
    <div className="absolute top-3 left-3 z-10 flex gap-1.5">
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 quantum-glass border-border/50"
        onClick={() => zoomIn({ duration: 200 })}
        title="Zoom in"
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 quantum-glass border-border/50"
        onClick={() => zoomOut({ duration: 200 })}
        title="Zoom out"
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        className="h-8 w-8 quantum-glass border-border/50"
        onClick={() => fitView({ duration: 300, padding: 0.2 })}
        title="Ajustar à tela"
      >
        <Maximize className="h-4 w-4" />
      </Button>
      <div className="w-px bg-border/50 mx-1" />
      <Button
        size="sm"
        className="h-8 gradient-primary hover:opacity-90 text-xs"
        onClick={onAddStep}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Etapa
      </Button>
      {onAddCondition && (
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs quantum-glass border-border/50"
          onClick={onAddCondition}
        >
          <GitBranch className="h-3.5 w-3.5 mr-1" />
          IF/ELSE
        </Button>
      )}
      {onToggleAI && (
        <>
          <div className="w-px bg-border/50 mx-1" />
          <Button
            size="sm"
            className={`h-8 text-xs ${aiPanelOpen ? "bg-violet-600 hover:bg-violet-700" : "bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90"}`}
            onClick={onToggleAI}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            IA
          </Button>
        </>
      )}
    </div>
  );
}
