import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast as sonnerToast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Save, ShieldCheck, Mail, UserCog } from "lucide-react";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { isPasswordValid, getPasswordError, PASSWORD_HELP_TEXT } from "@/lib/passwordRules";

interface AdminProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function AdminProfileDialog({ open, onOpenChange }: AdminProfileDialogProps) {
  const { user, updatePassword } = useAuth();
  const queryClient = useQueryClient();
  const notify = {
    success: (title: string, description?: string) =>
      sonnerToast.success(title, { description, position: "top-center", duration: 5000 }),
    error: (title: string, description?: string) =>
      sonnerToast.error(title, { description, position: "top-center", duration: 5000 }),
  };

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [changingEmail, setChangingEmail] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["admin-profile-edit", user?.id],
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
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName, phone })
        .eq("user_id", user.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-profile-edit"] });
      notify.success("Perfil atualizado", "Suas informações foram salvas.");
    } catch {
      notify.error("Não foi possível salvar", "Tente novamente em instantes.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangeEmail = async () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(trimmed)) {
      notify.error("E-mail inválido", "Digite um endereço de e-mail válido.");
      return;
    }
    if (trimmed === user?.email?.toLowerCase()) {
      notify.error("Mesmo e-mail", "O novo e-mail deve ser diferente do atual.");
      return;
    }
    setChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: trimmed });
      if (error) throw error;
      notify.success(
        "Confirmação enviada!",
        "Acesse o novo e-mail e clique no link de confirmação. Suas permissões de Super Admin permanecem intactas."
      );
      setNewEmail("");
    } catch (err: any) {
      const msg = err?.message || "";
      if (msg.toLowerCase().includes("registered") || msg.toLowerCase().includes("already")) {
        notify.error("E-mail já cadastrado", "Este endereço já está em uso por outra conta.");
      } else {
        notify.error("Não foi possível alterar o e-mail", "Verifique o endereço e tente novamente.");
      }
    } finally {
      setChangingEmail(false);
    }
  };

  const handleChangePassword = async () => {
    const pwError = getPasswordError(newPassword);
    if (pwError) {
      notify.error("Senha não atende aos requisitos", pwError);
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.error("Senhas não conferem", "As senhas digitadas são diferentes.");
      return;
    }
    setChangingPassword(true);
    try {
      const { error } = await updatePassword(newPassword);
      if (error) throw error;
      setNewPassword("");
      setConfirmPassword("");
      notify.success(
        "Senha alterada com sucesso!",
        "Suas permissões de Super Admin permanecem intactas."
      );
    } catch (err: any) {
      const msg = (err?.message || "").toLowerCase();
      if (msg.includes("weak") || msg.includes("pwned") || msg.includes("known")) {
        notify.error(
          "Senha muito fraca",
          "Esta senha já apareceu em vazamentos públicos. Escolha outra combinação única."
        );
      } else if (msg.includes("same") || msg.includes("different from the old")) {
        notify.error("Senha repetida", "A nova senha deve ser diferente da atual.");
      } else {
        notify.error("Não foi possível alterar a senha", "Tente novamente em instantes.");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  const passwordsMatch = newPassword === confirmPassword;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Meu perfil — Super Admin
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground">
              Suas permissões de Super Admin estão vinculadas à sua conta e permanecem
              intactas mesmo se você alterar seu e-mail ou senha.
            </p>
          </div>

          {/* Dados pessoais */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Informações pessoais</h4>
            <div className="space-y-1.5">
              <Label>Nome completo</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+55 11 91234-5678"
              />
            </div>
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              size="sm"
              className="w-full"
            >
              <Save className="w-4 h-4 mr-2" />
              {savingProfile ? "Salvando…" : "Salvar informações"}
            </Button>
          </div>

          <Separator />

          {/* Alterar e-mail */}
          <div className="space-y-3">
            <h4 className="text-sm font-medium flex items-center gap-1.5">
              <Mail className="w-4 h-4" /> Alterar e-mail
            </h4>
            <div className="space-y-1.5">
              <Label>E-mail atual</Label>
              <Input value={user?.email || ""} disabled className="opacity-60" />
            </div>
            <div className="space-y-1.5">
              <Label>Novo e-mail</Label>
              <Input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="novo@email.com"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                Um link de confirmação será enviado para o novo endereço. A alteração só é
                efetivada após você clicar nesse link.
              </p>
            </div>
            <Button
              onClick={handleChangeEmail}
              disabled={changingEmail || !newEmail.trim()}
              size="sm"
              variant="outline"
              className="w-full"
            >
              {changingEmail ? "Enviando…" : "Alterar e-mail"}
            </Button>
          </div>

          <Separator />

          {/* Alterar senha */}
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
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
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
