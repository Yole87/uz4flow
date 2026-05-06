import { useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { translateAuthError } from "@/lib/errorMessages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Zap, Mail, Lock, ArrowRight, Loader2 } from "lucide-react";
import { z } from "zod";
import { User } from "lucide-react";
import { useEffect } from "react";
import { captureRefFromUrl } from "@/lib/affiliateTracking";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { isPasswordValid } from "@/lib/passwordRules";
import { getCheckoutIntent, clearCheckoutIntent, buildCheckoutUrl, saveCheckoutIntent } from "@/lib/checkoutIntent";

const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(1, "Informe sua senha"),
});

const signupSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres")
    .refine(isPasswordValid, "A senha precisa ter letra maiúscula, minúscula, número e símbolo (!@#$...)"),
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
});

export default function Auth() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  const planId = searchParams.get("plan");
  const cycleParam = searchParams.get("cycle");
  const defaultTab = searchParams.get("tab") || "login";

  useEffect(() => {
    captureRefFromUrl();
    // Persist plan intent if present in URL (LP→signup flow)
    if (planId) {
      saveCheckoutIntent(planId, cycleParam || undefined);
    }
  }, [planId, cycleParam]);

  const getRedirectUrl = () => {
    // 1. URL has plan param → checkout for that plan
    if (planId) {
      const cycle = cycleParam ? `?cycle=${cycleParam}` : "";
      return `/checkout/${planId}${cycle}`;
    }
    // 2. Persisted intent (e.g. user came from LP, confirmed email later)
    const intent = getCheckoutIntent();
    if (intent) {
      clearCheckoutIntent();
      return buildCheckoutUrl(intent);
    }
    // 3. Default
    return "/dashboard";
  };

  const handleSubmit = async (type: "login" | "signup") => {
    try {
      const schema = type === "login" ? loginSchema : signupSchema.pick({ email: true, password: true });
      const validation = schema.safeParse({ email, password });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        return;
      }

      setLoading(true);

      if (type === "login") {
        const { error } = await signIn(email, password);
        if (error) {
          toast.error(translateAuthError(error.message));
          return;
        }
        toast.success("Bem-vindo de volta! 🎉");
        navigate(getRedirectUrl());
      } else {
        const signupValidation = signupSchema.safeParse({ email, password, firstName, lastName });
        if (!signupValidation.success) {
          toast.error(signupValidation.error.errors[0].message);
          return;
        }
        const fullName = `${firstName.trim()} ${lastName.trim()}`;
        const { error } = await signUp(email, password, { full_name: fullName });
        if (error) {
          toast.error(translateAuthError(error.message));
          return;
        }
        toast.success("Conta criada com sucesso! 🚀");
        navigate(getRedirectUrl());
      }
    } catch (error) {
      toast.error("Ocorreu um erro. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      {/* Neon orb decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-primary/20 blur-3xl animate-glow-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-accent/20 blur-3xl animate-glow-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/4 w-40 h-40 rounded-full bg-secondary/10 blur-3xl animate-glow-pulse" style={{ animationDelay: '0.5s' }} />
      </div>

      <Card className="w-full max-w-md relative animate-fade-in neon-glow-pink">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center btn-laser-cut gradient-primary shadow-lg animate-float neon-glow-pink">
            <Zap className="h-8 w-8 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold">Uz4Flow</CardTitle>
          <CardDescription className="text-base">
            Orquestre seus fluxos do Sistema de WhatsApp AI com facilidade
          </CardDescription>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 quantum-glass">
              <TabsTrigger value="login" className="data-[state=active]:bg-primary/20 data-[state=active]:text-primary data-[state=active]:shadow-[0_0_10px_hsl(var(--neon-pink)/0.3)]">Entrar</TabsTrigger>
              <TabsTrigger value="signup" className="data-[state=active]:bg-accent/20 data-[state=active]:text-accent data-[state=active]:shadow-[0_0_10px_hsl(var(--neon-cyan)/0.3)]">Criar conta</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="login-password">Senha</Label>
                  <Button
                    type="button"
                    variant="link"
                    className="h-auto p-0 text-xs text-primary hover:underline"
                    onClick={() => navigate('/forgot-password')}
                  >
                    Esqueceu sua senha?
                  </Button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit("login")}
                  />
                </div>
              </div>
              <Button
                className="w-full gradient-primary hover:opacity-90 transition-opacity hover:neon-glow-pink"
                onClick={() => handleSubmit("login")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Entrar
              </Button>
            </TabsContent>

            <TabsContent value="signup" className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="signup-first-name">Nome</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="signup-first-name"
                      type="text"
                      placeholder="João"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="pl-10"
                      disabled={loading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-last-name">Sobrenome</Label>
                  <Input
                    id="signup-last-name"
                    type="text"
                    placeholder="Silva"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="Crie uma senha forte"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10"
                    disabled={loading}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit("signup")}
                  />
                </div>
                <PasswordHint password={password} />
              </div>
              <p className="text-xs text-muted-foreground text-center">
                Ao criar uma conta, você concorda com os{" "}
                <Link to="/termos" className="text-primary hover:underline" target="_blank">Termos de Serviço</Link>{" "}
                e a{" "}
                <Link to="/privacidade" className="text-primary hover:underline" target="_blank">Política de Privacidade</Link>.
              </p>
              <Button
                className="w-full gradient-accent hover:opacity-90 transition-opacity hover:neon-glow-cyan"
                onClick={() => handleSubmit("signup")}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <ArrowRight className="h-4 w-4 mr-2" />
                )}
                Criar conta
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
