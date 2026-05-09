import { Link } from "react-router-dom";
import { Zap, Mail, MessageCircle, Linkedin, Heart, Instagram, Youtube } from "lucide-react";
import { useBranding } from "@/hooks/useBranding";

interface LandingFooterProps {
  appName: string;
  supportEmail?: string;
  termsUrl?: string;
  privacyUrl?: string;
}

export function LandingFooter({ 
  appName, 
  supportEmail = "suporte@uz4flow.lovable.app",
  termsUrl = "/termos",
  privacyUrl = "/privacidade"
}: LandingFooterProps) {
  const branding = useBranding();
  const socialLinks = branding?.social_links;
  const currentYear = new Date().getFullYear();

  return (
    <footer className="quantum-glass-strong text-sidebar-foreground py-16 overflow-hidden" style={{ borderTop: '1px solid transparent', borderImage: 'linear-gradient(135deg, hsl(180 100% 50%), hsl(272 100% 50%)) 1' }}>
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          {/* Brand */}
          <div className="md:col-span-1">
            <Link to="/conheca" className="flex items-center gap-2 mb-4">
              <img src="/favicon.png" alt={appName} className="w-8 h-8 object-contain" />
              <span className="text-xl font-bold">{appName}</span>
            </Link>
            <p className="text-sidebar-foreground/70 text-sm mb-4 font-terminal">
              Automatize seu WhatsApp Business e escale seu atendimento com inteligência.
            </p>
            <div className="flex items-center gap-4">
              {socialLinks?.instagram && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground/70 hover:text-accent transition-colors text-glow-cyan">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {socialLinks?.youtube && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground/70 hover:text-accent transition-colors text-glow-cyan">
                  <Youtube className="w-5 h-5" />
                </a>
              )}
              {socialLinks?.linkedin && (
                <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-sidebar-foreground/70 hover:text-accent transition-colors text-glow-cyan">
                  <Linkedin className="w-5 h-5" />
                </a>
              )}
            </div>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-semibold mb-4 uppercase tracking-wider text-sm">Produto</h4>
            <ul className="space-y-3">
              <li><a href="#showcase" onClick={(e) => { e.preventDefault(); document.querySelector('#showcase')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors font-terminal text-xs cursor-pointer">Recursos</a></li>
              <li><a href="#pricing" onClick={(e) => { e.preventDefault(); document.querySelector('#pricing')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors font-terminal text-xs cursor-pointer">Preços</a></li>
              <li><a href="#faq" onClick={(e) => { e.preventDefault(); document.querySelector('#faq')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors font-terminal text-xs cursor-pointer">FAQ</a></li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h4 className="font-semibold mb-4 uppercase tracking-wider text-sm">Suporte</h4>
            <ul className="space-y-3">
              <li><a href="#faq" onClick={(e) => { e.preventDefault(); document.querySelector('#faq')?.scrollIntoView({ behavior: 'smooth' }); }} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors font-terminal text-xs cursor-pointer">Perguntas Frequentes</a></li>
              <li>
                <a href={`mailto:${supportEmail}`} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors font-terminal text-xs flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Contato
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold mb-4 uppercase tracking-wider text-sm">Legal</h4>
            <ul className="space-y-3">
              <li><Link to={termsUrl} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors font-terminal text-xs">Termos de Uso</Link></li>
              <li><Link to={privacyUrl} className="text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors font-terminal text-xs">Política de Privacidade</Link></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-sidebar-border pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sidebar-foreground/70 text-xs font-terminal">
            © {currentYear} {appName}. Todos os direitos reservados.
          </p>
          <div className="flex items-center gap-2 text-sidebar-foreground/70 text-xs font-terminal">
            <MessageCircle className="w-4 h-4" />
            <span>Feito com</span>
            <Heart className="w-4 h-4 text-destructive fill-destructive text-glow-pink" />
            <span>para automatizar seu WhatsApp</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
