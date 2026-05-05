import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { 
  Save, Upload, Image, Globe, Palette, BarChart3, AlertTriangle, 
  Share2, Loader2, Trash2 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface BrandingSettings {
  favicon_url: string;
  pwa_icon_192_url: string;
  pwa_icon_512_url: string;
  logo_url: string;
  og_image_url: string;
  theme_color: string;
  meta_description: string;
  social_links: { instagram: string; youtube: string; linkedin: string };
  analytics_id: string;
  maintenance_mode: boolean;
  maintenance_message: string;
}

const defaultBranding: BrandingSettings = {
  favicon_url: "",
  pwa_icon_192_url: "",
  pwa_icon_512_url: "",
  logo_url: "",
  og_image_url: "",
  theme_color: "#0a0a0a",
  meta_description: "",
  social_links: { instagram: "", youtube: "", linkedin: "" },
  analytics_id: "",
  maintenance_mode: false,
  maintenance_message: "",
};

interface BrandingTabProps {
  initialData?: Partial<BrandingSettings>;
  onSave: (key: string, value: unknown) => Promise<void>;
  saving: boolean;
}

export function BrandingTab({ initialData, onSave, saving }: BrandingTabProps) {
  const [branding, setBranding] = useState<BrandingSettings>({
    ...defaultBranding,
    ...initialData,
    social_links: { ...defaultBranding.social_links, ...(initialData?.social_links || {}) },
  });
  const [uploading, setUploading] = useState<string | null>(null);
  const { toast } = useToast();

  const uploadFile = async (file: File, path: string, field: keyof BrandingSettings) => {
    setUploading(field);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `${path}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("branding-assets")
        .upload(filePath, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("branding-assets")
        .getPublicUrl(filePath);

      // Add cache-bust param
      const url = `${urlData.publicUrl}?v=${Date.now()}`;
      setBranding((prev) => ({ ...prev, [field]: url }));

      toast({ title: "Upload concluído", description: `${path} atualizado com sucesso` });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const handleSave = async () => {
    await onSave("branding", branding);
  };

  return (
    <div className="space-y-6">
      {/* Favicon & PWA Icons */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Image className="w-5 h-5" />
            Favicon & Ícones PWA
          </CardTitle>
          <CardDescription>
            Upload dos ícones do app. O favicon aparece na aba do navegador, os ícones PWA no celular.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ImageUploadField
              label="Favicon"
              hint="32x32 ou 64x64 px"
              value={branding.favicon_url}
              uploading={uploading === "favicon_url"}
              onUpload={(f) => uploadFile(f, "favicon", "favicon_url")}
              onClear={() => setBranding((p) => ({ ...p, favicon_url: "" }))}
            />
            <ImageUploadField
              label="Ícone PWA 192x192"
              hint="192x192 px, PNG"
              value={branding.pwa_icon_192_url}
              uploading={uploading === "pwa_icon_192_url"}
              onUpload={(f) => uploadFile(f, "pwa-192", "pwa_icon_192_url")}
              onClear={() => setBranding((p) => ({ ...p, pwa_icon_192_url: "" }))}
            />
            <ImageUploadField
              label="Ícone PWA 512x512"
              hint="512x512 px, PNG"
              value={branding.pwa_icon_512_url}
              uploading={uploading === "pwa_icon_512_url"}
              onUpload={(f) => uploadFile(f, "pwa-512", "pwa_icon_512_url")}
              onClear={() => setBranding((p) => ({ ...p, pwa_icon_512_url: "" }))}
            />
          </div>
        </CardContent>
      </Card>

      {/* Logo & OG Image */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Logo & Imagem Social
          </CardTitle>
          <CardDescription>
            Logo do app (sidebar) e imagem OG para compartilhamento em redes sociais.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <ImageUploadField
              label="Logo do App"
              hint="PNG com transparência, ~200px"
              value={branding.logo_url}
              uploading={uploading === "logo_url"}
              onUpload={(f) => uploadFile(f, "logo", "logo_url")}
              onClear={() => setBranding((p) => ({ ...p, logo_url: "" }))}
            />
            <ImageUploadField
              label="OG Image (1200x630)"
              hint="Imagem de compartilhamento social"
              value={branding.og_image_url}
              uploading={uploading === "og_image_url"}
              onUpload={(f) => uploadFile(f, "og-image", "og_image_url")}
              onClear={() => setBranding((p) => ({ ...p, og_image_url: "" }))}
              wide
            />
          </div>
        </CardContent>
      </Card>

      {/* SEO & Meta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="w-5 h-5" />
            SEO & Meta Tags
          </CardTitle>
          <CardDescription>
            Meta description e theme color do site.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Meta Description</Label>
            <Textarea
              value={branding.meta_description}
              onChange={(e) => setBranding((p) => ({ ...p, meta_description: e.target.value }))}
              placeholder="Automatize seu WhatsApp Business com fluxos inteligentes"
              rows={2}
              maxLength={160}
            />
            <p className="text-xs text-muted-foreground">{branding.meta_description.length}/160 caracteres</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Theme Color</Label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={branding.theme_color}
                  onChange={(e) => setBranding((p) => ({ ...p, theme_color: e.target.value }))}
                  className="w-10 h-10 rounded border border-input cursor-pointer"
                />
                <Input
                  value={branding.theme_color}
                  onChange={(e) => setBranding((p) => ({ ...p, theme_color: e.target.value }))}
                  placeholder="#0a0a0a"
                  className="flex-1"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            Analytics & Tracking
          </CardTitle>
          <CardDescription>
            ID do Google Analytics (G-xxx), Universal Analytics (UA-xxx) ou GTM (GTM-xxx).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>Analytics / GTM ID</Label>
            <Input
              value={branding.analytics_id}
              onChange={(e) => setBranding((p) => ({ ...p, analytics_id: e.target.value }))}
              placeholder="G-XXXXXXXXXX"
            />
          </div>
        </CardContent>
      </Card>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            Redes Sociais
          </CardTitle>
          <CardDescription>
            Links exibidos no rodapé da landing page.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Instagram</Label>
              <Input
                value={branding.social_links.instagram}
                onChange={(e) =>
                  setBranding((p) => ({
                    ...p,
                    social_links: { ...p.social_links, instagram: e.target.value },
                  }))
                }
                placeholder="https://instagram.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>YouTube</Label>
              <Input
                value={branding.social_links.youtube}
                onChange={(e) =>
                  setBranding((p) => ({
                    ...p,
                    social_links: { ...p.social_links, youtube: e.target.value },
                  }))
                }
                placeholder="https://youtube.com/..."
              />
            </div>
            <div className="space-y-2">
              <Label>LinkedIn</Label>
              <Input
                value={branding.social_links.linkedin}
                onChange={(e) =>
                  setBranding((p) => ({
                    ...p,
                    social_links: { ...p.social_links, linkedin: e.target.value },
                  }))
                }
                placeholder="https://linkedin.com/..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Maintenance Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Modo Manutenção
          </CardTitle>
          <CardDescription>
            Ative para exibir uma página de manutenção para todos os usuários (exceto admins).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={branding.maintenance_mode}
              onCheckedChange={(checked) => setBranding((p) => ({ ...p, maintenance_mode: checked }))}
            />
            <Label>{branding.maintenance_mode ? "Ativado" : "Desativado"}</Label>
          </div>
          {branding.maintenance_mode && (
            <div className="space-y-2">
              <Label>Mensagem de Manutenção</Label>
              <Textarea
                value={branding.maintenance_message}
                onChange={(e) => setBranding((p) => ({ ...p, maintenance_message: e.target.value }))}
                placeholder="Estamos em manutenção. Voltamos em breve!"
                rows={3}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Save */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="gradient-primary border-0">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salvar Branding
        </Button>
      </div>
    </div>
  );
}

/* ─── Image Upload Field ─── */

function ImageUploadField({
  label,
  hint,
  value,
  uploading,
  onUpload,
  onClear,
  wide,
}: {
  label: string;
  hint: string;
  value: string;
  uploading: boolean;
  onUpload: (file: File) => void;
  onClear: () => void;
  wide?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <p className="text-xs text-muted-foreground">{hint}</p>
      {value ? (
        <div className="relative group">
          <img
            src={value}
            alt={label}
            className={`rounded-lg border border-border object-contain bg-muted/50 ${
              wide ? "w-full h-32" : "w-24 h-24"
            }`}
          />
          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            </Button>
            <Button size="sm" variant="destructive" onClick={onClear}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className={`border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center gap-1 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors cursor-pointer ${
            wide ? "w-full h-32" : "w-24 h-24"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <Upload className="w-5 h-5" />
              <span className="text-xs">Upload</span>
            </>
          )}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/ico,image/x-icon,image/svg+xml"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
