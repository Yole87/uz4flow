import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  Music,
  Video,
  Image,
  FileText,
  Clock,
  Trash2,
  ArrowUp,
  ArrowDown,
  Upload,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface BlockContentItem {
  type: "text" | "audio" | "video" | "image" | "file" | "interval";
  content?: string;
  fileId?: string;
  fileName?: string;
  mimeType?: string;
  delayMs?: number;
}

interface BlockContentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialContents: BlockContentItem[];
  onSave: (contents: BlockContentItem[]) => void;
  flowId: string;
  userId: string;
  organizationId?: string;
}

const CONTENT_TYPES = [
  { type: "text" as const, label: "Texto", icon: MessageSquare, color: "bg-blue-500" },
  { type: "audio" as const, label: "Áudio", icon: Music, color: "bg-emerald-500" },
  { type: "video" as const, label: "Vídeo", icon: Video, color: "bg-red-500" },
  { type: "image" as const, label: "Imagem", icon: Image, color: "bg-pink-500" },
  { type: "file" as const, label: "Arquivo", icon: FileText, color: "bg-purple-500" },
  { type: "interval" as const, label: "Intervalo", icon: Clock, color: "bg-amber-500" },
];

const ACCEPT_MAP: Record<string, string> = {
  audio: "audio/mpeg,audio/mp3,audio/ogg,audio/wav",
  video: "video/mp4,video/webm",
  image: "image/jpeg,image/png,image/webp,image/gif",
  file: "application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

export function BlockContentDialog({
  open,
  onOpenChange,
  initialContents,
  onSave,
  flowId,
  userId,
  organizationId,
}: BlockContentDialogProps) {
  const [contents, setContents] = useState<BlockContentItem[]>(initialContents);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Reset when dialog opens
  const handleOpenChange = (val: boolean) => {
    if (val) setContents(initialContents);
    onOpenChange(val);
  };

  const addContent = (type: BlockContentItem["type"]) => {
    const item: BlockContentItem = { type };
    if (type === "text") item.content = "";
    if (type === "interval") item.delayMs = 2000;
    setContents((prev) => [...prev, item]);
  };

  const updateItem = (idx: number, patch: Partial<BlockContentItem>) => {
    setContents((prev) => prev.map((c, i) => (i === idx ? { ...c, ...patch } : c)));
  };

  const removeItem = (idx: number) => {
    setContents((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveItem = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= contents.length) return;
    setContents((prev) => {
      const arr = [...prev];
      [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
      return arr;
    });
  };

  const handleFileUpload = async (idx: number, file: File, type: string) => {
    if (!organizationId) {
      toast.error("Organização não encontrada");
      return;
    }
    try {
      setUploadingIdx(idx);
      const path = `${organizationId}/${flowId}/${crypto.randomUUID()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("flow-files")
        .upload(path, file);

      if (uploadErr) throw uploadErr;

      const { data: fileData, error: fileErr } = await supabase
        .from("files")
        .insert({
          file_name: file.name,
          mime_type: file.type,
          size_bytes: file.size,
          storage_path: path,
          user_id: userId,
          organization_id: organizationId,
        })
        .select("id")
        .single();

      if (fileErr) throw fileErr;

      updateItem(idx, {
        fileId: fileData.id,
        fileName: file.name,
        mimeType: file.type,
      });
      toast.success(`${file.name} enviado!`);
      if (organizationId) {
        supabase.rpc("recalculate_org_storage", { p_org_id: organizationId }).then(() => {});
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao enviar arquivo");
    } finally {
      setUploadingIdx(null);
    }
  };

  const renderContentItem = (item: BlockContentItem, idx: number) => {
    const typeInfo = CONTENT_TYPES.find((t) => t.type === item.type);
    if (!typeInfo) return null;
    const Icon = typeInfo.icon;

    return (
      <div
        key={idx}
        className="border border-border/60 rounded-lg p-3 space-y-2 bg-card/50"
      >
        {/* Item header */}
        <div className="flex items-center gap-2">
          <div className={`${typeInfo.color} rounded p-1 text-white`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <span className="text-xs font-medium text-foreground">{typeInfo.label}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              onClick={() => moveItem(idx, -1)}
              disabled={idx === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ArrowUp className="h-3 w-3" />
            </button>
            <button
              onClick={() => moveItem(idx, 1)}
              disabled={idx === contents.length - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors"
            >
              <ArrowDown className="h-3 w-3" />
            </button>
            <button
              onClick={() => removeItem(idx)}
              className="p-1 rounded hover:bg-destructive/20 text-destructive transition-colors"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        </div>

        {/* Item content */}
        {item.type === "text" && (
          <Textarea
            placeholder="Digite sua mensagem aqui... Use {{variavel}} para variáveis"
            value={item.content || ""}
            onChange={(e) => updateItem(idx, { content: e.target.value })}
            className="min-h-[60px] text-xs"
          />
        )}

        {item.type === "interval" && (
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">Aguardar</Label>
            <Input
              type="number"
              min={1}
              max={300}
              value={(item.delayMs || 2000) / 1000}
              onChange={(e) =>
                updateItem(idx, { delayMs: Math.max(1, Number(e.target.value)) * 1000 })
              }
              className="w-20 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">segundos</span>
          </div>
        )}

        {(item.type === "audio" || item.type === "video" || item.type === "image" || item.type === "file") && (
          <div>
            {item.fileName ? (
              <div className="flex items-center gap-2 text-xs p-2 bg-muted/50 rounded">
                <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="truncate">{item.fileName}</span>
                <button
                  onClick={() => updateItem(idx, { fileId: undefined, fileName: undefined, mimeType: undefined })}
                  className="ml-auto text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <>
                <input
                  ref={(el) => { fileInputRefs.current[idx] = el; }}
                  type="file"
                  accept={ACCEPT_MAP[item.type] || "*/*"}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(idx, f, item.type);
                  }}
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  disabled={uploadingIdx === idx}
                  onClick={() => fileInputRefs.current[idx]?.click()}
                >
                  {uploadingIdx === idx ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                  ) : (
                    <Upload className="h-3.5 w-3.5 mr-1" />
                  )}
                  Selecionar {typeInfo.label}
                </Button>
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurar Bloco</DialogTitle>
          <DialogDescription>
            Adicione conteúdos sequenciais que serão enviados neste bloco
          </DialogDescription>
        </DialogHeader>

        {/* Content type buttons */}
        <div className="flex flex-wrap gap-2">
          {CONTENT_TYPES.map((ct) => (
            <Button
              key={ct.type}
              variant="outline"
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => addContent(ct.type)}
            >
              <ct.icon className="h-3.5 w-3.5" />
              {ct.label}
            </Button>
          ))}
        </div>

        {/* Content list */}
        <div className="space-y-3 max-h-[400px] overflow-y-auto py-2">
          {contents.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Clique nos botões acima para adicionar conteúdos ao bloco
            </div>
          ) : (
            contents.map((item, idx) => renderContentItem(item, idx))
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={() => {
              onSave(contents);
              onOpenChange(false);
            }}
          >
            Salvar Bloco
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
