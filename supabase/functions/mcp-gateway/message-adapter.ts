/**
 * Openbot MCP Gateway - Message Adapter Service
 * 
 * Normalizes incoming Openbot payloads (Baileys or Official) into a
 * unified StandardizedMessage format. Handles media download & Base64
 * conversion for Baileys URLs.
 * 
 * 100% ISOLATED - Does not depend on or affect any existing CRM code.
 */

import {
  type OpenbotPayload,
  type OpenbotBaileysPayload,
  type StandardizedMessage,
  type BaileysMediaMessage,
  isBaileysPayload,
} from "./openbot.types.ts";

/**
 * Maps Baileys messageType names to standardized types.
 */
function mapBaileysType(
  messageType: string
): StandardizedMessage["messageType"] {
  const map: Record<string, StandardizedMessage["messageType"]> = {
    conversation: "text",
    audioMessage: "audio",
    imageMessage: "image",
    videoMessage: "video",
    documentMessage: "document",
  };
  return map[messageType] || "text";
}

/**
 * Downloads media from a Baileys URL and converts it to Base64.
 * Handles expired/invalid URLs gracefully.
 */
async function downloadToBase64(
  media: BaileysMediaMessage
): Promise<{ base64Data: string; mimetype: string } | null> {
  try {
    if (!media.url) {
      console.warn("[MCP-Gateway] Baileys media has no URL, skipping download");
      return null;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(media.url, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      console.error(
        `[MCP-Gateway] Failed to download media: HTTP ${response.status}`
      );
      return null;
    }

    const arrayBuffer = await response.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64Data = btoa(binary);

    return {
      base64Data,
      mimetype: media.mimetype || "application/octet-stream",
    };
  } catch (error) {
    console.error("[MCP-Gateway] Error downloading Baileys media:", error);
    return null;
  }
}

/**
 * Extracts the Baileys media sub-object from the nested message structure.
 */
function getBaileysMedia(
  payload: OpenbotBaileysPayload
): BaileysMediaMessage | null {
  const msg = payload.message;
  return (
    msg.audioMessage ||
    msg.imageMessage ||
    msg.videoMessage ||
    msg.documentMessage ||
    null
  );
}

/**
 * Main normalization function. Converts any Openbot payload into a
 * StandardizedMessage, downloading and converting media as needed.
 */
export async function normalizePayload(
  payload: OpenbotPayload
): Promise<StandardizedMessage> {
  const base: Omit<
    StandardizedMessage,
    "messageType" | "textContent" | "mediaContent" | "isBaileys"
  > = {
    chatId: payload.chatId,
    instanceId: payload.instanceId,
    senderName: payload.pushName || "Unknown",
    fluxoId: payload.fluxo?.id || "",
  };

  if (isBaileysPayload(payload)) {
    const messageType = mapBaileysType(payload.messageType);
    const textContent = payload.message?.conversation || undefined;

    let mediaContent: StandardizedMessage["mediaContent"] = undefined;
    const media = getBaileysMedia(payload);
    if (media) {
      const downloaded = await downloadToBase64(media);
      if (downloaded) {
        mediaContent = downloaded;
      }
    }

    // Use caption as textContent if present on media messages
    const caption = media?.caption;

    return {
      ...base,
      messageType,
      textContent: textContent || caption || undefined,
      mediaContent,
      isBaileys: true,
    };
  }

  // Official API payload
  const messageType = payload.messageType as StandardizedMessage["messageType"];
  const textContent = payload.message?.conversation || undefined;

  let mediaContent: StandardizedMessage["mediaContent"] = undefined;
  if (payload.media?.data) {
    mediaContent = {
      mimetype: payload.media.mimetype || "application/octet-stream",
      base64Data: payload.media.data,
    };
  }

  return {
    ...base,
    messageType,
    textContent,
    mediaContent,
    isBaileys: false,
  };
}
