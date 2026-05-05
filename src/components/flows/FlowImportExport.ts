import { supabase } from "@/integrations/supabase/client";

export interface FlowExportData {
  version: 1;
  flow: {
    name: string;
    description: string | null;
    is_interactive: boolean;
    session_timeout_minutes: number;
    timeout_action: string;
    timeout_message: string | null;
  };
  steps: Array<{
    order_index: number;
    step_type: string;
    text_content: string | null;
    delay_ms: number;
    requires_response: boolean;
    variable_name: string | null;
    validation_type: string;
    invalid_response_message: string | null;
    step_timeout_minutes: number | null;
    accept_file_response: boolean;
    position_x: number | null;
    position_y: number | null;
    condition_config: any | null;
  }>;
  connections: Array<{
    source_step_index: number;
    target_step_index: number;
    source_handle: string;
    label: string | null;
  }>;
}

export async function exportFlow(flowId: string): Promise<FlowExportData | null> {
  const { data: flow } = await supabase
    .from("flows")
    .select("name, description, is_interactive, session_timeout_minutes, timeout_action, timeout_message")
    .eq("id", flowId)
    .single();

  if (!flow) return null;

  const { data: steps } = await supabase
    .from("flow_steps")
    .select("order_index, step_type, text_content, delay_ms, requires_response, variable_name, validation_type, invalid_response_message, step_timeout_minutes, accept_file_response, position_x, position_y, condition_config, id")
    .eq("flow_id", flowId)
    .order("order_index");

  if (!steps) return null;

  const { data: connections } = await supabase
    .from("flow_connections")
    .select("source_step_id, target_step_id, source_handle, label")
    .eq("flow_id", flowId);

  const stepIdToIndex = new Map(steps.map((s: any) => [s.id, s.order_index]));

  const exportConnections = (connections || []).map((c: any) => ({
    source_step_index: stepIdToIndex.get(c.source_step_id) ?? 0,
    target_step_index: stepIdToIndex.get(c.target_step_id) ?? 0,
    source_handle: c.source_handle,
    label: c.label,
  }));

  const exportSteps = steps.map(({ id, ...rest }: any) => rest);

  return {
    version: 1,
    flow,
    steps: exportSteps,
    connections: exportConnections,
  };
}

export function downloadJson(data: FlowExportData, fileName: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function validateImport(data: any): data is FlowExportData {
  return (
    data &&
    data.version === 1 &&
    data.flow &&
    Array.isArray(data.steps) &&
    Array.isArray(data.connections)
  );
}

export async function importFlowSteps(
  flowId: string,
  data: FlowExportData,
  mode: "replace" | "merge"
): Promise<boolean> {
  try {
    if (mode === "replace") {
      // Delete existing connections and steps
      await supabase.from("flow_connections").delete().eq("flow_id", flowId);
      await supabase.from("flow_steps").delete().eq("flow_id", flowId);
    }

    // Get offset for merge mode
    let orderOffset = 0;
    let posYOffset = 0;
    if (mode === "merge") {
      const { data: existing } = await supabase
        .from("flow_steps")
        .select("order_index, position_y")
        .eq("flow_id", flowId)
        .order("order_index", { ascending: false })
        .limit(1);
      if (existing && existing.length > 0) {
        orderOffset = existing[0].order_index + 1;
        posYOffset = (existing[0].position_y ?? 0) + 200;
      }
    }

    // Insert steps
    const stepsToInsert = data.steps.map((s) => ({
      flow_id: flowId,
      order_index: s.order_index + orderOffset,
      step_type: s.step_type,
      text_content: s.text_content,
      delay_ms: s.delay_ms,
      requires_response: s.requires_response,
      variable_name: s.variable_name,
      validation_type: s.validation_type,
      invalid_response_message: s.invalid_response_message,
      step_timeout_minutes: s.step_timeout_minutes,
      accept_file_response: s.accept_file_response,
      position_x: s.position_x,
      position_y: (s.position_y ?? 0) + posYOffset,
      condition_config: s.condition_config,
      ...((s as any).menu_config ? { menu_config: (s as any).menu_config } : {}),
      ...((s as any).delay_config ? { delay_config: (s as any).delay_config } : {}),
      ...((s as any).tag_config ? { tag_config: (s as any).tag_config } : {}),
      ...((s as any).lane_config ? { lane_config: (s as any).lane_config } : {}),
      ...((s as any).end_config ? { end_config: (s as any).end_config } : {}),
      ...((s as any).block_contents ? { block_contents: (s as any).block_contents } : {}),
      ...((s as any).random_config ? { random_config: (s as any).random_config } : {}),
      ...((s as any).active_message_config ? { active_message_config: (s as any).active_message_config } : {}),
    }));

    const { data: insertedSteps, error: stepsError } = await supabase
      .from("flow_steps")
      .insert(stepsToInsert)
      .select("id, order_index");

    if (stepsError) throw stepsError;
    if (!insertedSteps) throw new Error("No steps inserted");

    // Map order_index (with offset) to new ID
    const indexToId = new Map(insertedSteps.map((s) => [s.order_index, s.id]));

    // Insert connections
    if (data.connections.length > 0) {
      const connsToInsert = data.connections
        .map((c) => ({
          flow_id: flowId,
          source_step_id: indexToId.get(c.source_step_index + orderOffset) || "",
          target_step_id: indexToId.get(c.target_step_index + orderOffset) || "",
          source_handle: c.source_handle,
          label: c.label,
        }))
        .filter((c) => c.source_step_id && c.target_step_id);

      if (connsToInsert.length > 0) {
        const { error: connError } = await supabase
          .from("flow_connections")
          .insert(connsToInsert);
        if (connError) throw connError;
      }
    }

    return true;
  } catch (error) {
    console.error("Import error:", error);
    return false;
  }
}
