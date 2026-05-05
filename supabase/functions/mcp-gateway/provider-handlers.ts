/**
 * MCP Gateway - Provider Handlers
 * 
 * Executes provider-specific logic for integrations stored in mcp_connections.
 * Supports OAuth 2.0 with automatic token refresh for Google Drive.
 * 
 * 100% ISOLATED - Does not depend on or affect any existing CRM code.
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decrypt, encrypt } from "../_shared/encryption.ts";
import type { StandardizedMessage } from "./openbot.types.ts";

interface ProviderConnection {
  id?: string;
  provider: string;
  access_token: string;
  refresh_token?: string | null;
  token_expiry?: string | null;
  description: string | null;
  organization_id?: string;
}

interface McpResult {
  content: Array<{ type: string; text: string }>;
}

/**
 * Routes execution to the appropriate provider handler.
 */
export async function executeProvider(
  provider: ProviderConnection,
  message: StandardizedMessage
): Promise<McpResult> {
  console.log(`[MCP-Gateway] Executing provider: ${provider.provider}`);

  switch (provider.provider) {
    case "google_drive":
      return await googleDriveHandler(provider, message);
    default:
      console.warn(`[MCP-Gateway] Unsupported provider: ${provider.provider}`);
      return {
        content: [
          {
            type: "text",
            text: `⚠️ Provedor "${provider.provider}" ainda não é suportado.`,
          },
        ],
      };
  }
}

/**
 * Refreshes the Google OAuth access token using the refresh token.
 */
async function refreshAccessToken(
  connectionId: string,
  refreshTokenEncrypted: string
): Promise<string> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET not configured");
  }

  const refreshToken = await decrypt(refreshTokenEncrypted);

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken.trim(),
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[MCP-Gateway] Token refresh failed:", data);
    throw new Error(`Token refresh failed: ${data.error || response.status}`);
  }

  console.log("[MCP-Gateway] Token refreshed successfully");

  // Encrypt and store new token
  const newEncryptedToken = await encrypt(data.access_token);
  const expiresIn = data.expires_in || 3600;
  const tokenExpiry = new Date(Date.now() + expiresIn * 1000).toISOString();

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseUrl && serviceRoleKey) {
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    await supabase
      .from("mcp_connections")
      .update({
        access_token: newEncryptedToken,
        token_expiry: tokenExpiry,
        updated_at: new Date().toISOString(),
      })
      .eq("id", connectionId);
  }

  return data.access_token;
}

/**
 * Gets a valid access token, refreshing if needed.
 */
async function getValidAccessToken(provider: ProviderConnection): Promise<string> {
  // Check if token is expired or about to expire (5 min buffer)
  const isExpired = provider.token_expiry
    ? new Date(provider.token_expiry).getTime() - Date.now() < 5 * 60 * 1000
    : false;

  if (isExpired && provider.refresh_token && provider.id) {
    console.log("[MCP-Gateway] Token expired/expiring, refreshing...");
    return await refreshAccessToken(provider.id, provider.refresh_token);
  }

  // Decrypt stored token
  return (await decrypt(provider.access_token)).trim();
}

/**
 * Extracts a file ID from user message (URL or "ler <id>" command).
 */
function extractFileId(text: string): string | null {
  // Match Google Drive URLs
  const urlMatch = text.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (urlMatch) return urlMatch[1];

  // Match "ler <id>" or "read <id>" commands
  const readMatch = text.match(/^(?:ler|read|abrir|open)\s+([a-zA-Z0-9_-]{10,})/i);
  if (readMatch) return readMatch[1];

  return null;
}

/**
 * Reads file content from Google Drive.
 */
async function readFileContent(
  fileId: string,
  accessToken: string
): Promise<McpResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    // First get file metadata
    const metaResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,mimeType,webViewLink`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: controller.signal,
      }
    );

    if (!metaResponse.ok) {
      const body = await metaResponse.text();
      if (metaResponse.status === 404) {
        return { content: [{ type: "text", text: "❌ Arquivo não encontrado. Verifique o ID." }] };
      }
      return { content: [{ type: "text", text: `⚠️ Erro ao acessar arquivo (${metaResponse.status}).` }] };
    }

    const fileMeta = await metaResponse.json();
    const mimeType = fileMeta.mimeType;

    // Determine export format based on MIME type
    let exportMime: string | null = null;
    if (mimeType === "application/vnd.google-apps.document") exportMime = "text/plain";
    else if (mimeType === "application/vnd.google-apps.spreadsheet") exportMime = "text/csv";
    else if (mimeType === "application/vnd.google-apps.presentation") exportMime = "text/plain";

    let content: string;

    if (exportMime) {
      // Export Google Workspace files
      const exportResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${encodeURIComponent(exportMime)}`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        }
      );
      if (!exportResponse.ok) {
        return { content: [{ type: "text", text: "⚠️ Não foi possível exportar o conteúdo deste arquivo." }] };
      }
      content = await exportResponse.text();
    } else if (mimeType?.startsWith("text/")) {
      // Download text files directly
      const dlResponse = await fetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: controller.signal,
        }
      );
      if (!dlResponse.ok) {
        return { content: [{ type: "text", text: "⚠️ Não foi possível baixar o conteúdo deste arquivo." }] };
      }
      content = await dlResponse.text();
    } else {
      return {
        content: [{
          type: "text",
          text: `📄 **${fileMeta.name}**\nTipo: ${mimeType}\n🔗 ${fileMeta.webViewLink || "Sem link"}\n\n_Este tipo de arquivo não pode ser lido como texto._`,
        }],
      };
    }

    // Truncate to 4000 chars for WhatsApp
    const truncated = content.length > 4000 
      ? content.substring(0, 4000) + "\n\n... (conteúdo truncado)"
      : content;

    return {
      content: [{
        type: "text",
        text: `📄 **${fileMeta.name}**\n\n${truncated}`,
      }],
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Google Drive Handler - OAuth 2.0 with token refresh
 */
async function googleDriveHandler(
  provider: ProviderConnection,
  message: StandardizedMessage
): Promise<McpResult> {
  const query = message.textContent?.trim();

  if (!query) {
    return {
      content: [{
        type: "text",
        text: "Por favor, envie um texto para buscar arquivos no Google Drive.",
      }],
    };
  }

  try {
    const accessToken = await getValidAccessToken(provider);

    // Check if user wants to read a specific file
    const fileId = extractFileId(query);
    if (fileId) {
      console.log(`[MCP-Gateway] Reading file: ${fileId}`);
      return await readFileContent(fileId, accessToken);
    }

    // Otherwise, search for files
    console.log(`[MCP-Gateway] Google Drive search: "${query}"`);

    const driveQuery = `fullText contains '${query.replace(/'/g, "\\'")}'`;
    const fields = "files(id,name,mimeType,webViewLink,modifiedTime,owners)";
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(driveQuery)}&fields=${encodeURIComponent(fields)}&pageSize=10&orderBy=modifiedTime desc`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[MCP-Gateway] Google Drive API error: ${response.status}`, errorBody);

      if (response.status === 401) {
        return {
          content: [{
            type: "text",
            text: "⚠️ Token do Google Drive expirado. Reconecte no painel MCP Gateway.",
          }],
        };
      }

      return {
        content: [{
          type: "text",
          text: `⚠️ Erro ao buscar no Google Drive (HTTP ${response.status}).`,
        }],
      };
    }

    const data = await response.json();
    const files = data.files || [];

    if (files.length === 0) {
      return {
        content: [{
          type: "text",
          text: `Nenhum arquivo encontrado para "${query}".`,
        }],
      };
    }

    const fileList = files
      .map((f: any, i: number) => {
        const link = f.webViewLink ? ` - ${f.webViewLink}` : "";
        return `${i + 1}. 📄 ${f.name} (${f.mimeType})${link}`;
      })
      .join("\n");

    return {
      content: [{
        type: "text",
        text: `Encontrei ${files.length} arquivo(s) para "${query}":\n\n${fileList}\n\n💡 Para ler um arquivo, envie: ler <ID_DO_ARQUIVO>`,
      }],
    };
  } catch (error) {
    console.error("[MCP-Gateway] Google Drive handler error:", error);
    return {
      content: [{
        type: "text",
        text: "⚠️ Erro ao acessar o Google Drive. Tente novamente.",
      }],
    };
  }
}
