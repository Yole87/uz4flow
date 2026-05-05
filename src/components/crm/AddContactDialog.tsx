import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUserOrganization } from "@/hooks/useUserOrganization";
import {
  Dialog,
  DialogContent,
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
import { Plus, Loader2 } from "lucide-react";
import { formatPhoneInput, PHONE_PLACEHOLDER } from "@/lib/phoneFormat";

const addContactSchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório").max(100),
  email: z
    .string()
    .trim()
    .email("Email inválido")
    .max(255)
    .optional()
    .or(z.literal("")),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  instance_id: z.string().min(1, "Selecione uma instância"),
});

type AddContactForm = z.infer<typeof addContactSchema>;

interface AddContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddContactDialog({ open, onOpenChange }: AddContactDialogProps) {
  const queryClient = useQueryClient();
  const { data: organization } = useUserOrganization();

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<AddContactForm>({
    resolver: zodResolver(addContactSchema),
    defaultValues: { name: "", email: "", phone: "", instance_id: "" },
  });

  // Fetch instances
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

  const mutation = useMutation({
    mutationFn: async (values: AddContactForm) => {
      if (!organization?.id) throw new Error("Organização não encontrada");
      const { error } = await supabase.from("contacts").insert({
        name: values.name,
        email: values.email || null,
        phone: values.phone || "",
        organization_id: organization.id,
        instance_id: values.instance_id,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("Já existe um contato com este telefone nesta instância");
        }
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Contato criado com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["crm-all-contacts"] });
      reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erro ao criar contato");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto bg-background border-border">
        <DialogHeader>
          <DialogTitle className="text-foreground">Novo(a) Registro</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="space-y-4 pt-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-foreground">
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                placeholder="Nome"
                {...register("name")}
                className="bg-background border-border"
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                placeholder="email@exemplo.com.br"
                {...register("email")}
                className="bg-background border-border"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="phone" className="text-foreground">Telefone</Label>
            <Controller
              name="phone"
              control={control}
              render={({ field }) => (
                <Input
                  id="phone"
                  placeholder={PHONE_PLACEHOLDER}
                  value={field.value}
                  onChange={(e) => field.onChange(formatPhoneInput(e.target.value))}
                  className="bg-background border-border"
                />
              )}
            />
            {errors.phone && (
              <p className="text-xs text-destructive">{errors.phone.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="text-foreground">
              Instância <span className="text-destructive">*</span>
            </Label>
            <Controller
              name="instance_id"
              control={control}
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="bg-background border-border">
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
                      instances?.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              )}
            />
            {errors.instance_id && (
              <p className="text-xs text-destructive">{errors.instance_id.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Instância à qual este contato será vinculado
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                reset();
                onOpenChange(false);
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              <Plus className="h-4 w-4 mr-1" />
              Registro
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
