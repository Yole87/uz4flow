import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Handshake, Loader2, Lock } from "lucide-react";
import { translateAuthError } from "@/lib/errorMessages";
import { z } from "zod";
import { AffiliateOnboardingForm } from "@/components/affiliates/AffiliateOnboardingForm";
import { useAffiliateSettings } from "@/hooks/useAffiliate";
import { formatPhoneInput, stripPhone, PHONE_PLACEHOLDER } from "@/lib/phoneFormat";
import { PasswordHint } from "@/components/auth/PasswordHint";
import { isPasswordValid } from "@/lib/passwordRules";

const schema = z.object({
  fullName: z.string().min(2, "Informe seu nome"),
  email: z.string().email("E-mail inválido"),
  phone: z.string().refine((v) => stripPhone(v).length >= 10, "Informe um telefone válido"),
  password: z
    .string()
    .min(8, "Mínimo 8 caracteres")
    .refine(isPasswordValid, "A senha precisa ter letra maiúscula, minúscula, número e símbolo (!@#$...)"),
});

export default function AffiliateOnboardingPublic() {
  const navigate = useNavigate();
  const { user, signUp } = useAuth();
  const { data: settings, isLoading: settingsLoading } = useAffiliateSettings();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const programEnabled = settings?.program_enabled !== false;

  useEffect(() => {
    if (!settingsLoading && !programEnabled) {
      toast.info("Programa de afiliados temporariamente indisponível.");
      navigate("/", { replace: true });
    }
  }, [settingsLoading, programEnabled, navigate]);

  if (!settingsLoading && !programEnabled) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="quantum-glass max-w-md w-full">
          <CardContent className="p-8 text-center space-y-3">
            <Lock className="w-10 h-10 text-muted-foreground mx-auto" />
            <h2 className="text-xl font-bold">Programa indisponível</h2>
            <p className="text-sm text-muted-foreground">Volte em breve.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <AffiliateOnboardingForm onCreated={() => navigate("/affiliates")} />
        </div>
      </div>
    );
  }

  const submit = async () => {
    const v = schema.safeParse({ fullName, email, phone, password });
    if (!v.success) return toast.error(v.error.errors[0].message);
    setLoading(true);
    const { error } = await signUp(email, password, {
      full_name: fullName,
      phone: stripPhone(phone),
    });
    setLoading(false);
    if (error) return toast.error(translateAuthError(error.message));
    toast.success("Conta criada! Agora preencha seus dados de afiliado.");
  };

  const passwordStrong = isPasswordValid(password);
  const formValid =
    fullName.trim().length >= 2 &&
    /\S+@\S+\.\S+/.test(email) &&
    stripPhone(phone).length >= 10 &&
    passwordStrong;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="quantum-glass max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center neon-glow-pink">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Seja afiliado Uz4Flow</CardTitle>
              <CardDescription>Crie sua conta para indicar e ganhar</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nome completo</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <Label>Telefone (WhatsApp)</Label>
            <Input
              type="tel"
              inputMode="tel"
              placeholder={PHONE_PLACEHOLDER}
              value={phone}
              onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
            />
          </div>
          <div>
            <Label>Senha</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordHint password={password} />
          </div>
          <Button
            className="w-full gradient-primary"
            onClick={submit}
            disabled={loading || !formValid}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Criar conta de afiliado
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Já tem conta? <Link to="/" className="text-primary underline">Entrar</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
