import type { Node, Edge } from "@xyflow/react";

export interface FlowStepData {
  id: string;
  order_index: number;
  step_type: string;
  text_content: string | null;
  delay_ms: number;
  requires_response: boolean;
  variable_name: string | null;
  validation_type: string;
  accept_file_response: boolean;
  position_x?: number;
  position_y?: number;
  file?: { file_name: string; mime_type: string } | null;
  isLast?: boolean;
  condition_config?: {
    variable: string;
    operator: string;
    value: string;
  } | null;
  block_contents?: any[] | null;
}

export interface FlowConnectionData {
  id: string;
  source_step_id: string;
  target_step_id: string;
  source_handle: string;
  label?: string | null;
}

const EDGE_STYLE = { stroke: "hsl(338 100% 53%)", strokeWidth: 2 };

export function stepsToNodes(steps: FlowStepData[], onDeleteStep?: (id: string) => void): Node[] {
  return steps.map((step, index) => ({
    id: step.id,
    type: step.step_type === "condition" ? "condition" : step.step_type === "block" ? "blockNode" : step.step_type === "end" ? "endNode" : step.step_type === "tag" ? "tagNode" : step.step_type === "lane" ? "laneNode" : step.step_type === "active_message" ? "activeMessageNode" : step.step_type === "random" ? "randomNode" : step.step_type === "delay" ? "delayNode" : step.step_type === "menu" ? "menuNode" : step.step_type === "voice_call" ? "voiceCallNode" : "flowStep",
    position: {
      x: step.position_x ?? 250,
      y: step.position_y ?? index * 180,
    },
    data: {
      ...step,
      isLast: index === steps.length - 1,
      onDelete: onDeleteStep,
    },
  }));
}

/** Convert DB flow_connections rows into React Flow edges */
export function connectionsToEdges(connections: FlowConnectionData[]): Edge[] {
  // Filter out invalid connections where source_handle is a target handle
  const valid = connections.filter((c) => !c.source_handle.startsWith("target"));
  return valid.map((conn) => ({
    id: conn.id,
    source: conn.source_step_id,
    target: conn.target_step_id,
    sourceHandle: conn.source_handle || "default",
    targetHandle: conn.source_handle === "source-right" ? "target-left" : "target",
    type: "smoothstep",
    style: EDGE_STYLE,
    animated: true,
    selectable: true,
    focusable: true,
    reconnectable: true,
    interactionWidth: 20,
    markerEnd: { type: "arrowclosed" as any, color: "hsl(338 100% 53%)", width: 16, height: 16 },
    ...(conn.source_handle === "true"
      ? { label: "Sim", labelStyle: { fill: "#22c55e", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#22c55e" } }
      : conn.source_handle === "false"
      ? { label: "Não", labelStyle: { fill: "#ef4444", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#ef4444" } }
       : conn.source_handle.startsWith("split-")
       ? { label: conn.label || conn.source_handle.replace("split-", ""), labelStyle: { fill: "#f59e0b", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#f59e0b" } }
       : conn.source_handle.startsWith("option-")
       ? { label: conn.label || `Resp ${parseInt(conn.source_handle.replace("option-", "")) + 1}`, labelStyle: { fill: "#818cf8", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#818cf8" } }
       : conn.source_handle === "voice-answered"
       ? { label: "Atendida", labelStyle: { fill: "#10b981", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#10b981" } }
       : conn.source_handle === "voice-voicemail"
       ? { label: "Caixa postal", labelStyle: { fill: "#f59e0b", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#f59e0b" } }
       : conn.source_handle === "voice-no-answer"
       ? { label: "Não atendeu", labelStyle: { fill: "#ef4444", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#ef4444" } }
       : {}),
    ...(conn.label ? { label: conn.label } : {}),
  }));
}

/** Fallback: generate linear edges from order_index when no connections exist */
export function stepsToEdges(steps: FlowStepData[]): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < steps.length - 1; i++) {
    edges.push({
      id: `e-${steps[i].id}-${steps[i + 1].id}`,
      source: steps[i].id,
      target: steps[i + 1].id,
      sourceHandle: "default",
      targetHandle: "target",
      type: "smoothstep",
      style: EDGE_STYLE,
      animated: true,
      selectable: true,
      focusable: true,
      interactionWidth: 20,
    });
  }
  return edges;
}

export function recalculateOrderFromEdges(
  nodes: Node[],
  edges: Edge[]
): { id: string; order_index: number }[] {
  const adj = new Map<string, string>();
  const hasIncoming = new Set<string>();

  for (const edge of edges) {
    // Only follow "default" or "true" handles for linear ordering
    if (!adj.has(edge.source)) {
      adj.set(edge.source, edge.target);
    }
    hasIncoming.add(edge.target);
  }

  const nodeIds = new Set(nodes.map((n) => n.id));
  let root: string | null = null;
  for (const id of nodeIds) {
    if (!hasIncoming.has(id)) {
      root = id;
      break;
    }
  }

  const ordered: { id: string; order_index: number }[] = [];
  let current = root;
  let idx = 0;
  const visited = new Set<string>();

  while (current && !visited.has(current)) {
    visited.add(current);
    ordered.push({ id: current, order_index: idx++ });
    current = adj.get(current) || null;
  }

  for (const id of nodeIds) {
    if (!visited.has(id)) {
      ordered.push({ id, order_index: idx++ });
    }
  }

  return ordered;
}
