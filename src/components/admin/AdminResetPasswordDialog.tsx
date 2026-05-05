import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Eye, EyeOff, RefreshCw, Copy, KeyRound } from "lucide-react";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { PASSWORD_HELP_TEXT, isPasswordValid } from "@/lib/passwordRules";

interface AdminResetPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userEmail: string;
}

function generatePassword(length = 14): string {
  // Garante 1 maiúscula + 1 minúscula + 1 número + 1 símbolo
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghijkmnpqrstuvwxyz";
  const nums = "23456789";
  const syms = "!@#$%&*";
  const all = upper + lower + nums + syms;
  const pick = (set: string) => {
    const arr = new Uint8Array(1);
    crypto.getRandomValues(arr);
    return set[arr[0] % set.length];
  };
  const required = [pick(upper), pick(lower), pick(nums), pick(syms)];
  const remaining = Array.from({ length: length - required.length }, () => pick(all));
  const combined = [...required, ...remaining];
  // Shuffle (Fisher-Yates)
  for (let i = combined.length - 1; i > 0; i--) {
    const r = new Uint8Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [combined[i], combined[j]] = [combined[j], combined[i]];
  }
  return combined.join("");
}

export function AdminResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: AdminResetPasswordDialogProps) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleGenerate = () => {
    const pwd = generatePassword();
    setPassword(pwd);
    setConfirmPassword(pwd);
    setShowPassword(true);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const passwordsMatch = password === confirmPassword;
  const canSubmit = isPasswordValid(password) && passwordsMatch && !loading;

  const handleSubmit = async () => {
    if (!passwordsMatch) {
      toast({ title: "Senhas não conferem", description: "As senhas digitadas são diferentes", variant: "destructive" });
      return;
    }
    if (!isPasswordValid(password)) {
      toast({ title: "Senha não atende aos requisitos", description: PASSWORD_HELP_TEXT, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-update-password", {
        body: { user_id: userId, new_password: password, force_change: true },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({ title: "Senha alterada", description: `Senha temporária definida para ${userEmail}. O usuário será obrigado a trocar no próximo acesso.` });
      onOpenChange(false);
      setPassword("");
      setConfirmPassword("");
      setShowPassword(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message || "Não foi possível alterar a senha", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <KeyRound className="w-5 h-5" />
            Alterar senha do cliente
          </DialogTitle>
          <DialogDescription>
            Definir nova senha temporária para <strong>{userEmail}</strong>. O usuário será obrigado a criar uma nova senha ao acessar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>Nova senha</Label>
            <p className="text-xs text-muted-foreground">{PASSWORD_HELP_TEXT}</p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite ou gere uma senha"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <Button type="button" variant="outline" size="icon" onClick={handleGenerate} title="Gerar senha aleatória">
                <RefreshCw className="w-4 h-4" />
              </Button>
              {password && (
                <Button type="button" variant="outline" size="icon" onClick={handleCopy} title="Copiar">
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
            <PasswordHint password={password} />
            {password && copied && (
              <p className="text-xs text-success">Copiada para a área de transferência!</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Confirmar senha</Label>
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {loading ? "Salvando…" : "Alterar senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
