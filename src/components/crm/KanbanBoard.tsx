import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCorners,
} from "@dnd-kit/core";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanCard } from "./KanbanCard";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Loader2, Kanban, Workflow, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useNavigate } from "react-router-dom";
import { ImportContactsWizard } from "./import/ImportContactsWizard";

const DEFAULT_STAGES = [
  { name: "Novo Lead", color: "#71717a", order_index: 0 },
  { name: "Em Progresso", color: "#3b82f6", order_index: 1 },
  { name: "Negociação", color: "#f97316", order_index: 2 },
  { name: "Fechado", color: "#22c55e", order_index: 3 },
  { name: "Perdido", color: "#ef4444", order_index: 4 },
];

interface Stage {
  id: string;
  name: string;
  color: string | null;
  order_index: number;
  pipeline_id: string;
  description: string | null;
}

interface Contact {
  id: string;
  name: string | null;
  phone: string;
  avatar_url: string | null;
  pipeline_stage_id: string | null;
  last_interaction_at: string | null;
  tags: string[] | null;
  channel?: string | null;
  ig_user_scoped_id?: string | null;
  ig_handle?: string | null;
  assigned_to_member_id?: string | null;
  conversations?: {
    last_message_preview: string | null;
  }[];
  team_members?: {
    first_name: string;
    last_name: string;
  } | null;
}

interface KanbanBoardProps {
  pipelineId?: string | null;
  instanceId?: string | null;
}

export function KanbanBoard({ pipelineId: propPipelineId, instanceId }: KanbanBoardProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [showImportWizard, setShowImportWizard] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 200,
        tolerance: 5,
      },
    })
  );

  // Fetch default pipeline or use prop
  const { data: pipeline, isLoading: pipelineLoading } = useQuery({
    queryKey: ["default-pipeline", organization?.id, propPipelineId],
    queryFn: async () => {
      if (!organization?.id) return null;
      
      // If propPipelineId is provided, use it
      if (propPipelineId) {
        const { data, error } = await supabase
          .from("pipelines")
          .select("*")
          .eq("id", propPipelineId)
          .single();
        if (error) throw error;
        return data;
      }
      
      // Otherwise get default
      const { data, error } = await supabase
        .from("pipelines")
        .select("*")
        .eq("organization_id", organization.id)
        .eq("is_default", true)
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!organization?.id,
  });

  // Fetch stages for the pipeline
  const { data: stages, isLoading: stagesLoading } = useQuery({
    queryKey: ["pipeline-stages", pipeline?.id],
    queryFn: async () => {
      if (!pipeline?.id) return [];
      const { data, error } = await supabase
        .from("stages")
        .select("*")
        .eq("pipeline_id", pipeline.id)
        .order("order_index");
      if (error) throw error;
      return data as Stage[];
    },
    enabled: !!pipeline?.id,
  });

  // Fetch contacts
  const { data: contacts, isLoading: contactsLoading } = useQuery({
    queryKey: ["kanban-contacts", organization?.id, instanceId],
    queryFn: async () => {
      if (!organization?.id) return [];
      let query = supabase
        .from("contacts")
        .select(`
          id,
          name,
          phone,
          avatar_url,
          pipeline_stage_id,
          last_interaction_at,
          tags,
          channel,
          ig_user_scoped_id,
          assigned_to_member_id,
          instance_id,
          team_members:assigned_to_member_id(first_name, last_name),
          conversations (
            last_message_preview
          )
        `)
        .eq("organization_id", organization.id)
        .order("last_interaction_at", { ascending: false });
      
      if (instanceId) {
        query = query.eq("instance_id", instanceId);
      }
      
      const { data, error } = await query;
      if (error) throw error;

      // Enrich Instagram contacts with @handle from instagram_leads
      const igScopedIds = (data || [])
        .filter((c) => c.channel === "instagram" && c.ig_user_scoped_id)
        .map((c) => c.ig_user_scoped_id as string);

      let handleMap: Record<string, string> = {};
      if (igScopedIds.length > 0) {
        const { data: leads } = await supabase
          .from("instagram_leads")
          .select("ig_user_scoped_id, ig_handle")
          .in("ig_user_scoped_id", igScopedIds);
        handleMap = (leads || []).reduce((acc, l) => {
          if (l.ig_user_scoped_id && l.ig_handle) acc[l.ig_user_scoped_id] = l.ig_handle;
          return acc;
        }, {} as Record<string, string>);
      }

      return (data || []).map((c) => ({
        ...c,
        ig_handle: c.ig_user_scoped_id ? handleMap[c.ig_user_scoped_id] || null : null,
      })) as Contact[];
    },
    enabled: !!organization?.id,
  });

  // Create default pipeline mutation
  const createPipelineMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("No organization");

      // 1. Create the pipeline
      const { data: newPipeline, error: pipelineError } = await supabase
        .from("pipelines")
        .insert({
          organization_id: organization.id,
          name: "Funil de Vendas",
          is_default: true,
        })
        .select()
        .single();

      if (pipelineError) throw pipelineError;

      // 2. Create default stages
      const stagesToInsert = DEFAULT_STAGES.map((stage) => ({
        pipeline_id: newPipeline.id,
        name: stage.name,
        color: stage.color,
        order_index: stage.order_index,
      }));

      const { error: stagesError } = await supabase
        .from("stages")
        .insert(stagesToInsert);

      if (stagesError) throw stagesError;

      return newPipeline;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["default-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-stages"] });
      toast.success("Funil criado com sucesso!");
    },
    onError: (error) => {
      console.error("Error creating pipeline:", error);
      toast.error("Erro ao criar funil");
    },
  });

  // Update contact stage mutation
  const updateStageMutation = useMutation({
    mutationFn: async ({ contactId, stageId }: { contactId: string; stageId: string | null }) => {
      const { error } = await supabase
        .from("contacts")
        .update({ pipeline_stage_id: stageId })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kanban-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["pipeline-contacts-count"] });
      toast.success("Contato movido com sucesso!");
    },
    onError: () => {
      toast.error("Erro ao mover contato");
    },
  });

  // Group contacts by stage
  const contactsByStage = useMemo(() => {
    if (!contacts || !stages) return {};
    
    const grouped: Record<string, Contact[]> = {};
    
    // Initialize all stages
    stages.forEach((stage) => {
      grouped[stage.id] = [];
    });
    
    // Add "unassigned" for contacts without a stage
    grouped["unassigned"] = [];
    
    // Group contacts
    contacts.forEach((contact) => {
      if (contact.pipeline_stage_id && grouped[contact.pipeline_stage_id]) {
        grouped[contact.pipeline_stage_id].push(contact);
      } else {
        grouped["unassigned"].push(contact);
      }
    });
    
    return grouped;
  }, [contacts, stages]);

  const handleDragStart = (event: DragStartEvent) => {
    const contact = contacts?.find((c) => c.id === event.active.id);
    if (contact) setActiveContact(contact);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveContact(null);

    if (!over) return;

    const contactId = active.id as string;
    const newStageId = over.id === "unassigned" ? null : (over.id as string);

    const contact = contacts?.find((c) => c.id === contactId);
    if (!contact) return;

    // Only update if stage changed
    if (contact.pipeline_stage_id !== newStageId) {
      updateStageMutation.mutate({ contactId, stageId: newStageId });
    }
  };

  const isLoading = pipelineLoading || stagesLoading || contactsLoading;

  if (isLoading) {
    return (
      <div className="p-6 flex gap-4 overflow-x-auto h-full">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex-shrink-0 w-72">
            <Skeleton className="h-10 w-full mb-4 bg-muted" />
            <div className="space-y-3">
              <Skeleton className="h-24 w-full bg-muted" />
              <Skeleton className="h-24 w-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <EmptyState
          variant="card"
          icon={Kanban}
          title="Seu funil está vazio"
          description="Crie um funil de vendas para organizar seus leads em etapas. Importe contatos ou capture leads via fluxos automatizados."
          action={{
            label: createPipelineMutation.isPending ? "Criando..." : "Criar Funil Kanban",
            onClick: () => createPipelineMutation.mutate(),
            icon: createPipelineMutation.isPending ? Loader2 : Plus,
          }}
          secondaryAction={{
            label: "Criar fluxo",
            onClick: () => navigate("/flows"),
            icon: Workflow,
          }}
        />
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="px-3 sm:px-6 pt-3 sm:pt-4 flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowImportWizard(true)}
        >
          <Upload className="h-4 w-4 mr-1" />
          Importar contatos
        </Button>
      </div>
      <div className="p-3 sm:p-6 flex gap-3 sm:gap-4 overflow-x-auto h-full quantum-scrollbar">
        {/* Unassigned column - only show when it has contacts */}
        {(contactsByStage["unassigned"]?.length || 0) > 0 && (
          <KanbanColumn
            id="unassigned"
            title="Não Atribuído"
            color="#71717a"
            contacts={contactsByStage["unassigned"] || []}
            description="Contato ainda não atribuído a nenhuma etapa"
          />
        )}

        {/* Stage columns */}
        {stages?.map((stage) => (
          <KanbanColumn
            key={stage.id}
            id={stage.id}
            title={stage.name}
            color={stage.color || "#10b981"}
            contacts={contactsByStage[stage.id] || []}
            description={stage.description}
          />
        ))}
      </div>

      <DragOverlay>
        {activeContact ? (
          <KanbanCard contact={activeContact} isDragging />
        ) : null}
      </DragOverlay>

      {organization?.id && (
        <ImportContactsWizard
          open={showImportWizard}
          onOpenChange={setShowImportWizard}
          organizationId={organization.id}
        />
      )}
    </DndContext>
  );
}
