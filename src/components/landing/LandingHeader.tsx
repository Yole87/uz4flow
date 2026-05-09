import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Zap, LayoutDashboard, LogOut, User, Menu, X, Handshake } from "lucide-react";
import { useAuth } from "@/lib/auth";

interface LandingHeaderProps {
  appName: string;
}

const navLinks = [
  { href: "#showcase", label: "Recursos" },
  { href: "#how-it-works", label: "Como Funciona" },
  { href: "#integrations", label: "Integrações" },
  { href: "#pricing", label: "Preços" },
  { href: "#faq", label: "FAQ" },
];

function smoothScrollTo(hash: string) {
  const el = document.querySelector(hash);
  if (el) {
    const headerOffset = 80;
    const top = el.getBoundingClientRect().top + window.pageYOffset - headerOffset;
    window.scrollTo({ top, behavior: "smooth" });
  }
}

export function LandingHeader({ appName }: LandingHeaderProps) {
  const { user, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
  };

  const getUserInitials = () => {
    if (!user?.email) return "U";
    return user.email.charAt(0).toUpperCase();
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    smoothScrollTo(href);
    setMobileOpen(false);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 header-quantum">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/conheca" className="flex items-center gap-2">
          <img src="/favicon.png" alt={appName} className="w-8 h-8 object-contain" />
          <span className="text-xl font-bold text-foreground">{appName}</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              onClick={(e) => handleNavClick(e, link.href)}
              className="font-terminal text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors nav-item-neon"
            >
              {link.label}
            </a>
          ))}
        </nav>

        {/* Holographic separator */}
        <div className="hidden md:block h-6 w-px mx-4" style={{ background: 'linear-gradient(180deg, transparent, hsl(180 100% 50% / 0.4), hsl(272 100% 50% / 0.4), transparent)' }} />

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/dashboard" className="flex items-center gap-2">
                  <LayoutDashboard className="w-4 h-4" />
                  <span className="hidden sm:inline">Dashboard</span>
                </Link>
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback className="bg-primary/10 text-primary text-sm">
                        {getUserInitials()}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem className="text-muted-foreground text-sm" disabled>
                    <User className="w-4 h-4 mr-2" />
                    {user.email}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : (
            <>
              <Button variant="ghost" asChild size="sm" className="text-xs sm:text-sm px-2 sm:px-4 hidden md:inline-flex">
                <Link to="/affiliates/onboarding" className="flex items-center gap-1">
                  <Handshake className="w-4 h-4" />
                  Seja Afiliado
                </Link>
              </Button>
              <Button variant="ghost" asChild size="sm" className="text-xs sm:text-sm px-2 sm:px-4 hidden sm:inline-flex">
                <Link to="/">Entrar</Link>
              </Button>
              <Button asChild size="sm" className="gradient-primary border-0 btn-laser-cut text-xs sm:text-sm px-3 sm:px-4 hidden sm:inline-flex">
                <Link to="/?tab=signup">Criar Conta</Link>
              </Button>
            </>
          )}

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Fechar menu" : "Abrir menu"}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-xl animate-in slide-in-from-top-2 duration-200">
          <nav className="container mx-auto px-4 py-4 flex flex-col gap-3">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={(e) => handleNavClick(e, link.href)}
                className="font-terminal text-xs uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors py-2"
              >
                {link.label}
              </a>
            ))}
            {!user && (
              <div className="flex gap-3 pt-3 border-t border-border/30">
                <Button variant="ghost" asChild size="sm" className="flex-1 text-xs">
                  <Link to="/" onClick={() => setMobileOpen(false)}>Entrar</Link>
                </Button>
                <Button asChild size="sm" className="flex-1 gradient-primary border-0 btn-laser-cut text-xs">
                  <Link to="/?tab=signup" onClick={() => setMobileOpen(false)}>Criar Conta</Link>
                </Button>
              </div>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
