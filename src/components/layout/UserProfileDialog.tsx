import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Save, User } from "lucide-react";
import { MyPlanCard } from "@/components/layout/MyPlanCard";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { isPasswordValid, getPasswordError, PASSWORD_HELP_TEXT } from "@/lib/passwordRules";

interface UserProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UserProfileDialog({ open, onOpenChange }: UserProfileDialogProps) {
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  // Password fields
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["user-profile-edit", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id && open,
  });

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("user_id", user.id);

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ["user-profile-sidebar"] });
      queryClient.invalidateQueries({ queryKey: ["user-profile-edit"] });
      toast({ title: "Perfil atualizado", description: "Suas informações foram salvas com sucesso." });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Não foi possível salvar", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const pwError = getPasswordError(newPassword);
    if (pwError) {
      toast({ title: "Senha não atende aos requisitos", description: pwError, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Senhas não conferem", description: "As senhas digitadas são diferentes", variant: "destructive" });
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;

      // Clear force_password_change flag
      await supabase
        .from("profiles")
        .update({ force_password_change: false })
        .eq("user_id", user!.id);

      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "Senha alterada com sucesso!",
        description: "Sua nova senha já está ativa. Seu plano continua intacto.",
      });
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("weak") || msg.includes("pwned") || msg.includes("known")) {
        toast({
          title: "Senha muito fraca",
          description: "Esta senha já apareceu em vazamentos públicos. Escolha outra combinação única.",
          variant: "destructive",
        });
      } else if (msg.includes("same") || msg.includes("different from the old")) {
        toast({ title: "Senha repetida", description: "A nova senha deve ser diferente da atual.", variant: "destructive" });
      } else {
        toast({ title: "Erro", description: "Não foi possível alterar a senha. Tente novamente.", variant: "destructive" });
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordsMatch = newPassword === confirmPassword;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="w-5 h-5" />
            Meu perfil
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* My Plan */}
          <MyPlanCard />

          <Separator />

          {/* Profile info */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>E-mail</Label>
              <Input value={user?.email || ""} disabled className="opacity-60" />
            </div>
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(00) 00000-0000" />
            </div>
            <Button onClick={handleSaveProfile} disabled={saving} size="sm" className="w-full">
              <Save className="w-4 h-4 mr-2" />
              {saving ? "Salvando…" : "Salvar informações"}
            </Button>
          </div>

          <Separator />

          {/* Password change */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Alterar senha</h4>
            <p className="text-xs text-muted-foreground">{PASSWORD_HELP_TEXT}</p>
            <div className="space-y-1.5">
              <Label>Nova senha</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Digite a nova senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <PasswordHint password={newPassword} />
            </div>
            <div className="space-y-1.5">
              <Label>Confirmar nova senha</Label>
              <Input
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a senha"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-xs text-destructive">As senhas não conferem</p>
              )}
              {confirmPassword && passwordsMatch && isPasswordValid(newPassword) && (
                <p className="text-xs text-success">Senhas conferem ✓</p>
              )}
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={changingPassword || !isPasswordValid(newPassword) || !passwordsMatch}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {changingPassword ? "Alterando…" : "Alterar senha"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
