import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { TutorialHero } from "@/components/tutorials/TutorialHero";
import { TutorialCarousel } from "@/components/tutorials/TutorialCarousel";
import { TutorialPlayerDialog } from "@/components/tutorials/TutorialPlayerDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Search, GraduationCap, Loader2 } from "lucide-react";
import { TutorialCard } from "@/components/tutorials/TutorialCard";
import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";

const ALL_MODULES = "__all__";

export default function Tutorials() {
  const [search, setSearch] = useState("");
  const [selectedTutorial, setSelectedTutorial] = useState<any | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeModule, setActiveModule] = useState<string>(searchParams.get("module") || ALL_MODULES);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const { user } = useAuth();
  const { data: isAdminMaster = false } = useQuery({
    queryKey: ["is-admin-master", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin_master" as any });
      return !!data;
    },
    enabled: !!user?.id,
  });
  // Cmd/Ctrl+K to open command palette
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const { data: categories = [] } = useQuery({
    queryKey: ["tutorial-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tutorial_categories")
        .select("*")
        .eq("is_active", true)
        .order("order_index");
      if (error) throw error;
      return data;
    },
  });

  const { data: tutorials = [], isLoading } = useQuery({
    queryKey: ["tutorials", isAdminMaster],
    queryFn: async () => {
      let q = supabase.from("tutorials").select("*").order("order_index");
      // Admin vê todos (publicados ou não); usuários só veem publicados
      if (!isAdminMaster) q = q.eq("is_published", true);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  // Filtrar por módulo selecionado
  const moduleFiltered = useMemo(() => {
    if (activeModule === ALL_MODULES) return tutorials;
    return tutorials.filter((t: any) => t.module_slug === activeModule);
  }, [tutorials, activeModule]);

  // Search-filtered tutorials (operates on moduleFiltered)
  const filtered = useMemo(() => {
    if (!search) return null;
    const lower = search.toLowerCase();
    return moduleFiltered.filter(
      (t: any) =>
        t.title.toLowerCase().includes(lower) ||
        t.description?.toLowerCase().includes(lower) ||
        (t.tags || []).some((tag: string) => tag.toLowerCase().includes(lower))
    );
  }, [moduleFiltered, search]);

  // Group tutorials by category for carousel view
  const grouped = useMemo(() => {
    return categories
      .map((cat: any) => ({
        ...cat,
        tutorials: moduleFiltered.filter((t: any) => t.category_id === cat.id),
      }))
      .filter((g: any) => g.tutorials.length > 0);
  }, [categories, moduleFiltered]);

  const allTutorials = moduleFiltered;
  const heroTutorial = moduleFiltered.find((t: any) => t.is_published) || moduleFiltered[0];

  const selectedIdx = selectedTutorial
    ? allTutorials.findIndex((t: any) => t.id === selectedTutorial.id)
    : -1;

  const handleModuleChange = (slug: string) => {
    setActiveModule(slug);
    if (slug === ALL_MODULES) {
      searchParams.delete("module");
    } else {
      searchParams.set("module", slug);
    }
    setSearchParams(searchParams, { replace: true });
  };

  return (
    <AppLayout>
      <div className="space-y-6 sm:space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-primary/10">
              <GraduationCap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-lg sm:text-2xl font-bold text-foreground">Tutoriais</h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Aprenda a usar todas as funcionalidades — pressione{" "}
                <kbd className="px-1.5 py-0.5 text-xs rounded border border-border bg-muted font-mono">
                  Ctrl+K
                </kbd>{" "}
                para busca rápida
              </p>
            </div>
          </div>
          <div className="relative w-full sm:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar tutorial..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        {/* Filtro por módulo (chips) */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={activeModule === ALL_MODULES ? "default" : "outline"}
              onClick={() => handleModuleChange(ALL_MODULES)}
              className={cn(activeModule === ALL_MODULES && "gradient-primary")}
            >
              Todos
            </Button>
            {categories.map((cat: any) => (
              <Button
                key={cat.id}
                size="sm"
                variant={activeModule === cat.slug ? "default" : "outline"}
                onClick={() => handleModuleChange(cat.slug)}
                className={cn(activeModule === cat.slug && "gradient-primary")}
              >
                {cat.name}
              </Button>
            ))}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : filtered !== null ? (
          /* Search results grid */
          filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <GraduationCap className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nenhum tutorial encontrado</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((t: any) => (
                <div key={t.id} className="relative">
                  <TutorialCard
                    title={t.title}
                    description={t.description}
                    youtubeVideoId={t.youtube_video_id}
                    thumbnailUrl={t.thumbnail_url}
                    durationSeconds={t.duration_seconds}
                    onClick={() => setSelectedTutorial(t)}
                  />
                  {!t.is_published && (
                    <Badge variant="outline" className="absolute top-2 right-2 bg-background/80 backdrop-blur text-xs">
                      Em produção
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          )
        ) : moduleFiltered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <GraduationCap className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground">Nenhum tutorial publicado neste módulo ainda</p>
          </div>
        ) : (
          /* Netflix layout: Hero + Carousels */
          <>
            {heroTutorial && activeModule === ALL_MODULES && (
              <TutorialHero
                title={heroTutorial.title}
                description={heroTutorial.description}
                youtubeVideoId={heroTutorial.youtube_video_id}
                thumbnailUrl={heroTutorial.thumbnail_url}
                onClick={() => setSelectedTutorial(heroTutorial)}
              />
            )}

            {grouped.map((group: any) => (
              <TutorialCarousel
                key={group.id}
                title={group.name}
                tutorials={group.tutorials}
                onSelect={(t: any) => setSelectedTutorial(t)}
              />
            ))}
          </>
        )}

        {/* Player dialog */}
        <TutorialPlayerDialog
          tutorial={selectedTutorial}
          open={selectedTutorial !== null}
          onOpenChange={(open) => !open && setSelectedTutorial(null)}
          hasPrev={selectedIdx > 0}
          hasNext={selectedIdx >= 0 && selectedIdx < allTutorials.length - 1}
          onPrev={() =>
            selectedIdx > 0 && setSelectedTutorial(allTutorials[selectedIdx - 1])
          }
          onNext={() =>
            selectedIdx < allTutorials.length - 1 &&
            setSelectedTutorial(allTutorials[selectedIdx + 1])
          }
        />

        {/* Command palette (Ctrl+K) */}
        <CommandDialog open={cmdkOpen} onOpenChange={setCmdkOpen}>
          <CommandInput placeholder="Buscar tutorial por título ou tag..." />
          <CommandList>
            <CommandEmpty>Nenhum resultado.</CommandEmpty>
            {categories.map((cat: any) => {
              const items = tutorials.filter((t: any) => t.category_id === cat.id);
              if (items.length === 0) return null;
              return (
                <CommandGroup key={cat.id} heading={cat.name}>
                  {items.map((t: any) => (
                    <CommandItem
                      key={t.id}
                      value={`${t.title} ${(t.tags || []).join(" ")}`}
                      onSelect={() => {
                        setSelectedTutorial(t);
                        setCmdkOpen(false);
                      }}
                    >
                      <GraduationCap className="mr-2 h-4 w-4" />
                      <span>{t.title}</span>
                      {!t.is_published && (
                        <Badge variant="outline" className="ml-auto text-xs">
                          Em produção
                        </Badge>
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              );
            })}
          </CommandList>
        </CommandDialog>
      </div>
    </AppLayout>
  );
}
