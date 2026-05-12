import { useBrandingLogo } from "@/hooks/useBranding";

interface BrandLogoProps {
  alt?: string;
  className?: string;
}

/**
 * Renders the app's logo from Branding settings (Admin → Branding).
 * Falls back to /favicon.png when no custom logo is configured.
 */
export function BrandLogo({ alt = "Logo", className }: BrandLogoProps) {
  const src = useBrandingLogo();
  return <img src={src} alt={alt} className={className} />;
}
