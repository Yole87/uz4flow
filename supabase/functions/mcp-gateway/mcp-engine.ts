/**
 * Openbot MCP Gateway - MCP Engine Service
 * 
 * Connects to external MCP servers via SSE transport, executes tools,
 * and returns the results. Uses the official @modelcontextprotocol/sdk.
 * 
 * 100% ISOLATED - Does not depend on or affect any existing CRM code.
 */

import { Client } from "npm:@modelcontextprotocol/sdk@1.12.1/client/index.js";
import { SSEClientTransport } from "npm:@modelcontextprotocol/sdk@1.12.1/client/sse.js";
import type { StandardizedMessage } from "./openbot.types.ts";

const MCP_TIMEOUT_MS = 30_000;

/**
 * Connects to an external MCP server via SSE, calls a tool, and returns
 * the result. Implements a 30-second timeout and safe disconnection.
 */
export async function connectAndExecute(
  targetMcpUrl: string,
  toolName: string,
  messageData: StandardizedMessage,
  authOptions?: {
    authType?: string;
    authToken?: string;
    customHeaders?: Record<string, string>;
  }
): Promise<any> {
  console.log(
    `[MCP-Gateway] Connecting to MCP server: ${targetMcpUrl}, tool: ${toolName}`
  );

  // Build auth headers if configured
  const headers: Record<string, string> = {};
  if (authOptions?.authType === "api_key" && authOptions.authToken) {
    headers["Authorization"] = `Bearer ${authOptions.authToken}`;
  } else if (authOptions?.authType === "custom_headers" && authOptions.customHeaders) {
    Object.assign(headers, authOptions.customHeaders);
  }

  const transportOptions: any = {};
  if (Object.keys(headers).length > 0) {
    transportOptions.requestInit = { headers };
  }

  const transport = new SSEClientTransport(new URL(targetMcpUrl), transportOptions);
  const client = new Client(
    { name: "Openbot-MCP-Gateway", version: "1.0.0" },
    { capabilities: {} }
  );

  try {
    // Connect with timeout
    await Promise.race([
      client.connect(transport),
      timeout(MCP_TIMEOUT_MS, "Timeout connecting to MCP server"),
    ]);

    console.log("[MCP-Gateway] Connected to MCP server successfully");

    // Build tool arguments from standardized message
    const toolArguments: Record<string, any> = {
      chatId: messageData.chatId,
      senderName: messageData.senderName,
      messageType: messageData.messageType,
    };

    if (messageData.textContent) {
      toolArguments.text = messageData.textContent;
    }

    if (messageData.mediaContent) {
      toolArguments.mediaBase64 = messageData.mediaContent.base64Data;
      toolArguments.mediaMimetype = messageData.mediaContent.mimetype;
    }

    // Execute the tool with timeout
    const result = await Promise.race([
      client.callTool({ name: toolName, arguments: toolArguments }),
      timeout(MCP_TIMEOUT_MS, "Timeout waiting for MCP tool response"),
    ]);

    console.log("[MCP-Gateway] MCP tool executed successfully");
    return result;
  } finally {
    try {
      await transport.close();
      console.log("[MCP-Gateway] MCP connection closed");
    } catch (closeError) {
      console.warn("[MCP-Gateway] Error closing MCP connection:", closeError);
    }
  }
}

/**
 * Creates a rejecting promise after the specified delay.
 */
function timeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error(message)), ms)
  );
}
