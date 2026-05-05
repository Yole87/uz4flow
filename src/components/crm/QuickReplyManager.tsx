import { useState, useRef, useMemo } from "react";
import {
  useQuickReplies,
  useSelectableInstances,
  type QuickReply,
  type QuickReplyMediaType,
  QUICK_REPLY_LIMITS,
} from "@/hooks/useQuickReplies";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Zap,
  Plus,
  Pencil,
  Trash2,
  MessageSquareText,
  Mic,
  Image as ImageIcon,
  Video,
  FileText,
  Upload,
  Globe,
  Filter,
} from "lucide-react";
import { toast } from "sonner";

const MEDIA_TABS: { type: QuickReplyMediaType; label: string; icon: typeof Zap; accept: string }[] = [
  { type: "text", label: "Texto", icon: MessageSquareText, accept: "" },
  { type: "audio", label: "Áudio", icon: Mic, accept: "audio/*" },
  { type: "image", label: "Imagem", icon: ImageIcon, accept: "image/*" },
  { type: "video", label: "Vídeo", icon: Video, accept: "video/*" },
  { type: "document", label: "Documento", icon: FileText, accept: ".pdf,.docx,.xlsx,.pptx,.txt" },
];

export function QuickReplyManager() {
  const [filterInstance, setFilterInstance] = useState<string>("all");
  const { quickReplies, allQuickReplies, isLoading, create, update, remove, isCreating, isUpdating, isDeleting } =
    useQuickReplies(filterInstance === "all" ? null : filterInstance);
  const { data: instances = [] } = useSelectableInstances();

  const [activeTab, setActiveTab] = useState<QuickReplyMediaType>("text");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<QuickReply | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<QuickReply | null>(null);

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [appliesToAll, setAppliesToAll] = useState(true);
  const [selectedInstanceIds, setSelectedInstanceIds] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const tabConfig = MEDIA_TABS.find((t) => t.type === activeTab)!;
  const filtered = quickReplies.filter((qr) => qr.media_type === activeTab);
  // Limit is global per type for the org (uses ALL replies, not the filtered view)
  const limit = QUICK_REPLY_LIMITS[activeTab];
  const totalForType = allQuickReplies.filter((qr) => qr.media_type === activeTab).length;
  const isAtLimit = totalForType >= limit;

  const instanceNameById = useMemo(() => {
    const m = new Map<string, string>();
    instances.forEach((i) => m.set(i.id, i.name));
    return m;
  }, [instances]);

  const resetForm = () => {
    setTitle("");
    setContent("");
    setCategory("");
    setFile(null);
    setAppliesToAll(true);
    setSelectedInstanceIds([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const openCreate = () => {
    if (isAtLimit) {
      toast.error(`Limite de ${limit} respostas do tipo ${tabConfig.label} atingido.`);
      return;
    }
    setEditing(null);
    resetForm();
    // Pre-select current filter if any
    if (filterInstance !== "all") {
      setAppliesToAll(false);
      setSelectedInstanceIds([filterInstance]);
    }
    setDialogOpen(true);
  };

  const openEdit = (qr: QuickReply) => {
    setEditing(qr);
    setTitle(qr.title);
    setContent(qr.content || "");
    setCategory(qr.category || "");
    setFile(null);
    setAppliesToAll(qr.applies_to_all_instances);
    setSelectedInstanceIds(qr.instance_ids || []);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!title.trim()) return;
    if (!appliesToAll && selectedInstanceIds.length === 0) {
      toast.error("Selecione ao menos uma instância ou marque 'Todas'");
      return;
    }

    if (editing) {
      await update({
        id: editing.id,
        title: title.trim(),
        content: activeTab === "text" ? content.trim() : editing.content || "",
        category: category.trim() || undefined,
        applies_to_all_instances: appliesToAll,
        instance_ids: selectedInstanceIds,
      });
    } else {
      if (activeTab === "text" && !content.trim()) {
        toast.error("Conteúdo obrigatório");
        return;
      }
      if (activeTab !== "text" && !file) {
        toast.error("Anexe um arquivo");
        return;
      }
      await create({
        title: title.trim(),
        content: activeTab === "text" ? content.trim() : undefined,
        category: category.trim() || undefined,
        media_type: activeTab,
        file: file || undefined,
        applies_to_all_instances: appliesToAll,
        instance_ids: selectedInstanceIds,
      });
    }
    setDialogOpen(false);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await remove(deleteTarget);
    setDeleteTarget(null);
  };

  const isSaving = isCreating || isUpdating;

  const toggleInstanceSelection = (id: string) => {
    setSelectedInstanceIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <>
      <Card className="quantum-glass border-border/50">
        <CardHeader>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-accent" />
              <CardTitle className="text-foreground text-base">Respostas Rápidas</CardTitle>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Instance filter */}
              <div className="flex items-center gap-1.5">
                <Filter className="h-3.5 w-3.5 text-muted-foreground" />
                <Select value={filterInstance} onValueChange={setFilterInstance}>
                  <SelectTrigger className="h-8 text-xs w-[180px]">
                    <SelectValue placeholder="Instância" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as instâncias</SelectItem>
                    {instances.map((inst) => (
                      <SelectItem key={inst.id} value={inst.id}>
                        {inst.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" onClick={openCreate} disabled={isAtLimit}>
                <Plus className="h-4 w-4 mr-1" />
                Nova
              </Button>
            </div>
          </div>
          <CardDescription className="text-muted-foreground">
            Mensagens e mídias prontas para envio rápido. Digite{" "}
            <kbd className="px-1.5 py-0.5 text-xs rounded bg-muted border border-border font-mono">/</kbd>{" "}
            no chat para abrir o seletor.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-hidden">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as QuickReplyMediaType)}>
            <TabsList className="grid grid-cols-5 w-full gap-1 p-1 h-auto relative isolate">
              {MEDIA_TABS.map((t) => {
                const Icon = t.icon;
                const count = allQuickReplies.filter((qr) => qr.media_type === t.type).length;
                return (
                  <TabsTrigger
                    key={t.type}
                    value={t.type}
                    className="flex flex-col items-center justify-center gap-1 min-h-[56px] py-2 px-1 text-xs data-[state=active]:z-10"
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline leading-none">{t.label}</span>
                    <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 leading-none mt-0.5">
                      {count}/{QUICK_REPLY_LIMITS[t.type]}
                    </Badge>
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {MEDIA_TABS.map((t) => (
              <TabsContent key={t.type} value={t.type} className="mt-6 relative z-0">
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-12 w-full bg-muted" />
                    <Skeleton className="h-12 w-full bg-muted" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 py-8 text-muted-foreground">
                    <t.icon className="h-8 w-8" />
                    <p className="text-sm">
                      {filterInstance !== "all"
                        ? `Nenhuma resposta ${t.label} aplicável a esta instância`
                        : `Nenhuma resposta rápida do tipo ${t.label}`}
                    </p>
                    <Button variant="outline" size="sm" onClick={openCreate}>
                      <Plus className="h-4 w-4 mr-1" />
                      Criar primeira
                    </Button>
                  </div>
                ) : (
                  <div className="rounded-lg border border-border divide-y divide-border">
                    {filtered.map((qr) => (
                      <div key={qr.id} className="flex items-start justify-between gap-3 p-3 min-w-0">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-medium text-foreground truncate">{qr.title}</span>
                            {qr.category && (
                              <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                                {qr.category}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {qr.applies_to_all_instances ? (
                              <Badge variant="outline" className="text-[9px] gap-1 h-4 px-1.5">
                                <Globe className="h-2.5 w-2.5" />
                                Todas
                              </Badge>
                            ) : (
                              <>
                                {qr.instance_ids.slice(0, 3).map((id) => (
                                  <Badge
                                    key={id}
                                    variant="secondary"
                                    className="text-[9px] h-4 px-1.5 max-w-[140px] truncate"
                                  >
                                    {instanceNameById.get(id) || "?"}
                                  </Badge>
                                ))}
                                {qr.instance_ids.length > 3 && (
                                  <Badge variant="secondary" className="text-[9px] h-4 px-1.5">
                                    +{qr.instance_ids.length - 3}
                                  </Badge>
                                )}
                              </>
                            )}
                          </div>
                          {qr.media_type === "text" ? (
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {qr.content}
                            </p>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1 truncate">
                              📎 {qr.file_name}{" "}
                              {qr.file_size && `• ${(qr.file_size / 1024).toFixed(0)} KB`}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(qr)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(qr)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-xl w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto overflow-x-hidden quantum-scrollbar">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar" : "Nova"} Resposta Rápida — {tabConfig.label}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="qr-title">Título / Atalho</Label>
              <Input
                id="qr-title"
                placeholder="Ex: saudação, preço, demo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            {activeTab === "text" ? (
              <div className="space-y-2">
                <Label htmlFor="qr-content">Conteúdo da mensagem</Label>
                <Textarea
                  id="qr-content"
                  placeholder="Ex: Olá! Como posso ajudar?"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                />
              </div>
            ) : !editing ? (
              <div className="space-y-2">
                <Label>Arquivo ({tabConfig.label})</Label>
                <div className="flex items-center gap-2 w-full min-w-0">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full min-w-0 justify-start"
                  >
                    <Upload className="h-4 w-4 mr-2 shrink-0" />
                    <span className="truncate block min-w-0 flex-1 text-left">
                      {file ? file.name : `Selecionar ${tabConfig.label.toLowerCase()}`}
                    </span>
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept={tabConfig.accept}
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > 16 * 1024 * 1024) {
                        toast.error("Arquivo excede 16MB");
                        return;
                      }
                      setFile(f);
                    }}
                  />
                </div>
                {file && (
                  <p className="text-xs text-muted-foreground truncate">
                    {(file.size / 1024).toFixed(0)} KB · {file.type || "desconhecido"}
                  </p>
                )}
              </div>
            ) : (
              <div className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                📎 {editing.file_name} ·{" "}
                {editing.file_size && `${(editing.file_size / 1024).toFixed(0)} KB`}
                <p className="mt-1 italic">Para alterar o arquivo, exclua e crie uma nova.</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="qr-category">Categoria (opcional)</Label>
              <Input
                id="qr-category"
                placeholder="Ex: vendas, suporte"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
            </div>

            {/* Instance scope */}
            <div className="space-y-3 rounded-lg border border-border p-3 bg-muted/30">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="applies-all" className="flex items-center gap-2 cursor-pointer">
                  <Globe className="h-4 w-4 text-accent" />
                  <span className="text-sm font-medium">Aplicar a todas as instâncias</span>
                </Label>
                <Switch
                  id="applies-all"
                  checked={appliesToAll}
                  onCheckedChange={setAppliesToAll}
                />
              </div>
              {!appliesToAll && (
                <div className="space-y-2 pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Selecione as instâncias onde esta resposta estará disponível:
                  </p>
                  {instances.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic">
                      Nenhuma instância cadastrada ainda.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto quantum-scrollbar pr-1">
                      {instances.map((inst) => (
                        <label
                          key={inst.id}
                          className="flex items-center gap-2 p-1.5 rounded hover:bg-muted cursor-pointer min-w-0"
                        >
                          <Checkbox
                            checked={selectedInstanceIds.includes(inst.id)}
                            onCheckedChange={() => toggleInstanceSelection(inst.id)}
                          />
                          <span className="text-sm flex-1 min-w-0 truncate">{inst.name}</span>
                          <Badge variant="outline" className="text-[9px] h-4 shrink-0">
                            {inst.provider === "instagram_dm" ? "Instagram" : inst.provider === "meta_official" ? "Meta" : "QR"}
                          </Badge>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="sticky bottom-0 bg-background pt-3 mt-2 border-t border-border">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={!title.trim() || isSaving}>
              {isSaving ? "Salvando..." : editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir resposta rápida?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A resposta será removida para toda a equipe
              {deleteTarget?.media_type !== "text" && " e o arquivo será apagado do armazenamento"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
