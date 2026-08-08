import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Phone, AlertCircle } from "lucide-react";
import { formatPhoneInput, stripPhone, PHONE_PLACEHOLDER } from "@/lib/phoneFormat";

interface NewConversationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationCreated?: (contactId: string) => void;
  initialPhone?: string;
}

export function NewConversationDialog({
  open,
  onOpenChange,
  onConversationCreated,
  initialPhone,
}: NewConversationDialogProps) {
  const { data: organization } = useUserOrganization();
  const queryClient = useQueryClient();
  
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (open) {
      if (initialPhone) {
        setPhone(formatPhoneInput(initialPhone));
      } else {
        setPhone("");
      }
      setPhoneError(null);
    }
  }, [open, initialPhone]);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string>("");
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Fetch available instances
  const { data: instances, isLoading: instancesLoading } = useQuery({
    queryKey: ["crm-instances", organization?.id],
    queryFn: async () => {
      if (!organization?.id) return [];
      const { data, error } = await supabase
        .from("instances_safe" as any)
        .select("id, name, phone_number, status")
        .eq("organization_id", organization.id)
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as Array<{ id: string; name: string; phone_number: string | null; status: string }>;
    },
    enabled: !!organization?.id && open,
  });

  const handlePhoneChange = (value: string) => {
    const formatted = formatPhoneInput(value);
    setPhone(formatted);
    
    const digits = stripPhone(value);
    if (digits.length >= 12) {
      // Full number with DDI: 55 + 2 DDD + 8-9 phone = 12-13 digits
      setPhoneError(null);
    } else if (digits.length >= 4) {
      setPhoneError(null); // Don't show error while typing
    } else {
      setPhoneError(null);
    }
  };

  const validatePhone = (value: string): string | null => {
    const digits = stripPhone(value);
    if (digits.length < 12) {
      return "Número deve incluir DDI+DDD+Telefone (mín. 12 dígitos)";
    }
    if (digits.length > 13) {
      return "Número não pode ter mais de 13 dígitos";
    }
    return null;
  };

  // Create conversation mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!organization?.id) throw new Error("No organization");
      
      const fullPhone = stripPhone(phone);
      
      // Check if contact already exists FOR THIS INSTANCE
      const { data: existingContact } = await supabase
        .from("contacts")
        .select("id")
        .eq("organization_id", organization.id)
        .eq("phone", fullPhone)
        .eq("instance_id", selectedInstanceId)
        .maybeSingle();
      
      let contactId: string;
      
      if (existingContact) {
        contactId = existingContact.id;
      } else {
        const { data: newContact, error: contactError } = await supabase
          .from("contacts")
          .insert({
            organization_id: organization.id,
            phone: fullPhone,
            instance_id: selectedInstanceId || null,
          })
          .select("id")
          .single();
        
        if (contactError) throw contactError;
        contactId = newContact.id;
        
        // Assign default pipeline stage
        const { data: pipeline } = await supabase
          .from("pipelines")
          .select("id")
          .eq("organization_id", organization.id)
          .eq("is_default", true)
          .maybeSingle();
        
        if (pipeline) {
          const { data: stage } = await supabase
            .from("stages")
            .select("id")
            .eq("pipeline_id", pipeline.id)
            .order("order_index")
            .limit(1)
            .maybeSingle();
          
          if (stage) {
            await supabase
              .from("contacts")
              .update({ pipeline_stage_id: stage.id })
              .eq("id", contactId);
          }
        }
      }
      
      // Check if conversation exists for this contact+instance
      const { data: existingConv } = await supabase
        .from("conversations")
        .select("id")
        .eq("contact_id", contactId)
        .eq("instance_id", selectedInstanceId)
        .maybeSingle();
      
      if (!existingConv) {
        await supabase
          .from("conversations")
          .insert({
            contact_id: contactId,
            instance_id: selectedInstanceId,
            status: "active",
            organization_id: organization!.id,
          });
      }
      
      return contactId;
    },
    onSuccess: (contactId) => {
      queryClient.invalidateQueries({ queryKey: ["crm-conversations"] });
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
      toast.success("Conversa criada com sucesso!");
      onOpenChange(false);
      onConversationCreated?.(contactId);
      setPhone("");
      setSelectedInstanceId("");
      setPhoneError(null);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar conversa");
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const error = validatePhone(phone);
    if (error) {
      setPhoneError(error);
      return;
    }
    
    if (!selectedInstanceId) {
      toast.error("Selecione uma instância");
      return;
    }
    
    createMutation.mutate();
  };

  const handleClose = () => {
    onOpenChange(false);
    setPhone("");
    setSelectedInstanceId("");
    setPhoneError(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Nova Conversa</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Inicie uma nova conversa com um contato do WhatsApp
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">
              Telefone
            </Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="phone"
                placeholder={PHONE_PLACEHOLDER}
                value={phone}
                onChange={(e) => handlePhoneChange(e.target.value)}
                className="pl-9 bg-muted border-border text-foreground"
                maxLength={20}
              />
            </div>
            {phoneError && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="h-3 w-3" />
                <span>{phoneError}</span>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Digite DDI + DDD + Número (ex: 5511999999999)
            </p>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="instance" className="text-foreground">
              Instância
            </Label>
            <Select
              value={selectedInstanceId}
              onValueChange={setSelectedInstanceId}
            >
              <SelectTrigger className="bg-muted border-border text-foreground">
                <SelectValue placeholder="Selecione a instância" />
              </SelectTrigger>
              <SelectContent className="bg-card border-border z-[200]">
                {instancesLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : instances?.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma instância configurada
                  </div>
                ) : (
                  instances?.map((instance) => (
                    <SelectItem key={instance.id} value={instance.id}>
                      <div className="flex items-center gap-2">
                        <span>{instance.name}</span>
                        {instance.phone_number && (
                          <span className="text-xs text-muted-foreground">
                            (+{instance.phone_number.substring(0, 4)}...)
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Número pelo qual a mensagem será enviada
            </p>
          </div>
          
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              className="border-border text-muted-foreground hover:bg-muted"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={!phone || !selectedInstanceId || !!phoneError || createMutation.isPending}
              className="gradient-primary text-white hover:opacity-90"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Criando...
                </>
              ) : (
                "Criar Conversa"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
