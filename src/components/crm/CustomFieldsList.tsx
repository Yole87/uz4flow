import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Mail,
  DollarSign,
  Home,
  Gamepad2,
  Calendar,
  Briefcase,
  Users,
  Plus,
  X,
  Save,
  Edit,
  Sparkles,
} from "lucide-react";

export interface CustomField {
  id: string;
  icon: "email" | "money" | "home" | "hobby" | "calendar" | "company" | "role";
  label: string;
  value: string;
}

const ICON_OPTIONS = [
  { value: "email", label: "Email", icon: Mail },
  { value: "money", label: "Financeiro", icon: DollarSign },
  { value: "home", label: "Endereço", icon: Home },
  { value: "hobby", label: "Hobby", icon: Gamepad2 },
  { value: "calendar", label: "Data", icon: Calendar },
  { value: "company", label: "Empresa", icon: Briefcase },
  { value: "role", label: "Cargo", icon: Users },
] as const;

function getIconComponent(iconType: string) {
  const found = ICON_OPTIONS.find((opt) => opt.value === iconType);
  return found?.icon || Sparkles;
}

interface CustomFieldsListProps {
  contactId: string;
  fields: CustomField[];
  metadata: Record<string, unknown> | null;
}

export function CustomFieldsList({ contactId, fields, metadata }: CustomFieldsListProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // New field state
  const [newIcon, setNewIcon] = useState<CustomField["icon"]>("email");
  const [newLabel, setNewLabel] = useState("");
  const [newValue, setNewValue] = useState("");
  
  // Edit field state
  const [editValue, setEditValue] = useState("");

  // Save fields mutation
  const saveMutation = useMutation({
    mutationFn: async (updatedFields: CustomField[]) => {
      const currentMetadata = (metadata || {}) as Record<string, unknown>;
      // Convert to JSON-compatible format
      const fieldsAsJson = updatedFields.map(f => ({
        id: f.id,
        icon: f.icon,
        label: f.label,
        value: f.value,
      }));
      const newMetadata = { ...currentMetadata, custom_fields: fieldsAsJson };
      const { error } = await supabase
        .from("contacts")
        .update({
          metadata: newMetadata as unknown as Record<string, never>,
        })
        .eq("id", contactId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-contact-details", contactId] });
      toast.success("Campo salvo!");
    },
    onError: () => {
      toast.error("Erro ao salvar campo");
    },
  });

  const handleAddField = () => {
    if (!newLabel.trim() || !newValue.trim()) {
      toast.error("Preencha o título e o valor");
      return;
    }

    const newField: CustomField = {
      id: `field_${Date.now()}`,
      icon: newIcon,
      label: newLabel.trim(),
      value: newValue.trim(),
    };

    saveMutation.mutate([...fields, newField]);
    setNewIcon("email");
    setNewLabel("");
    setNewValue("");
    setIsAdding(false);
  };

  const handleEditField = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (!field) return;
    setEditingId(fieldId);
    setEditValue(field.value);
  };

  const handleSaveEdit = (fieldId: string) => {
    if (!editValue.trim()) {
      toast.error("O valor não pode estar vazio");
      return;
    }

    const updatedFields = fields.map((f) =>
      f.id === fieldId ? { ...f, value: editValue.trim() } : f
    );
    saveMutation.mutate(updatedFields);
    setEditingId(null);
    setEditValue("");
  };

  const handleRemoveField = (fieldId: string) => {
    const updatedFields = fields.filter((f) => f.id !== fieldId);
    saveMutation.mutate(updatedFields);
  };

  return (
    <Card className="bg-card/50 border-border">
      <CardHeader className="py-2 sm:py-3 px-3 sm:px-4">
        <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
            Campos Personalizados
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsAdding(!isAdding)}
            className="h-6 w-6 sm:h-7 sm:w-7 p-0 text-muted-foreground hover:text-foreground"
          >
            {isAdding ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 sm:px-4 pb-2 sm:pb-3 space-y-3">
        {/* Add new field form */}
        {isAdding && (
          <div className="p-3 bg-muted/50 rounded-lg border border-border space-y-2">
            <div className="flex gap-2">
              <Select
                value={newIcon}
                onValueChange={(v) => setNewIcon(v as CustomField["icon"])}
              >
                <SelectTrigger className="w-24 h-8 bg-background border-border text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-card border-border z-[200]">
                  {ICON_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex items-center gap-1">
                        <opt.icon className="h-3 w-3" />
                        <span className="text-xs">{opt.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Título"
                className="flex-1 h-8 bg-background border-border text-xs"
              />
            </div>
            <div className="flex gap-2">
              <Input
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                placeholder="Valor"
                className="flex-1 h-8 bg-background border-border text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleAddField()}
              />
              <Button
                size="sm"
                onClick={handleAddField}
                disabled={saveMutation.isPending}
                className="h-8 gradient-primary text-white hover:opacity-90"
              >
                <Save className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}

        {/* Field list */}
        {fields.length === 0 && !isAdding && (
          <p className="text-xs text-muted-foreground/70 text-center py-2">
            Nenhum campo personalizado
          </p>
        )}

        {fields.map((field) => {
          const IconComponent = getIconComponent(field.icon);
          const isEditing = editingId === field.id;

          return (
            <div
              key={field.id}
              className="flex items-center gap-2 group"
            >
              <IconComponent className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground">{field.label}</p>
                {isEditing ? (
                  <div className="flex gap-1 mt-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="h-7 text-xs bg-muted border-border"
                      autoFocus
                      onKeyDown={(e) => e.key === "Enter" && handleSaveEdit(field.id)}
                    />
                    <Button
                      size="sm"
                      onClick={() => handleSaveEdit(field.id)}
                      className="h-7 w-7 p-0 gradient-primary text-white hover:opacity-90"
                    >
                      <Save className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      className="h-7 w-7 p-0"
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-foreground truncate">{field.value}</p>
                )}
              </div>
              {!isEditing && (
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditField(field.id)}
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  >
                    <Edit className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveField(field.id)}
                    className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
