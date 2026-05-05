import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { translateAuthError } from "@/lib/errorMessages";
import { Lock, ArrowRight, Loader2, CheckCircle } from "lucide-react";
import { z } from "zod";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { isPasswordValid, PASSWORD_HELP_TEXT } from "@/lib/passwordRules";

const passwordSchema = z.object({
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .refine(isPasswordValid, "A senha precisa ter maiúscula, minúscula, número e símbolo"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword, session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Check if user has a valid recovery session
    if (!session) {
      // Wait a moment for the session to be established from the URL token
      const timeout = setTimeout(() => {
        if (!session) {
          toast.error("Link de recuperação inválido ou expirado");
          navigate("/auth");
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [session, navigate]);

  const handleSubmit = async () => {
    try {
      const validation = passwordSchema.safeParse({ password, confirmPassword });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      setLoading(true);
      const { error } = await updatePassword(password);
      
      if (error) {
        toast.error(translateAuthError(error.message));
        return;
      }

      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      
      // Redirect to auth after 2 seconds
      setTimeout(() => {
        navigate("/auth");
      }, 2000);
    } catch (error) {
      toast.error("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-secondary/20 to-background">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full gradient-primary opacity-20 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full gradient-accent opacity-20 blur-3xl" />
      </div>

      <Card className="w-full max-w-md relative animate-fade-in shadow-xl border-border/50">
        <CardHeader className="text-center pb-2">
          <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl shadow-lg ${success ? 'bg-success' : 'gradient-primary'}`}>
            {success ? (
              <CheckCircle className="h-8 w-8 text-white" />
            ) : (
              <Lock className="h-8 w-8 text-white" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {success ? "Senha Redefinida!" : "Redefinir Senha"}
          </CardTitle>
          <CardDescription className="text-base">
            {success 
              ? "Você será redirecionado para o login..." 
              : "Defina sua nova senha"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {success ? (
            <div className="text-center py-4">
              <div className="animate-pulse">
                <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="password">Nova senha</Label>
                <p className="text-xs text-muted-foreground">{PASSWORD_HELP_TEXT}</p>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Crie uma senha forte"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
                <PasswordHint password={password} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Digite novamente"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                  />
                </div>
              </div>
              <Button
                className="w-full gradient-primary hover:opacity-90 transition-opacity"
                onClick={handleSubmit}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Redefinir senha
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
