import { Component, ErrorInfo, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Generic error boundary. Wrap critical UI sections (CRM, Kanban, etc.)
 * to prevent a thrown error from rendering a blank page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", this.props.label || "", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center gap-3">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <h2 className="text-lg font-semibold text-foreground">
            Algo deu errado ao carregar esta área
          </h2>
          <p className="text-sm text-muted-foreground max-w-md">
            {this.state.error?.message || "Erro inesperado."} Tente recarregar a página.
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={this.reset}>Tentar novamente</Button>
            <Button onClick={() => window.location.reload()}>Recarregar página</Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
