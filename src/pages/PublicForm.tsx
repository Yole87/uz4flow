import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { getPublicForm, submitFormResponse, uploadToBucket } from "@/services/uzFormService";
import type { PublicUzForm, UzFormField, UzFormStep } from "@/types/uzForm";
import { BrandLogo } from "@/components/branding/BrandLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CheckCircle, AlertCircle, ArrowLeft, ArrowRight, Upload, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ─── Formatting & Masking Helpers ───────────────────────────────────────────

function maskPhone(value: string) {
  const clean = value.replace(/\D/g, "");
  if (clean.length <= 10) {
    return clean
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d{4})(\d)/, "$1-$2")
      .substring(0, 14);
  } else {
    return clean
      .replace(/^(\d{2})(\d)/g, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .substring(0, 15);
  }
}

function maskCPF(value: string) {
  const clean = value.replace(/\D/g, "").substring(0, 11);
  return clean
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d{1,2})$/, "$1.$2.$3-$4");
}

function maskCNPJ(value: string) {
  const clean = value.replace(/\D/g, "");
  return clean
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2")
    .substring(0, 18);
}

function maskCEP(value: string) {
  const clean = value.replace(/\D/g, "");
  return clean.replace(/^(\d{5})(\d)/, "$1-$2").substring(0, 9);
}

function getYouTubeId(url: string): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11 ? match[2] : null;
}

interface AddressState {
  cep: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
}

export default function PublicForm() {
  const { token } = useParams<{ token: string }>();
  const [form, setForm] = useState<PublicUzForm | null>(null);
  const [loading, setLoading] = useState(true);
  
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [addressResponses, setAddressResponses] = useState<Record<string, AddressState>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [cepLoading, setCepLoading] = useState<Record<string, boolean>>({});
  const [cepError, setCepError] = useState<Record<string, string>>({});
  const [uploadingFields, setUploadingFields] = useState<Record<string, boolean>>({});
  const [fileNames, setFileNames] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!token) return;
    getPublicForm(token)
      .then((res) => {
        setForm(res);
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!form || !form.is_active || form.is_deleted) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
        <div className="w-full max-w-md text-center space-y-6">
          <BrandLogo className="mx-auto h-12 w-auto object-contain" />
          <div className="bg-card border border-border p-8 rounded-2xl shadow-xl space-y-4">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive animate-pulse" />
            <h2 className="text-xl font-bold text-foreground">Formulário não encontrado ou inativo</h2>
            <p className="text-sm text-muted-foreground">
              Este formulário não existe no momento ou está temporariamente inativo.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const steps = form.steps || [];
  const totalSteps = steps.length;
  const currentStep = steps[currentStepIndex];

  // Watermark comes from the organization's PLAN (super admin controlled), not from form settings.
  const watermarkText = form.watermark_text || "";
  const successMessage = (form.settings as any)?.success_message || "Obrigado! Suas respostas foram enviadas com sucesso.";

  // ─── Format Address String ──────────────────────────────────────────────────

  const formatAddress = (addr: AddressState) => {
    const parts = [];
    if (addr.cep) parts.push(`CEP: ${addr.cep}`);
    if (addr.rua) parts.push(addr.rua);
    if (addr.numero) parts.push(`Nº ${addr.numero}`);
    if (addr.complemento) parts.push(`Compl: ${addr.complemento}`);
    if (addr.bairro) parts.push(addr.bairro);
    if (addr.cidade) {
      if (addr.estado) parts.push(`${addr.cidade}/${addr.estado}`);
      else parts.push(addr.cidade);
    } else if (addr.estado) {
      parts.push(addr.estado);
    }
    return parts.join(", ");
  };

  // ─── Input Handlers ─────────────────────────────────────────────────────────

  const handleFieldChange = (keyName: string, value: string) => {
    setResponses((prev) => ({
      ...prev,
      [keyName]: value,
    }));

    if (errors[keyName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[keyName];
        return next;
      });
    }
  };

  const handleCepChange = async (fieldId: string, keyName: string, value: string) => {
    const masked = maskCEP(value);
    const currentAddr = addressResponses[fieldId] || {
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    };
    const nextAddr = { ...currentAddr, cep: masked };

    setAddressResponses((prev) => ({
      ...prev,
      [fieldId]: nextAddr,
    }));

    setResponses((prev) => ({
      ...prev,
      [keyName]: formatAddress(nextAddr),
    }));

    if (errors[keyName]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[keyName];
        return next;
      });
    }

    const cleanCep = masked.replace(/\D/g, "");
    if (cleanCep.length === 8) {
      try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
          const updatedAddr = {
            ...nextAddr,
            rua: data.logradouro || "",
            bairro: data.bairro || "",
            cidade: data.localidade || "",
            estado: data.uf || "",
          };

          setAddressResponses((prev) => ({
            ...prev,
            [fieldId]: updatedAddr,
          }));

          setResponses((prev) => ({
            ...prev,
            [keyName]: formatAddress(updatedAddr),
          }));
        }
      } catch (err) {
        console.error("Erro ao buscar CEP:", err);
      }
    }
  };

  const handleAddressFieldChange = (
    fieldId: string,
    keyName: string,
    subField: keyof AddressState,
    value: string
  ) => {
    const currentAddr = addressResponses[fieldId] || {
      cep: "",
      rua: "",
      numero: "",
      complemento: "",
      bairro: "",
      cidade: "",
      estado: "",
    };
    const nextAddr = { ...currentAddr, [subField]: value };

    setAddressResponses((prev) => ({
      ...prev,
      [fieldId]: nextAddr,
    }));

    setResponses((prev) => ({
      ...prev,
      [keyName]: formatAddress(nextAddr),
    }));

    if (errors[keyName]) {
      const isValid =
        nextAddr.cep &&
        nextAddr.rua &&
        nextAddr.numero &&
        nextAddr.bairro &&
        nextAddr.cidade &&
        nextAddr.estado;
      if (isValid) {
        setErrors((prev) => {
          const next = { ...prev };
          delete next[keyName];
          return next;
        });
      }
    }
  };

  // ─── Step Navigation & Validation ──────────────────────────────────────────

  const validateStep = (step: UzFormStep): boolean => {
    const stepFields = step.fields || [];
    const newErrors: Record<string, string> = {};

    for (const field of stepFields) {
      if (field.is_required) {
        const val = responses[field.key_name];
        if (field.field_type === "address") {
          const addr = addressResponses[field.id];
          if (
            !addr ||
            !addr.cep ||
            !addr.rua ||
            !addr.numero ||
            !addr.bairro ||
            !addr.cidade ||
            !addr.estado
          ) {
            newErrors[field.key_name] = "Este campo é obrigatório";
          }
        } else {
          if (!val || val.trim() === "") {
            newErrors[field.key_name] = "Este campo é obrigatório";
          }
        }
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstErrorField = stepFields.find((f) => newErrors[f.key_name]);
      if (firstErrorField) {
        const el = document.getElementById(`field-container-${firstErrorField.id}`);
        el?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return false;
    }

    return true;
  };

  const handleNext = () => {
    if (!validateStep(currentStep)) return;

    if (currentStepIndex < totalSteps - 1) {
      setCurrentStepIndex(currentStepIndex + 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleBack = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex(currentStepIndex - 1);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return;

    setIsSubmitting(true);
    try {
      const finalResponses = { ...responses };
      for (const step of steps) {
        for (const field of step.fields || []) {
          if (field.field_type === "phone") {
            const phoneVal = finalResponses[field.key_name];
            if (phoneVal) {
              const cleanPhone = phoneVal.replace(/\D/g, "");
              if (cleanPhone) {
                finalResponses[field.key_name] = cleanPhone.startsWith("55")
                  ? cleanPhone
                  : `55${cleanPhone}`;
              }
            }
          }
        }
      }

      await submitFormResponse(form.id, form.organization_id, finalResponses);
      setIsSubmitted(true);
    } catch (err) {
      console.error("Erro ao enviar respostas:", err);
      toast.error("Erro ao enviar respostas. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ─── Field Renderer ─────────────────────────────────────────────────────────

  const renderField = (field: UzFormField) => {
    const error = errors[field.key_name];
    const value = responses[field.key_name] || "";

    return (
      <div
        key={field.id}
        id={`field-container-${field.id}`}
        className="space-y-2 animate-in fade-in duration-300"
      >
        <Label className="text-sm font-semibold flex items-center gap-1">
          {field.label}
          {field.is_required && <span className="text-destructive font-bold">*</span>}
        </Label>

        {(() => {
          switch (field.field_type) {
            case "name":
            case "short_text":
              return (
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => handleFieldChange(field.key_name, e.target.value)}
                  className={`h-12 rounded-xl text-base bg-background border-2 ${
                    error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                  }`}
                  placeholder="Digite sua resposta..."
                />
              );

            case "email":
              return (
                <Input
                  type="email"
                  value={value}
                  onChange={(e) => handleFieldChange(field.key_name, e.target.value)}
                  className={`h-12 rounded-xl text-base bg-background border-2 ${
                    error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                  }`}
                  placeholder="exemplo@email.com"
                />
              );

            case "phone":
              return (
                <Input
                  type="tel"
                  value={value}
                  onChange={(e) => handleFieldChange(field.key_name, maskPhone(e.target.value))}
                  className={`h-12 rounded-xl text-base bg-background border-2 ${
                    error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                  }`}
                  placeholder="(00) 00000-0000"
                />
              );

            case "cpf":
              return (
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => handleFieldChange(field.key_name, maskCPF(e.target.value))}
                  className={`h-12 rounded-xl text-base bg-background border-2 ${
                    error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                  }`}
                  placeholder="000.000.000-00"
                />
              );

            case "cnpj":
              return (
                <Input
                  type="text"
                  value={value}
                  onChange={(e) => handleFieldChange(field.key_name, maskCNPJ(e.target.value))}
                  className={`h-12 rounded-xl text-base bg-background border-2 ${
                    error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                  }`}
                  placeholder="00.000.000/0000-00"
                />
              );

            case "long_text":
              return (
                <Textarea
                  rows={4}
                  value={value}
                  onChange={(e) => handleFieldChange(field.key_name, e.target.value)}
                  className={`rounded-xl text-base bg-background border-2 ${
                    error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                  }`}
                  placeholder="Escreva sua resposta detalhadamente..."
                />
              );

            case "date":
              return (
                <Input
                  type="date"
                  value={value}
                  onChange={(e) => handleFieldChange(field.key_name, e.target.value)}
                  className={`h-12 rounded-xl text-base bg-background border-2 ${
                    error ? "border-destructive focus-visible:ring-destructive" : "border-border"
                  }`}
                />
              );

            case "multiple_choice":
              return (
                <div className="space-y-2">
                  {(field.options || []).map((opt) => {
                    const isSelected = value === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => handleFieldChange(field.key_name, opt)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between group ${
                          isSelected
                            ? "border-primary bg-primary/5 text-foreground font-semibold shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-primary/5 text-foreground"
                        }`}
                      >
                        <span className="text-base break-words flex-1 pr-2">{opt}</span>
                        <span
                          className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                            isSelected
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40 group-hover:border-primary/60"
                          }`}
                        >
                          {isSelected && <span className="w-2 h-2 rounded-full bg-background" />}
                        </span>
                      </button>
                    );
                  })}
                </div>
              );

            case "select_list":
              return (
                <Select value={value} onValueChange={(val) => handleFieldChange(field.key_name, val)}>
                  <SelectTrigger
                    className={`w-full bg-background border-2 text-foreground h-12 rounded-xl text-base ${
                      error ? "border-destructive" : "border-border"
                    }`}
                  >
                    <SelectValue placeholder="Selecione uma opção..." />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {(field.options || []).map((opt) => (
                      <SelectItem key={opt} value={opt} className="text-base py-3 cursor-pointer">
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );

            case "file_upload":
              return (
                <div className="space-y-2">
                  <label
                    className={`flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-6 cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-all text-center ${
                      error ? "border-destructive bg-destructive/5" : "border-border"
                    }`}
                  >
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm font-medium text-foreground truncate max-w-full px-4">
                      {value || "Clique para escolher o arquivo"}
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">
                      {value ? "Clique para alterar o arquivo" : "Nenhum arquivo selecionado"}
                    </span>
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          handleFieldChange(field.key_name, file.name);
                        }
                      }}
                    />
                  </label>
                </div>
              );

            case "address": {
              const addr = addressResponses[field.id] || {
                cep: "",
                rua: "",
                numero: "",
                complemento: "",
                bairro: "",
                cidade: "",
                estado: "",
              };

              return (
                <div className="space-y-3 p-4 rounded-xl border-2 border-border bg-card/30">
                  {/* CEP */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">CEP</Label>
                    <Input
                      type="text"
                      placeholder="00000-000"
                      value={addr.cep || ""}
                      onChange={(e) => handleCepChange(field.id, field.key_name, e.target.value)}
                      className={`h-11 rounded-lg text-sm bg-background border-2 ${
                        error && !addr.cep ? "border-destructive" : "border-border"
                      }`}
                    />
                  </div>
                  {/* Rua */}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Rua / Logradouro</Label>
                    <Input
                      type="text"
                      placeholder="Nome da rua"
                      value={addr.rua || ""}
                      onChange={(e) =>
                        handleAddressFieldChange(field.id, field.key_name, "rua", e.target.value)
                      }
                      className={`h-11 rounded-lg text-sm bg-background border-2 ${
                        error && !addr.rua ? "border-destructive" : "border-border"
                      }`}
                    />
                  </div>
                  {/* Número e Complemento */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Número</Label>
                      <Input
                        type="text"
                        placeholder="Nº"
                        value={addr.numero || ""}
                        onChange={(e) =>
                          handleAddressFieldChange(field.id, field.key_name, "numero", e.target.value)
                        }
                        className={`h-11 rounded-lg text-sm bg-background border-2 ${
                          error && !addr.numero ? "border-destructive" : "border-border"
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Complemento (Opcional)</Label>
                      <Input
                        type="text"
                        placeholder="Apto, Bloco..."
                        value={addr.complemento || ""}
                        onChange={(e) =>
                          handleAddressFieldChange(field.id, field.key_name, "complemento", e.target.value)
                        }
                        className="h-11 rounded-lg text-sm bg-background border-2 border-border"
                      />
                    </div>
                  </div>
                  {/* Bairro, Cidade e Estado */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Bairro</Label>
                      <Input
                        type="text"
                        placeholder="Bairro"
                        value={addr.bairro || ""}
                        onChange={(e) =>
                          handleAddressFieldChange(field.id, field.key_name, "bairro", e.target.value)
                        }
                        className={`h-11 rounded-lg text-sm bg-background border-2 ${
                          error && !addr.bairro ? "border-destructive" : "border-border"
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Cidade</Label>
                      <Input
                        type="text"
                        placeholder="Cidade"
                        value={addr.cidade || ""}
                        onChange={(e) =>
                          handleAddressFieldChange(field.id, field.key_name, "cidade", e.target.value)
                        }
                        className={`h-11 rounded-lg text-sm bg-background border-2 ${
                          error && !addr.cidade ? "border-destructive" : "border-border"
                        }`}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Estado</Label>
                      <Input
                        type="text"
                        placeholder="UF"
                        value={addr.estado || ""}
                        maxLength={2}
                        onChange={(e) =>
                          handleAddressFieldChange(
                            field.id,
                            field.key_name,
                            "estado",
                            e.target.value.toUpperCase()
                          )
                        }
                        className={`h-11 rounded-lg text-sm bg-background border-2 ${
                          error && !addr.estado ? "border-destructive" : "border-border"
                        }`}
                      />
                    </div>
                  </div>
                </div>
              );
            }

            default:
              return null;
          }
        })()}

        {error && (
          <p className="text-xs font-semibold text-destructive flex items-center gap-1 mt-1 animate-in slide-in-from-top-1">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </p>
        )}
      </div>
    );
  };

  // ─── Success Screen ────────────────────────────────────────────────────────

  if (isSubmitted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
        <div className="w-full max-w-md text-center space-y-6 animate-in zoom-in duration-300">
          <BrandLogo className="mx-auto h-12 w-auto object-contain" />
          <div className="bg-card border border-border p-8 rounded-2xl shadow-xl space-y-4">
            <CheckCircle className="mx-auto h-16 w-16 text-success" />
            <h2 className="text-2xl font-bold text-foreground">Enviado com sucesso!</h2>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {successMessage}
            </p>
          </div>
          {watermarkText && (
            <p className="text-xs text-muted-foreground/60">{watermarkText}</p>
          )}
        </div>
      </div>
    );
  }

  // ─── Main Form Experience ──────────────────────────────────────────────────

  const mediaUrl = currentStep?.media_url || "";
  const mediaType = currentStep?.media_type || "none";
  const stepTitle = currentStep?.title || "";
  const stepDescription = currentStep?.description || "";
  const fields = currentStep?.fields || [];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Progress Bar Header */}
      <div className="w-full sticky top-0 bg-background/80 backdrop-blur z-20 border-b border-border">
        <div className="w-full bg-border h-1.5 overflow-hidden">
          <div
            className="bg-primary h-full transition-all duration-300 ease-out"
            style={{ width: `${((currentStepIndex + 1) / totalSteps) * 100}%` }}
          />
        </div>
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between text-xs text-muted-foreground font-medium">
          <span>{form.name}</span>
          <span>
            Passo {currentStepIndex + 1} de {totalSteps}
          </span>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-lg mx-auto px-4 py-8 flex flex-col justify-center">
        <div className="space-y-6">
          {/* Brand Logo inside Form Header */}
          <div className="flex justify-center pb-2">
            <BrandLogo className="h-9 w-auto object-contain" />
          </div>

          {/* Media Player */}
          {mediaType === "image" && mediaUrl && (
            <div className="w-full overflow-hidden rounded-xl border border-border">
              <img
                src={mediaUrl}
                alt={stepTitle || "Imagem do passo"}
                className="w-full h-auto max-h-64 sm:max-h-80 object-cover"
              />
            </div>
          )}

          {mediaType === "youtube" && mediaUrl && getYouTubeId(mediaUrl) && (
            <div className="w-full overflow-hidden rounded-xl border border-border aspect-video">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${getYouTubeId(mediaUrl)}`}
                title={stepTitle || "Vídeo do passo"}
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          )}

          {/* Step Header */}
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold text-foreground tracking-tight">
              {stepTitle || `Passo ${currentStepIndex + 1}`}
            </h1>
            {stepDescription && (
              <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {stepDescription}
              </p>
            )}
          </div>

          {/* Fields */}
          <div className="space-y-5">
            {fields.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Este passo não contém nenhuma pergunta. Clique em avançar.
              </p>
            ) : (
              fields.map((field) => renderField(field))
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-3 pt-6 border-t border-border">
            {!isFirstStep && (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={handleBack}
                className="flex-1 h-12 rounded-xl text-base gap-2"
                disabled={isSubmitting}
              >
                <ArrowLeft className="h-4 w-4" />
                Anterior
              </Button>
            )}

            <Button
              type="button"
              size="lg"
              onClick={isLastStep ? handleSubmit : handleNext}
              className="flex-grow flex-1 h-12 rounded-xl text-base gap-2"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : isLastStep ? (
                <>
                  Enviar
                  <CheckCircle className="h-4 w-4" />
                </>
              ) : (
                <>
                  Próximo
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* Footer / Watermark */}
      <footer className="w-full py-6 text-center border-t border-border mt-auto">
        {watermarkText ? (
          <p className="text-xs text-muted-foreground/60">{watermarkText}</p>
        ) : (
          <p className="text-xs text-muted-foreground/40">
            Desenvolvido com <span className="text-accent">UzFlow</span>
          </p>
        )}
      </footer>
    </div>
  );
}
