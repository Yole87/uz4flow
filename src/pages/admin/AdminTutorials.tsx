import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, GraduationCap, FolderOpen, Loader2 } from "lucide-react";
import { extractYouTubeId, getYouTubeThumbnail, formatDuration } from "@/lib/youtube";
import { TutorialCoverageCard } from "@/components/admin/TutorialCoverageCard";
import { ACTIONS } from "@/lib/copy";

// ---- Types
interface CategoryForm {
  name: string;
  description: string;
  order_index: number;
  is_active: boolean;
}
interface TutorialForm {
  title: string;
  description: string;
  youtube_url: string;
  category_id: string;
  duration_seconds: number;
  order_index: number;
  is_published: boolean;
}

const emptyCat: CategoryForm = { name: "", description: "", order_index: 0, is_active: true };
const emptyTut: TutorialForm = { title: "", description: "", youtube_url: "", category_id: "", duration_seconds: 0, order_index: 0, is_published: false };

export default function AdminTutorials() {
  const qc = useQueryClient();
  const [catDialog, setCatDialog] = useState(false);
  const [tutDialog, setTutDialog] = useState(false);
  const [editCatId, setEditCatId] = useState<string | null>(null);
  const [editTutId, setEditTutId] = useState<string | null>(null);
  const [catForm, setCatForm] = useState<CategoryForm>(emptyCat);
  const [tutForm, setTutForm] = useState<TutorialForm>(emptyTut);

  // ---- Queries
  const { data: categories = [], isLoading: catsLoading } = useQuery({
    queryKey: ["admin-tutorial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tutorial_categories").select("*").order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: tutorials = [], isLoading: tutsLoading } = useQuery({
    queryKey: ["admin-tutorials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tutorials").select("*").order("order_index");
      if (error) throw error;
      return data;
    },
  });

  // ---- Category mutations
  const saveCat = useMutation({
    mutationFn: async (form: CategoryForm) => {
      if (editCatId) {
        const { error } = await supabase.from("tutorial_categories").update(form).eq("id", editCatId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tutorial_categories").insert(form);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tutorial-categories"] });
      toast.success(editCatId ? "Categoria atualizada" : "Categoria criada");
      setCatDialog(false);
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  const deleteCat = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutorial_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tutorial-categories"] });
      toast.success("Categoria removida");
    },
    onError: () => toast.error("Erro ao remover categoria"),
  });

  // ---- Tutorial mutations
  const saveTut = useMutation({
    mutationFn: async (form: TutorialForm) => {
      const videoId = extractYouTubeId(form.youtube_url);
      if (!videoId) throw new Error("URL do YouTube inválida");
      const payload = {
        title: form.title,
        description: form.description || null,
        youtube_video_id: videoId,
        thumbnail_url: getYouTubeThumbnail(videoId),
        category_id: form.category_id || null,
        duration_seconds: form.duration_seconds,
        order_index: form.order_index,
        is_published: form.is_published,
      };
      if (editTutId) {
        const { error } = await supabase.from("tutorials").update(payload).eq("id", editTutId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("tutorials").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tutorials"] });
      toast.success(editTutId ? "Tutorial atualizado" : "Tutorial criado");
      setTutDialog(false);
    },
    onError: () => toast.error("Erro ao salvar tutorial"),
  });

  const deleteTut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tutorials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-tutorials"] });
      toast.success("Tutorial removido");
    },
    onError: () => toast.error("Erro ao remover tutorial"),
  });

  // ---- Helpers
  const openEditCat = (cat: typeof categories[0]) => {
    setEditCatId(cat.id);
    setCatForm({ name: cat.name, description: cat.description || "", order_index: cat.order_index, is_active: cat.is_active });
    setCatDialog(true);
  };
  const openNewCat = () => { setEditCatId(null); setCatForm(emptyCat); setCatDialog(true); };

  const openEditTut = (t: typeof tutorials[0]) => {
    setEditTutId(t.id);
    setTutForm({
      title: t.title,
      description: t.description || "",
      youtube_url: `https://youtube.com/watch?v=${t.youtube_video_id}`,
      category_id: t.category_id || "",
      duration_seconds: t.duration_seconds || 0,
      order_index: t.order_index,
      is_published: t.is_published,
    });
    setTutDialog(true);
  };
  const openNewTut = () => { setEditTutId(null); setTutForm(emptyTut); setTutDialog(true); };

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name || "—";

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <GraduationCap className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Tutoriais</h1>
        </div>

        <Tabs defaultValue="tutorials">
          <TabsList>
            <TabsTrigger value="tutorials">Tutoriais</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
            <TabsTrigger value="coverage">Cobertura por menu</TabsTrigger>
          </TabsList>

          {/* ---- TUTORIALS TAB ---- */}
          <TabsContent value="tutorials" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={openNewTut}><Plus className="h-4 w-4 mr-2" />Novo Tutorial</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {tutsLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Título</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Duração</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-24">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {tutorials.map((t) => (
                          <TableRow key={t.id}>
                            <TableCell className="text-muted-foreground">{t.order_index}</TableCell>
                            <TableCell className="font-medium">{t.title}</TableCell>
                            <TableCell>{catName(t.category_id)}</TableCell>
                            <TableCell>{t.duration_seconds ? formatDuration(t.duration_seconds) : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={t.is_published ? "default" : "secondary"}>
                                {t.is_published ? "Publicado" : "Rascunho"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditTut(t)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteTut.mutate(t.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {tutorials.length === 0 && (
                          <TableRow><TableCell colSpan={6} className="text-center py-10 text-muted-foreground">Nenhum tutorial cadastrado</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- CATEGORIES TAB ---- */}
          <TabsContent value="categories" className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={openNewCat}><Plus className="h-4 w-4 mr-2" />Nova Categoria</Button>
            </div>
            <Card>
              <CardContent className="p-0">
                {catsLoading ? (
                  <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead className="w-24">Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {categories.map((c) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-muted-foreground">{c.order_index}</TableCell>
                            <TableCell className="font-medium">{c.name}</TableCell>
                            <TableCell className="text-muted-foreground">{c.description || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={c.is_active ? "default" : "secondary"}>
                                {c.is_active ? "Ativa" : "Inativa"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEditCat(c)}><Pencil className="h-4 w-4" /></Button>
                                <Button variant="ghost" size="icon" onClick={() => deleteCat.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                        {categories.length === 0 && (
                          <TableRow><TableCell colSpan={5} className="text-center py-10 text-muted-foreground">Nenhuma categoria cadastrada</TableCell></TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ---- COVERAGE TAB ---- */}
          <TabsContent value="coverage" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Cruza os menus reais da plataforma com as categorias de tutorial publicadas.
              Use isso para identificar onde ainda faltam vídeos para os usuários.
            </p>
            <TutorialCoverageCard categories={categories} tutorials={tutorials} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ---- CATEGORY DIALOG ---- */}
      <Dialog open={catDialog} onOpenChange={setCatDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editCatId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Nome</Label><Input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={catForm.description} onChange={(e) => setCatForm({ ...catForm, description: e.target.value })} /></div>
            <div><Label>Ordem</Label><Input type="number" value={catForm.order_index} onChange={(e) => setCatForm({ ...catForm, order_index: Number(e.target.value) })} /></div>
            <div className="flex items-center gap-2"><Switch checked={catForm.is_active} onCheckedChange={(v) => setCatForm({ ...catForm, is_active: v })} /><Label>Ativa</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatDialog(false)}>{ACTIONS.cancel}</Button>
            <Button onClick={() => saveCat.mutate(catForm)} disabled={!catForm.name || saveCat.isPending}>
              {saveCat.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{ACTIONS.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---- TUTORIAL DIALOG ---- */}
      <Dialog open={tutDialog} onOpenChange={setTutDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editTutId ? "Editar Tutorial" : "Novo Tutorial"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div><Label>Título</Label><Input value={tutForm.title} onChange={(e) => setTutForm({ ...tutForm, title: e.target.value })} /></div>
            <div><Label>Descrição</Label><Textarea value={tutForm.description} onChange={(e) => setTutForm({ ...tutForm, description: e.target.value })} /></div>
            <div><Label>URL do YouTube</Label><Input placeholder="https://youtube.com/watch?v=..." value={tutForm.youtube_url} onChange={(e) => setTutForm({ ...tutForm, youtube_url: e.target.value })} /></div>
            <div>
              <Label>Categoria</Label>
              <Select value={tutForm.category_id} onValueChange={(v) => setTutForm({ ...tutForm, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div><Label>Duração (segundos)</Label><Input type="number" value={tutForm.duration_seconds} onChange={(e) => setTutForm({ ...tutForm, duration_seconds: Number(e.target.value) })} /></div>
              <div><Label>Ordem</Label><Input type="number" value={tutForm.order_index} onChange={(e) => setTutForm({ ...tutForm, order_index: Number(e.target.value) })} /></div>
            </div>
            <div className="flex items-center gap-2"><Switch checked={tutForm.is_published} onCheckedChange={(v) => setTutForm({ ...tutForm, is_published: v })} /><Label>Publicado</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTutDialog(false)}>{ACTIONS.cancel}</Button>
            <Button onClick={() => saveTut.mutate(tutForm)} disabled={!tutForm.title || !tutForm.youtube_url || saveTut.isPending}>
              {saveTut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{ACTIONS.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
