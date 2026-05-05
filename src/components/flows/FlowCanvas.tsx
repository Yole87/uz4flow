import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
  Controls,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnConnect,
  type OnEdgesDelete,
  type OnReconnect,
  addEdge,
  reconnectEdge,
  BackgroundVariant,
  ConnectionMode,
  MarkerType,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { FlowStepNode } from "./FlowStepNode";
import { ConditionNode } from "./ConditionNode";
import { FlowBlockNode } from "./FlowBlockNode";
import { EndNode } from "./EndNode";
import { TagNode } from "./TagNode";
import { LaneNode } from "./LaneNode";
import { ActiveMessageNode } from "./ActiveMessageNode";
import { RandomNode } from "./RandomNode";
import { DelayNode } from "./DelayNode";
import { MenuNode } from "./MenuNode";
import { TriggerNode } from "./TriggerNode";
import { VoiceCallNode } from "./VoiceCallNode";
import { FlowNodeSidebar } from "./FlowNodeSidebar";
import {
  stepsToNodes,
  stepsToEdges,
  connectionsToEdges,
  type FlowStepData,
  type FlowConnectionData,
} from "./flowCanvasUtils";
import { supabase } from "@/integrations/supabase/client";

const nodeTypes = { flowStep: FlowStepNode, condition: ConditionNode, blockNode: FlowBlockNode, endNode: EndNode, tagNode: TagNode, laneNode: LaneNode, activeMessageNode: ActiveMessageNode, randomNode: RandomNode, delayNode: DelayNode, menuNode: MenuNode, triggerNode: TriggerNode, voiceCallNode: VoiceCallNode };

interface FlowCanvasProps {
  steps: FlowStepData[];
  connections: FlowConnectionData[];
  flowId: string;
  onNodeClick: (stepId: string) => void;
  onAddStep: () => void;
  onAddCondition?: () => void;
  onDeleteStep: (stepId: string) => void;
  onConnectionsChange?: () => void;
  onDropNewNode?: (type: string, position: { x: number; y: number }) => void;
  toolbarSlot?: React.ReactNode;
  onTriggerClick?: () => void;
  triggerData?: {
    scheduleEnabled?: boolean;
    scheduleType?: string | null;
    scheduleConfig?: any;
    isDefault?: boolean;
    routingRules?: { match_type: string; match_value: string }[];
    hasConflicts?: boolean;
  };
  aiPanelOpen?: boolean;
  onToggleAI?: () => void;
  aiPanelSlot?: React.ReactNode;
}

function FlowCanvasInner({
  steps,
  connections,
  flowId,
  onNodeClick,
  onAddStep,
  onAddCondition,
  onDeleteStep,
  onConnectionsChange,
  onDropNewNode,
  toolbarSlot,
  onTriggerClick,
  triggerData,
  aiPanelOpen,
  onToggleAI,
  aiPanelSlot,
}: FlowCanvasProps) {
  // Track whether connections have ever been loaded from DB
  const hasDbConnections = useRef(false);
  if (connections.length > 0) hasDbConnections.current = true;

  // Track previous data to avoid unnecessary resets
  const prevConnectionsRef = useRef<string>("");
  const prevStepsRef = useRef<string>("");

  const buildEdges = useCallback(
    () => connections.length > 0 ? connectionsToEdges(connections) : hasDbConnections.current ? [] : stepsToEdges(steps),
    [connections, steps]
  );

  const triggerNode: Node = useMemo(() => ({
    id: "__trigger__",
    type: "triggerNode",
    position: { x: 0, y: -150 },
    draggable: true,
    deletable: false,
    data: {
      ...triggerData,
      onClick: onTriggerClick,
    },
  }), [triggerData, onTriggerClick]);

  const initialNodes = useMemo(() => [triggerNode, ...stepsToNodes(steps, onDeleteStep)], [steps, onDeleteStep, triggerNode]);
  const initialEdges = useMemo(() => buildEdges(), [buildEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const positionUpdateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const connectionStartRef = useRef<{
    nodeId: string | null;
    handleId: string | null;
    handleType: "source" | "target" | null;
  } | null>(null);

  // Sync nodes when steps or delete callback change
  useEffect(() => {
    setNodes([triggerNode, ...stepsToNodes(steps, onDeleteStep)]);
  }, [steps, setNodes, onDeleteStep, triggerNode]);

  // Sync edges only when connections/steps DATA actually changes
  useEffect(() => {
    const connKey = connections.map(c => c.id).sort().join(",");
    const stepsKey = steps.map(s => s.id).join(",");
    if (connKey === prevConnectionsRef.current && stepsKey === prevStepsRef.current) return;
    prevConnectionsRef.current = connKey;
    prevStepsRef.current = stepsKey;
    setEdges(buildEdges());
  }, [steps, connections, setEdges, buildEdges]);

  const handleNodesChange: OnNodesChange = useCallback(
    (changes) => {
      onNodesChange(changes);
      const positionChanges = changes.filter(
        (c) => c.type === "position" && (c as any).dragging === false
      );
      if (positionChanges.length > 0) {
        if (positionUpdateTimer.current) clearTimeout(positionUpdateTimer.current);
        positionUpdateTimer.current = setTimeout(() => {
          setNodes((currentNodes) => {
            for (const node of currentNodes) {
              if (node.id === "__trigger__") continue;
              supabase
                .from("flow_steps")
                .update({ position_x: node.position.x, position_y: node.position.y })
                .eq("id", node.id)
                .then();
            }
            return currentNodes;
          });
        }, 500);
      }
    },
    [onNodesChange, setNodes]
  );

  // Detect if a handle is an output (source) handle
  const isOutputHandle = useCallback((h: string | null | undefined): boolean => {
    const handle = h || "default";
    return handle === "default" || handle.startsWith("source") || handle === "true" || handle === "false" || handle.startsWith("split-") || handle.startsWith("option-") || handle.startsWith("voice-");
  }, []);

  const isInputHandle = useCallback((h: string | null | undefined): boolean => {
    const handle = h || "target";
    return handle === "target" || handle.startsWith("target");
  }, []);

  const getFallbackSourceHandle = useCallback((nodeId: string | null | undefined, preferredTargetHandle: string | null | undefined) => {
    if (!nodeId) return null;
    const nodeType = nodes.find((node) => node.id === nodeId)?.type;
    if (nodeType === "endNode") return null;
    if (nodeType === "condition") return "source-right";
    return preferredTargetHandle === "target-left" ? "source-right" : "default";
  }, [nodes]);

  // Normalize connection direction based on the actual node where the drag started.
  // In Loose mode React Flow may swap source/target when the gesture starts from an input handle.
  const normalizeConnection = useCallback((params: { source: string | null; target: string | null; sourceHandle: string | null | undefined; targetHandle: string | null | undefined }) => {
    let { source, target, sourceHandle, targetHandle } = params;
    const dragStart = connectionStartRef.current;

    if (dragStart?.nodeId && target === dragStart.nodeId && source !== dragStart.nodeId) {
      [source, target] = [target, source];
      [sourceHandle, targetHandle] = [targetHandle, sourceHandle];
    }

    if (!source || !target) return null;

    const normalizedTargetHandle = isInputHandle(targetHandle)
      ? targetHandle || "target"
      : "target";

    let normalizedSourceHandle = sourceHandle;

    if (dragStart?.nodeId === source && dragStart.handleId && isOutputHandle(dragStart.handleId)) {
      normalizedSourceHandle = dragStart.handleId;
    }

    if (!isOutputHandle(normalizedSourceHandle)) {
      normalizedSourceHandle = getFallbackSourceHandle(source, normalizedTargetHandle);
    }

    if (!normalizedSourceHandle || !isOutputHandle(normalizedSourceHandle) || !isInputHandle(normalizedTargetHandle)) {
      return null;
    }

    return {
      source,
      target,
      sourceHandle: normalizedSourceHandle,
      targetHandle: normalizedTargetHandle,
    };
  }, [getFallbackSourceHandle, isInputHandle, isOutputHandle]);

  const handleConnectStart = useCallback((_: MouseEvent | TouchEvent, params: { nodeId?: string | null; handleId?: string | null; handleType?: "source" | "target" | null }) => {
    connectionStartRef.current = {
      nodeId: params.nodeId ?? null,
      handleId: params.handleId ?? null,
      handleType: params.handleType ?? null,
    };
  }, []);

  const handleConnectEnd = useCallback(() => {
    connectionStartRef.current = null;
  }, []);

  const onConnect: OnConnect = useCallback(
    async (params) => {
      if (!params.source || !params.target) {
        connectionStartRef.current = null;
        return;
      }

      const normalized = normalizeConnection(params);
      if (!normalized || !normalized.source || !normalized.target) {
        connectionStartRef.current = null;
        return;
      }

      const { source, target, sourceHandle, targetHandle } = normalized;

      const newEdge: Edge = {
        id: `temp-${Date.now()}`,
        source,
        target,
        sourceHandle,
        targetHandle,
        type: "smoothstep",
        style: { stroke: "hsl(338 100% 53%)", strokeWidth: 2 },
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(338 100% 53%)", width: 16, height: 16 },
        ...(sourceHandle === "true"
          ? { label: "Sim", labelStyle: { fill: "#22c55e", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#22c55e" } }
          : sourceHandle === "false"
          ? { label: "Não", labelStyle: { fill: "#ef4444", fontWeight: 600, fontSize: 10 }, labelBgStyle: { fill: "rgba(20,20,30,0.9)", stroke: "#ef4444" } }
          : {}),
      };
      setEdges((eds) => addEdge(newEdge, eds));

      const { data, error } = await supabase
        .from("flow_connections")
        .insert({
          flow_id: flowId,
          source_step_id: source,
          target_step_id: target,
          source_handle: sourceHandle,
        })
        .select("id")
        .single();

      connectionStartRef.current = null;

      if (error) {
        setEdges((eds) => eds.filter((e) => e.id !== newEdge.id));
        return;
      }
      if (data) {
        setEdges((eds) => eds.map((e) => (e.id === newEdge.id ? { ...e, id: data.id } : e)));
      }

      onConnectionsChange?.();
    },
    [flowId, setEdges, onConnectionsChange, normalizeConnection]
  );

  const edgeReconnectSuccessful = useRef(true);

  const onReconnectStart = useCallback(() => {
    edgeReconnectSuccessful.current = false;
  }, []);

  const onReconnect: OnReconnect = useCallback(
    (oldEdge, newConnection) => {
      edgeReconnectSuccessful.current = true;

      // Normalize direction for reconnections too
      const normalized = normalizeConnection(newConnection);
      const conn = normalized || {
        source: newConnection.source,
        target: newConnection.target,
        sourceHandle: newConnection.sourceHandle || "default",
        targetHandle: newConnection.targetHandle || "target",
      };

      setEdges((eds) => reconnectEdge(oldEdge, { ...newConnection, ...conn }, eds));

      // Delete old connection, insert new one
      (async () => {
        if (!oldEdge.id.startsWith("e-") && !oldEdge.id.startsWith("temp-")) {
          await supabase.from("flow_connections").delete().eq("id", oldEdge.id);
        }
        const { data } = await supabase
          .from("flow_connections")
          .insert({
            flow_id: flowId,
            source_step_id: conn.source!,
            target_step_id: conn.target!,
            source_handle: conn.sourceHandle || "default",
          })
          .select("id")
          .single();

        if (data) {
          setEdges((eds) =>
            eds.map((e) =>
              e.source === conn.source &&
              e.target === conn.target &&
              e.sourceHandle === (conn.sourceHandle || "default")
                ? { ...e, id: data.id }
                : e
            )
          );
        }

        onConnectionsChange?.();
      })();
    },
    [flowId, setEdges, onConnectionsChange, normalizeConnection]
  );

  const onReconnectEnd = useCallback(
    (_: MouseEvent | TouchEvent, edge: Edge) => {
      if (!edgeReconnectSuccessful.current) {
        // User dropped into empty space — remove the edge
        setEdges((eds) => eds.filter((e) => e.id !== edge.id));
        if (!edge.id.startsWith("e-") && !edge.id.startsWith("temp-")) {
          supabase.from("flow_connections").delete().eq("id", edge.id).then();
        }
        onConnectionsChange?.();
      }
      edgeReconnectSuccessful.current = true;
    },
    [setEdges, onConnectionsChange]
  );

  const onEdgesDelete: OnEdgesDelete = useCallback(
    async (deletedEdges) => {
      for (const edge of deletedEdges) {
        if (edge.id.startsWith("e-") || edge.id.startsWith("temp-")) continue;
        await supabase.from("flow_connections").delete().eq("id", edge.id);
      }
      onConnectionsChange?.();
    },
    [setEdges, onConnectionsChange]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => { onNodeClick(node.id); },
    [onNodeClick]
  );

  const handleEdgeClick = useCallback(
    async (_: React.MouseEvent, edge: Edge) => {
      if (edge.id.startsWith("e-") || edge.id.startsWith("temp-")) return;
      if (!confirm("Excluir esta conexão?")) return;
      setEdges((eds) => eds.filter((e) => e.id !== edge.id));
      await supabase.from("flow_connections").delete().eq("id", edge.id);
      onConnectionsChange?.();
    },
    [setEdges, onConnectionsChange]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
  }, []);

  const { screenToFlowPosition } = useReactFlow();

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const type = event.dataTransfer.getData("application/reactflow-type");
      if (!type) return;

      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      onDropNewNode?.(type, position);
    },
    [onDropNewNode, screenToFlowPosition]
  );

  return (
    <div className="flex gap-0 w-full" style={{ height: "calc(100vh - 280px)", minHeight: "500px" }}>
      <FlowNodeSidebar />
      <div
        ref={reactFlowWrapper}
        className="flex-1 rounded-lg overflow-hidden border border-border/50 quantum-glass relative"
      >
        {toolbarSlot && (
          <div className="absolute top-3 right-3 z-10">
            {toolbarSlot}
          </div>
        )}
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnectStart={handleConnectStart}
          onConnectEnd={handleConnectEnd}
          onConnect={onConnect}
          onReconnect={onReconnect}
          onReconnectStart={onReconnectStart}
          onReconnectEnd={onReconnectEnd}
          onEdgesDelete={onEdgesDelete}
          onNodeClick={handleNodeClick}
          onEdgeClick={handleEdgeClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          edgesReconnectable
          edgesFocusable
          elementsSelectable
          snapToGrid
          snapGrid={[20, 20]}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          deleteKeyCode={["Backspace", "Delete"]}
          proOptions={{ hideAttribution: true }}
          className="flow-canvas-quantum"
          defaultEdgeOptions={{
            type: "smoothstep",
            animated: true,
            selectable: true,
            focusable: true,
            style: { stroke: "hsl(338 100% 53%)", strokeWidth: 2 },
            markerEnd: { type: MarkerType.ArrowClosed, color: "hsl(338 100% 53%)", width: 16, height: 16 },
          }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1}
            color="hsl(240 6% 25%)"
          />
          <MiniMap
            nodeColor="hsl(338 100% 53%)"
            maskColor="rgba(5, 5, 15, 0.7)"
            style={{
              backgroundColor: "rgba(20, 20, 30, 0.8)",
              borderRadius: "8px",
              border: "1px solid hsl(240 6% 20%)",
            }}
          />
          <Controls
            showInteractive={false}
            className="flow-controls-quantum"
          />
        </ReactFlow>
      </div>
      {aiPanelSlot}
    </div>
  );
}

export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
