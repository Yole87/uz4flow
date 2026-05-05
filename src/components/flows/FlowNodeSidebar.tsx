import { MessageSquare, FileText, GitBranch, Layers, CircleStop, Tag, ListOrdered, Send, Shuffle, Clock, List, Phone } from "lucide-react";

const COMPONENT_NODES = [
  { type: "text", label: "Mensagem", icon: MessageSquare, color: "bg-accent text-accent-foreground", description: "Enviar texto" },
  { type: "file", label: "Arquivo", icon: FileText, color: "bg-primary text-primary-foreground", description: "Enviar mídia" },
  { type: "block", label: "Bloco", icon: Layers, color: "bg-warning text-warning-foreground", description: "Multi-conteúdo" },
  { type: "active_message", label: "Msg Ativa", icon: Send, color: "bg-success text-success-foreground", description: "Envio proativo" },
];

const LOGIC_NODES = [
  { type: "condition", label: "Se/Então", icon: GitBranch, color: "bg-warning text-warning-foreground", description: "IF / ELSE" },
  { type: "random", label: "Aleatório", icon: Shuffle, color: "bg-warning text-warning-foreground", description: "Divisão randômica" },
  { type: "delay", label: "Intervalo", icon: Clock, color: "bg-muted text-muted-foreground", description: "Pausar execução" },
  { type: "menu", label: "Menu", icon: List, color: "bg-primary text-primary-foreground", description: "Opções interativas" },
];

const ACTION_NODES = [
  { type: "tag", label: "Tag", icon: Tag, color: "bg-success text-success-foreground", description: "Adicionar / Remover" },
  { type: "lane", label: "Lane", icon: ListOrdered, color: "bg-success text-success-foreground", description: "Mover no Kanban" },
  { type: "voice_call", label: "Chamada IA", icon: Phone, color: "bg-primary text-primary-foreground", description: "Ligação Voice AI" },
  { type: "end", label: "Fim", icon: CircleStop, color: "bg-destructive text-destructive-foreground", description: "Encerrar fluxo" },
];

const SECTIONS = [
  { title: "Componentes", nodes: COMPONENT_NODES },
  { title: "Lógica", nodes: LOGIC_NODES },
  { title: "Ações", nodes: ACTION_NODES },
];

export function FlowNodeSidebar() {
  const onDragStart = (event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData("application/reactflow-type", nodeType);
    event.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="w-[200px] shrink-0 quantum-glass rounded-lg p-3 space-y-2 overflow-y-auto">
      {SECTIONS.map((section) => (
        <div key={section.title}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1 mt-3 mb-1.5">
            {section.title}
          </h3>
          {section.nodes.map((node) => (
            <div
              key={node.type}
              draggable
              onDragStart={(e) => onDragStart(e, node.type)}
              className="flex items-center gap-3 p-2.5 rounded-md border border-border/50 bg-card/50 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-card transition-all group mb-1.5"
            >
              <div className={`${node.color} rounded p-1.5 shrink-0`}>
                <node.icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium text-foreground leading-tight">{node.label}</p>
                <p className="text-xs text-muted-foreground leading-tight">{node.description}</p>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
