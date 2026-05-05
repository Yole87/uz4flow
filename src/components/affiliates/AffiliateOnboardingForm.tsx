import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AffiliateTermsDialog } from "./AffiliateTermsDialog";
import { Handshake, Loader2 } from "lucide-react";

export function AffiliateOnboardingForm({ onCreated }: { onCreated?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [bankName, setBankName] = useState("");
  const [bankAgency, setBankAgency] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountType, setBankAccountType] = useState("corrente");
  const [bankHolderName, setBankHolderName] = useState("");
  const [bankHolderDocument, setBankHolderDocument] = useState("");
  const [pixKeyType, setPixKeyType] = useState("cpf");
  const [pixKey, setPixKey] = useState("");
  const [termsOpen, setTermsOpen] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      // Generate code via RPC
      const { data: codeData, error: codeErr } = await supabase.rpc("generate_affiliate_code");
      if (codeErr) throw codeErr;
      const { data, error } = await supabase
        .from("affiliates")
        .insert({
          user_id: user.id,
          code: codeData as unknown as string,
          status: "pending",
          bank_name: bankName,
          bank_agency: bankAgency,
          bank_account: bankAccount,
          bank_account_type: bankAccountType,
          bank_holder_name: bankHolderName,
          bank_holder_document: bankHolderDocument,
          pix_key_type: pixKeyType,
          pix_key: pixKey,
          terms_version: acceptedVersion,
          terms_accepted_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;

      // Fire admin notification (fire-and-forget; never blocks the user)
      void supabase.functions.invoke("admin-notify", {
        body: {
          event_type: "affiliate_signup_request",
          variables: {
            user_name: user.user_metadata?.full_name || user.email,
            user_email: user.email,
            affiliate_code: codeData,
            date: new Date().toLocaleString("pt-BR"),
          },
        },
      });

      return data;
    },
    onSuccess: () => {
      toast.success("Cadastro enviado! Aguarde a aprovação da equipe.");
      qc.invalidateQueries({ queryKey: ["affiliate"] });
      onCreated?.();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao enviar cadastro"),
  });

  const canSubmit =
    !!bankName &&
    !!bankAgency &&
    !!bankAccount &&
    !!bankHolderName &&
    !!bankHolderDocument &&
    !!pixKey &&
    !!acceptedVersion &&
    !create.isPending;

  return (
    <>
      <Card className="quantum-glass max-w-3xl mx-auto">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gradient-primary flex items-center justify-center">
              <Handshake className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle>Seja um afiliado OpenFlow</CardTitle>
              <CardDescription>
                Indique e ganhe comissão sobre cada nova assinatura paga
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Dados bancários</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label>Banco</Label>
                <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Ex.: Banco Open" />
              </div>
              <div>
                <Label>Tipo de conta</Label>
                <Select value={bankAccountType} onValueChange={setBankAccountType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="corrente">Corrente</SelectItem>
                    <SelectItem value="poupanca">Poupança</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Agência</Label>
                <Input value={bankAgency} onChange={(e) => setBankAgency(e.target.value)} placeholder="0001" />
              </div>
              <div>
                <Label>Conta (com dígito)</Label>
                <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="12345-6" />
              </div>
              <div>
                <Label>Titular</Label>
                <Input value={bankHolderName} onChange={(e) => setBankHolderName(e.target.value)} placeholder="Nome completo" />
              </div>
              <div>
                <Label>CPF/CNPJ do titular</Label>
                <Input value={bankHolderDocument} onChange={(e) => setBankHolderDocument(e.target.value)} placeholder="000.000.000-00" />
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold text-foreground">Chave PIX (para pagamento)</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>Tipo</Label>
                <Select value={pixKeyType} onValueChange={setPixKeyType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cpf">CPF</SelectItem>
                    <SelectItem value="cnpj">CNPJ</SelectItem>
                    <SelectItem value="email">E-mail</SelectItem>
                    <SelectItem value="phone">Telefone</SelectItem>
                    <SelectItem value="random">Chave aleatória</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2">
                <Label>Chave</Label>
                <Input value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="Sua chave PIX" />
              </div>
            </div>
          </section>

          <section className="space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm">
              {acceptedVersion ? (
                <span className="text-success">✓ Termos aceitos (versão {acceptedVersion})</span>
              ) : (
                <span className="text-muted-foreground">Você precisa ler e aceitar os termos para enviar o cadastro.</span>
              )}
            </p>
            <Button variant="outline" size="sm" onClick={() => setTermsOpen(true)}>
              {acceptedVersion ? "Reler termos" : "Ler e aceitar termos"}
            </Button>
          </section>

          <Button
            className="w-full gradient-primary"
            disabled={!canSubmit}
            onClick={() => create.mutate()}
          >
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Enviar cadastro de afiliado
          </Button>
        </CardContent>
      </Card>

      <AffiliateTermsDialog
        open={termsOpen}
        onOpenChange={setTermsOpen}
        onAccept={(v) => setAcceptedVersion(v)}
      />
    </>
  );
}
