import { useState } from "react";
import { ChevronDown, ChevronRight, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PayloadPreviewProps {
  payload: Record<string, unknown>;
  maxHeight?: string;
}

export function PayloadPreview({ payload, maxHeight = "300px" }: PayloadPreviewProps) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const formattedJson = JSON.stringify(payload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(formattedJson);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="border rounded-lg overflow-hidden bg-muted/30">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/50">
        <button
          className="flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          Payload JSON
        </button>
        <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={handleCopy}>
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" />
              Copiado
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              Copiar
            </>
          )}
        </Button>
      </div>
      
      {expanded && (
        <pre
          className="p-3 text-xs font-mono overflow-auto max-w-full"
          style={{ maxHeight }}
        >
          <code className="text-foreground/80">
            {formattedJson}
          </code>
        </pre>
      )}
    </div>
  );
}
