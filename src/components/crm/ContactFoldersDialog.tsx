import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Folder, Plus, Trash2, Loader2, Check, X } from "lucide-react";
import {
  useContactFolders,
  useCreateFolder,
  useDeleteFolder,
  useUpdateFolder,
  type ContactFolder,
} from "@/hooks/useContactFolders";

interface ContactFoldersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PRESET_COLORS = [
  "#6366f1", "#22c55e", "#f59e0b", "#ef4444",
  "#3b82f6", "#a855f7", "#14b8a6", "#71717a",
];

export function ContactFoldersDialog({ open, onOpenChange }: ContactFoldersDialogProps) {
  const { data: folders, isLoading } = useContactFolders();
  const createMutation = useCreateFolder();
  const updateMutation = useUpdateFolder();
  const deleteMutation = useDeleteFolder();

  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createMutation.mutateAsync({ name: newName, color: newColor });
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
  };

  const startEdit = (f: ContactFolder) => {
    setEditingId(f.id);
    setEditName(f.name);
    setEditColor(f.color);
  };

  const saveEdit = async () => {
    if (!editingId || !editName.trim()) return;
    await updateMutation.mutateAsync({ id: editingId, name: editName, color: editColor });
    setEditingId(null);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Folder className="h-5 w-5 text-accent" />
            Pastas de contatos
          </DialogTitle>
          <DialogDescription>
            Organize seus contatos em pastas personalizadas (ex: Clientes, Leads frios, VIP).
          </DialogDescription>
        </DialogHeader>

        {/* New folder */}
        <div className="border border-border rounded-lg p-3 space-y-2">
          <Label className="text-xs text-muted-foreground">Nova pasta</Label>
          <div className="flex gap-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nome da pasta"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              className="bg-background"
            />
            <Button onClick={handleCreate} disabled={!newName.trim() || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setNewColor(c)}
                className={`h-6 w-6 rounded-full border-2 transition-transform ${
                  newColor === c ? "border-foreground scale-110" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1">
          {isLoading ? (
            <div className="text-sm text-muted-foreground text-center py-4">Carregando...</div>
          ) : !folders || folders.length === 0 ? (
            <div className="text-sm text-muted-foreground text-center py-6">
              Nenhuma pasta criada ainda.
            </div>
          ) : (
            folders.map((f) => (
              <div
                key={f.id}
                className="flex items-center gap-2 rounded-md border border-border bg-card p-2"
              >
                {editingId === f.id ? (
                  <>
                    <div className="flex gap-1.5 flex-wrap shrink-0">
                      {PRESET_COLORS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          onClick={() => setEditColor(c)}
                          className={`h-5 w-5 rounded-full border-2 ${
                            editColor === c ? "border-foreground" : "border-transparent"
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveEdit()}
                      className="h-8 bg-background"
                      autoFocus
                    />
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={saveEdit}>
                      <Check className="h-4 w-4 text-emerald-500" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingId(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span
                      className="h-3 w-3 rounded-full shrink-0"
                      style={{ backgroundColor: f.color }}
                    />
                    <button
                      onClick={() => startEdit(f)}
                      className="flex-1 text-left text-sm text-foreground hover:underline truncate"
                    >
                      {f.name}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => {
                        if (confirm(`Excluir a pasta "${f.name}"?`)) {
                          deleteMutation.mutate(f.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
