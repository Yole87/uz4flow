import { Link, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative overflow-hidden">
      {/* Neon orb decorations */}
      <div className="absolute top-1/4 right-1/4 w-64 h-64 rounded-full bg-primary/15 blur-3xl animate-glow-pulse" />
      <div className="absolute bottom-1/4 left-1/3 w-48 h-48 rounded-full bg-accent/10 blur-3xl animate-glow-pulse" style={{ animationDelay: '1s' }} />

      <div className="text-center relative z-10">
        <h1 className="text-8xl md:text-9xl font-bold text-gradient-primary text-glow-pink font-heading leading-none mb-4">
          404
        </h1>
        <p className="mb-8 text-xl font-terminal text-muted-foreground tracking-widest uppercase">
          Rota não encontrada
        </p>
        <Button asChild className="gradient-primary btn-laser-cut neon-glow-pink px-8 py-6 text-lg">
          <Link to="/dashboard">
            <ArrowLeft className="h-5 w-5 mr-2" />
            Voltar ao início
          </Link>
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
