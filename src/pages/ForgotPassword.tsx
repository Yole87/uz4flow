import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2, Send, CheckCircle2 } from "lucide-react";
import { z } from "zod";

const emailSchema = z.object({
  email: z.string().email("Email inválido"),
});

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { resetPasswordForEmail } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const handleSubmit = async () => {
    try {
      const validation = emailSchema.safeParse({ email });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      setLoading(true);
      const { error } = await resetPasswordForEmail(email);
      
      if (error) {
        toast.error("Ocorreu um erro ao enviar o email. Tente novamente.");
        return;
      }

      setEmailSent(true);
      toast.success("Email enviado com sucesso!");
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
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-lg">
            <Mail className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Recuperar Senha</CardTitle>
          <CardDescription className="text-base">
            {emailSent 
              ? "Verifique sua caixa de entrada" 
              : "Informe seu email para receber o link de recuperação"
            }
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {emailSent ? (
            <div className="text-center space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success/15">
                <CheckCircle2 className="h-8 w-8 text-success" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Email enviado</h3>
              <p className="text-sm text-muted-foreground">
                Enviamos um link de recuperação para{" "}
                <span className="font-medium text-foreground">{email}</span>. Verifique sua caixa de
                entrada e a pasta de spam.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setEmailSent(false)}
                >
                  Tentar outro email
                </Button>
                <Button
                  className="w-full gradient-primary hover:opacity-90 transition-opacity"
                  onClick={() => navigate("/auth")}
                >
                  Voltar para login
                </Button>
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
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
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar link de recuperação
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar para o login
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
