import { useState } from "react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ShieldAlert } from "lucide-react";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { isPasswordValid, PASSWORD_HELP_TEXT } from "@/lib/passwordRules";

interface ForcePasswordChangeDialogProps {
  open: boolean;
  onComplete: () => void;
}

export function ForcePasswordChangeDialog({ open, onComplete }: ForcePasswordChangeDialogProps) {
  const { user, updatePassword } = useAuth();
  const { toast } = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = password === confirmPassword;
  const canSubmit = isPasswordValid(password) && passwordsMatch && !loading;

  const handleSubmit = async () => {
    if (!canSubmit || !user) return;
    setLoading(true);
    try {
      const { error } = await updatePassword(password);
      if (error) throw error;

      await supabase
        .from("profiles")
        .update({ force_password_change: false })
        .eq("user_id", user.id);

      toast({ title: "Senha atualizada", description: "Sua nova senha foi definida com sucesso." });
      onComplete();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Não foi possível alterar a senha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-md" onPointerDownOutside={(e) => e.preventDefault()} onEscapeKeyDown={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-warning" />
            Troca de senha obrigatória
          </DialogTitle>
          <DialogDescription>
            O administrador definiu uma senha temporária para sua conta. Por segurança, você precisa criar uma nova senha antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <p className="text-xs text-muted-foreground">{PASSWORD_HELP_TEXT}</p>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            <PasswordHint password={password} />
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
            {confirmPassword && passwordsMatch && isPasswordValid(password) && (
              <p className="text-xs text-success">Senhas conferem ✓</p>
            )}
          </div>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="w-full">
            {loading ? "Salvando…" : "Definir nova senha"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
