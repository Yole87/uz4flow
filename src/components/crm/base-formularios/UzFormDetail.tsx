import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import type { UzForm } from "@/types/uzForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Table, Settings2, Loader2, FileText } from "lucide-react";
import { UzFormEditor } from "./UzFormEditor";
import { UzFormResponses } from "./UzFormResponses";

interface UzFormDetailProps {
  formId?: string;
  onBack?: () => void;
}

export function UzFormDetail({ formId: propFormId, onBack }: UzFormDetailProps) {
  const { formId: paramFormId } = useParams<{ formId: string }>();
  const navigate = useNavigate();
  const formId = propFormId || paramFormId;

  const handleBack = onBack || (() => navigate("/base-formularios"));

  const { data: form, isLoading, error } = useQuery({
    queryKey: ["uz-form", formId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uz_forms" as any)
        .select("*")
        .eq("id", formId)
        .single();
      if (error) throw error;
      return data as unknown as UzForm;
    },
    enabled: !!formId,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-accent" />
      </div>
    );
  }

  if (error || !form) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-4">
        <FileText className="h-10 w-10 text-muted-foreground" />
        <p className="text-muted-foreground">Formulário não encontrado</p>
        <Button variant="outline" onClick={handleBack} className="border-border">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back + title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleBack}
          className="h-8 w-8 text-muted-foreground hover:text-foreground"
          aria-label="Voltar para lista de formulários"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-xl font-semibold text-foreground">{form.name}</h2>
          <p className={`text-xs ${form.is_active ? "text-success font-medium" : "text-destructive"}`}>
            {form.is_active ? "● Ativo" : "○ Inativo"}
          </p>
        </div>
      </div>

      <Tabs defaultValue="responses" className="space-y-4">
        <TabsList className="bg-background border border-border/50">
          <TabsTrigger value="responses" className="gap-2">
            <Table className="h-4 w-4" />
            Respostas
          </TabsTrigger>
          <TabsTrigger value="editor" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Editor
          </TabsTrigger>
        </TabsList>

        <TabsContent value="responses">
          <UzFormResponses formId={form.id} formName={form.name} />
        </TabsContent>

        <TabsContent value="editor">
          <UzFormEditor form={form} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
