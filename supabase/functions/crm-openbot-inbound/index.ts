import { createClient } from "npm:@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.23.4/mod.ts";
import { decrypt } from "../_shared/encryption.ts";
import { fetchWithRetry } from "../_shared/fetchWithRetry.ts";
import { getErrorMessage } from "../_shared/getErrorMessage.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

// Permissive envelope: ensures non-empty payload without rejecting any real upstream variant.
const InboundEnvelopeSchema = z
  .object({
    instanceId: z.string().max(200).optional(),
    chatId: z.string().max(200).optional(),
    pushName: z.string().max(500).optional(),
    message: z.unknown().optional(),
    key: z.unknown().optional(),
    fluxo: z.unknown().optional(),
    fromMe: z.boolean().optional(),
    media: z.unknown().optional(),
    base64: z.string().optional(),
    mediaUrl: z.string().optional(),
  })
  .passthrough()
  .refine((d) => !!(d.instanceId || d.chatId || d.message || d.key || d.media), {
    message: "empty inbound payload",
  });

// Normalized payload interface for consistent processing
interface NormalizedPayload {
  instanceId: string;
  chatId: string;
  pushName: string;
  content: string;
  contentType: "text" | "image" | "audio" | "document" | "video";
  fromMe: boolean;
  metaMessageId: string;
  timestamp: string | number | undefined;
  fluxo?: { apenasWebhookSaida?: boolean; id?: string; nome?: string };
  detectedFormat: "nested" | "flat_key" | "flat";
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaKey?: string;
  mediaMessageType?: string;
}

/**
 * Extracts media URL and MIME type from a message object
 */
function extractMedia(innerMsg: Record<string, unknown> | undefined): { mediaUrl?: string; mediaMimeType?: string; fileName?: string; mediaKey?: string; mediaMessageType?: string } {
  if (!innerMsg) return {};
  for (const key of ["imageMessage", "audioMessage", "videoMessage", "documentMessage"]) {
    const media = innerMsg[key] as Record<string, unknown> | undefined;
    if (media?.url) {
      return { 
        mediaUrl: String(media.url), 
        mediaMimeType: media.mimetype ? String(media.mimetype) : undefined,
        fileName: media.fileName ? String(media.fileName) : undefined,
        mediaKey: media.mediaKey ? String(media.mediaKey) : undefined,
        mediaMessageType: key,
      };
    }
  }
  return {};
}

/**
 * Validates downloaded media bytes by checking file magic numbers (signatures).
 * Prevents storing E2E encrypted WhatsApp CDN data as valid media.
 */
function isValidMediaBytes(buffer: Uint8Array, contentType: string): boolean {
  if (buffer.length < 4) return false;
  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) return true;
  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) return true;
  // GIF: 47 49 46
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46) return true;
  // PDF: 25 50 44 46
  if (buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return true;
  // MP4/MOV: ftyp at offset 4
  if (buffer.length > 7 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) return true;
  // OGG: 4F 67 67 53
  if (buffer[0] === 0x4F && buffer[1] === 0x67 && buffer[2] === 0x67 && buffer[3] === 0x53) return true;
  // WebM: 1A 45 DF A3
  if (buffer[0] === 0x1A && buffer[1] === 0x45 && buffer[2] === 0xDF && buffer[3] === 0xA3) return true;
  // WAV: 52 49 46 46
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) return true;
  // MP3: FF FB / FF F3 / FF F2 / ID3
  if (buffer[0] === 0xFF && (buffer[1] === 0xFB || buffer[1] === 0xF3 || buffer[1] === 0xF2)) return true;
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) return true;
  // Audio can have varied headers - trust content-type
  if (contentType.includes("audio/")) return true;
  return false;
}

// ========== WhatsApp E2E Media Decryption (Baileys) ==========

/**
 * HKDF expand (HMAC-SHA256 based) - derives 112 bytes from mediaKey
 */
async function hkdfExpand(mediaKey: Uint8Array, info: string): Promise<Uint8Array> {
  const salt = new Uint8Array(32); // 32 zero bytes
  // Step 1: Extract (PRK = HMAC-SHA256(salt, mediaKey))
  const extractKey = await crypto.subtle.importKey("raw", salt, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const prk = new Uint8Array(await crypto.subtle.sign("HMAC", extractKey, mediaKey));
  
  // Step 2: Expand to 112 bytes
  const infoBytes = new TextEncoder().encode(info);
  const prkKey = await crypto.subtle.importKey("raw", prk, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  let keyStream = new Uint8Array(0);
  let keyBlock = new Uint8Array(0);
  let blockIndex = 1;
  
  while (keyStream.length < 112) {
    const input = new Uint8Array([...keyBlock, ...infoBytes, blockIndex]);
    keyBlock = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, input));
    const combined = new Uint8Array(keyStream.length + keyBlock.length);
    combined.set(keyStream);
    combined.set(keyBlock, keyStream.length);
    keyStream = combined;
    blockIndex++;
  }
  
  return keyStream.slice(0, 112);
}

/**
 * Decrypts WhatsApp E2E encrypted media using mediaKey from Baileys payload.
 * Algorithm: HKDF-SHA256 expand → AES-256-CBC decrypt → strip padding
 */
async function decryptWhatsAppMedia(
  encryptedData: Uint8Array,
  mediaKeyBase64: string,
  messageType: string
): Promise<Uint8Array> {
  const typeMap: Record<string, string> = {
    "imageMessage": "WhatsApp Image Keys",
    "audioMessage": "WhatsApp Audio Keys",
    "videoMessage": "WhatsApp Video Keys",
    "documentMessage": "WhatsApp Document Keys",
    "stickerMessage": "WhatsApp Image Keys",
  };
  const info = typeMap[messageType];
  if (!info) throw new Error(`Unknown media type: ${messageType}`);
  
  // Decode mediaKey from base64
  const mediaKey = Uint8Array.from(atob(mediaKeyBase64), c => c.charCodeAt(0));
  
  // Expand key via HKDF
  const expanded = await hkdfExpand(mediaKey, info);
  const iv = expanded.slice(0, 16);
  const cipherKey = expanded.slice(16, 48);
  // expanded[48..80] = macKey, expanded[80..112] = refKey (not needed for decryption)
  
  // Remove last 10 bytes (MAC) from encrypted data
  const ciphertext = encryptedData.slice(0, -10);
  
  // Decrypt with AES-256-CBC
  const key = await crypto.subtle.importKey("raw", cipherKey, { name: "AES-CBC" }, false, ["decrypt"]);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-CBC", iv }, key, ciphertext);
  
  return new Uint8Array(decrypted);
}

/**
 * Extracts media from top-level media.base64 field (used by IA audio responses)
 */
function extractTopLevelMedia(
  payload: Record<string, unknown>,
  contentType: NormalizedPayload["contentType"]
): { mediaUrl?: string; mediaMimeType?: string } {
  const media = payload.media as Record<string, unknown> | undefined;
  if (!media) return {};

  // API Oficial Meta usa "data", IA usa "base64"
  const base64 = media.data ? String(media.data) : media.base64 ? String(media.base64) : null;
  if (!base64) return {};

  const mimetype = media.mimetype
    ? String(media.mimetype)
    : contentType === "audio"
      ? "audio/ogg;codecs=opus"
      : contentType === "image"
        ? "image/jpeg"
        : contentType === "video"
          ? "video/mp4"
          : "application/octet-stream";

  return {
    mediaUrl: `data:${mimetype};base64,${base64}`,
    mediaMimeType: mimetype,
  };
}

/**
 * Safely extracts a preview of content (max 120 chars, no base64)
 */
function getContentPreview(content: string): string {
  if (!content) return "";
  // Remove base64 data
  const cleaned = content.replace(/data:[^;]+;base64,[^\s]+/g, "[base64_removed]");
  return cleaned.substring(0, 120);
}

/**
 * Generates a friendly message preview for the conversation list
 */
function generateMessagePreview(contentType: string, content: string): string {
  switch (contentType) {
    case "audio":
      return "🎵 Áudio";
    case "image":
      return "📷 Imagem";
    case "video":
      return "🎥 Vídeo";
    case "document": {
      const match = content.match(/^\[arquivo:\s*(.+)\]$/i);
      return match ? `📄 ${match[1]}` : "📄 Documento";
    }
    case "voice_call":
      return content.substring(0, 100);
    default:
      return content.substring(0, 100);
  }
}

/**
 * Detect content type from known placeholder patterns when the message object
 * doesn't explicitly contain the media key (e.g. fromMe=true notifications).
 */
function detectContentTypeFromText(content: string, currentType: NormalizedPayload["contentType"]): NormalizedPayload["contentType"] {
  if (currentType !== "text") return currentType;
  const lower = content.toLowerCase().trim();
  if (lower.includes("áudio ptt") || lower === "[áudio]" || lower.match(/^\[audio.*\]$/i)) return "audio";
  if (lower === "[imagem]" || lower.match(/^\[imagen?\]$/i)) return "image";
  if (lower === "[vídeo]" || lower === "[video]") return "video";
  if (lower.match(/^\[arquivo:.*\]$/i) || lower === "[documento]") return "document";
  return currentType;
}

/**
 * Normalizes incoming OpenBot webhook payload to a consistent format
 * Supports both nested format (standard OpenBot) and flat format (variations)
 */
function normalizePayload(raw: unknown): NormalizedPayload | null {
  const payload = raw as Record<string, unknown>;
  
  console.log("[crm-openbot-inbound] Raw payload keys:", Object.keys(payload));
  
  // Format 1: Standard OpenBot nested format
  // { message: { instanceId, chatId, pushName, message: { conversation }, key: { fromMe, id } }, instanceId }
  if (payload.message && typeof payload.message === 'object') {
    const msg = payload.message as Record<string, unknown>;
    
    // Check if it's the nested format (has chatId and key inside message)
    if (msg.chatId && msg.key && typeof msg.key === 'object') {
      const key = msg.key as Record<string, unknown>;
      const innerMsg = msg.message as Record<string, unknown> | undefined;
      
      // Extract content
      let content = "";
      let contentType: NormalizedPayload["contentType"] = "text";
      
      if (innerMsg?.conversation) {
        content = String(innerMsg.conversation);
      } else if (innerMsg?.extendedTextMessage) {
        const ext = innerMsg.extendedTextMessage as Record<string, unknown>;
        content = String(ext.text || "");
      } else if (innerMsg?.imageMessage) {
        const img = innerMsg.imageMessage as Record<string, unknown>;
        content = String(img.caption || "[Imagem]");
        contentType = "image";
      } else if (innerMsg?.audioMessage) {
        content = "[Áudio]";
        contentType = "audio";
      } else if (innerMsg?.documentMessage) {
        const doc = innerMsg.documentMessage as Record<string, unknown>;
        const docFileName = doc.fileName ? String(doc.fileName) : null;
        content = docFileName ? `[arquivo: ${docFileName}]` : String(doc.caption || "[Documento]");
        contentType = "document";
      } else if (innerMsg?.videoMessage) {
        const vid = innerMsg.videoMessage as Record<string, unknown>;
        content = String(vid.caption || "[Vídeo]");
        contentType = "video";
      }
      
      // Detect content type from placeholder text patterns (e.g. fromMe audio notifications)
      contentType = detectContentTypeFromText(content, contentType);
      
      let { mediaUrl, mediaMimeType, fileName: extractedFileName, mediaKey, mediaMessageType } = extractMedia(innerMsg);
      
      // Fallback: extract top-level media.base64 (IA audio responses)
      if (!mediaUrl) {
        const topLevel = extractTopLevelMedia(payload, contentType);
        if (topLevel.mediaUrl) {
          mediaUrl = topLevel.mediaUrl;
          mediaMimeType = topLevel.mediaMimeType;
        }
      }
      
      // Fallback: extract top-level 'arquivo' field (IA outbound files)
      if (!mediaUrl && payload.arquivo) {
        const arquivo = String(payload.arquivo);
        if (arquivo.startsWith("data:")) {
          mediaUrl = arquivo;
          const mimeMatch = arquivo.match(/^data:(.+?);base64,/);
          if (mimeMatch) mediaMimeType = mimeMatch[1];
        } else if (arquivo.startsWith("http")) {
          mediaUrl = arquivo;
        }
      }
      
      // Reclassify content type based on actual MIME type
      if (mediaMimeType) {
        if (mediaMimeType.startsWith("video/") && contentType !== "video") contentType = "video";
        else if (mediaMimeType.startsWith("image/") && contentType !== "image") contentType = "image";
      }
      
      // Use messageType field as fallback for content type detection (API Oficial Meta + Baileys)
      const messageType = (payload.messageType || (msg as Record<string, unknown>).messageType) as string | undefined;
      if (contentType === "text" && messageType) {
        const typeMap: Record<string, NormalizedPayload["contentType"]> = {
          "image": "image", "audio": "audio", "video": "video",
          "document": "document", "ptt": "audio",
          "imageMessage": "image", "audioMessage": "audio",
          "videoMessage": "video", "documentMessage": "document",
        };
        if (typeMap[messageType]) contentType = typeMap[messageType];
      }
      
      // Generate default content for media types without text (API Oficial Meta)
      if (contentType === "image" && !content) content = "[Imagem]";
      if (contentType === "audio" && !content) content = "[Áudio]";
      if (contentType === "video" && !content) content = "[Vídeo]";
      if (contentType === "document" && !content) content = "[Documento]";
      
      // Extract fluxo for IA detection
      const fluxoData = (payload.fluxo || msg.fluxo) as { apenasWebhookSaida?: boolean; id?: string; nome?: string } | undefined;
      
      const normalized: NormalizedPayload = {
        instanceId: String(msg.instanceId || payload.instanceId || "default"),
        chatId: String(msg.chatId),
        pushName: String(msg.pushName || msg.chatId),
        content,
        contentType,
        fromMe: Boolean(key.fromMe),
        metaMessageId: String(key.id || `auto_${Date.now()}`),
        timestamp: msg.messageTimestamp as string | number | undefined,
        fluxo: fluxoData,
        detectedFormat: "nested",
        mediaUrl,
        mediaMimeType,
        mediaKey,
        mediaMessageType,
      };
      
      console.log("[crm-openbot-inbound] Normalized (nested format):", {
        instanceId: normalized.instanceId,
        chatId: normalized.chatId.substring(0, 8) + "****",
        pushName: normalized.pushName,
        fromMe: normalized.fromMe,
        contentType: normalized.contentType,
        contentLength: normalized.content.length,
        metaMessageId: normalized.metaMessageId,
        hasFluxo: !!normalized.fluxo,
        apenasWebhookSaida: normalized.fluxo?.apenasWebhookSaida,
        hasMedia: !!normalized.mediaUrl,
      });
      
      return normalized;
    }
  }
  
  // Format 2: Flat format with key object (OpenBot hybrid)
  // { instanceId, chatId, fromMe, message: { conversation }, key: { id } }
  if (payload.chatId && payload.key && typeof payload.key === 'object') {
    const key = payload.key as Record<string, unknown>;
    const innerMsg = payload.message as Record<string, unknown> | undefined;
    
    let content = "";
    let contentType: NormalizedPayload["contentType"] = "text";
    
    if (innerMsg?.conversation) {
      content = String(innerMsg.conversation);
    } else if (innerMsg?.extendedTextMessage) {
      const ext = innerMsg.extendedTextMessage as Record<string, unknown>;
      content = String(ext.text || "");
    } else if (innerMsg?.imageMessage) {
      const img = innerMsg.imageMessage as Record<string, unknown>;
      content = String(img.caption || "[Imagem]");
      contentType = "image";
    } else if (innerMsg?.audioMessage) {
      content = "[Áudio]";
      contentType = "audio";
    } else if (innerMsg?.documentMessage) {
      const doc = innerMsg.documentMessage as Record<string, unknown>;
      const docFileName = doc.fileName ? String(doc.fileName) : null;
      content = docFileName ? `[arquivo: ${docFileName}]` : String(doc.caption || "[Documento]");
      contentType = "document";
    } else if (innerMsg?.videoMessage) {
      const vid = innerMsg.videoMessage as Record<string, unknown>;
      content = String(vid.caption || "[Vídeo]");
      contentType = "video";
    }
    
    // Detect content type from placeholder text patterns
    contentType = detectContentTypeFromText(content, contentType);
    
    // Extract media
    let { mediaUrl, mediaMimeType, fileName: _fn2, mediaKey, mediaMessageType } = extractMedia(innerMsg);
    
    // Fallback: extract top-level media.base64 (IA audio responses)
    if (!mediaUrl) {
      const topLevel = extractTopLevelMedia(payload, contentType);
      if (topLevel.mediaUrl) {
        mediaUrl = topLevel.mediaUrl;
        mediaMimeType = topLevel.mediaMimeType;
      }
    }
    
    // Fallback: extract top-level 'arquivo' field (IA outbound files)
    if (!mediaUrl && payload.arquivo) {
      const arquivo = String(payload.arquivo);
      if (arquivo.startsWith("data:")) {
        mediaUrl = arquivo;
        const mimeMatch = arquivo.match(/^data:(.+?);base64,/);
        if (mimeMatch) mediaMimeType = mimeMatch[1];
      } else if (arquivo.startsWith("http")) {
        mediaUrl = arquivo;
      }
    }
    
    // Use messageType field as fallback for content type detection (API Oficial Meta + Baileys)
    const messageType = payload.messageType as string | undefined;
    if (contentType === "text" && messageType) {
      const typeMap: Record<string, NormalizedPayload["contentType"]> = {
        "image": "image", "audio": "audio", "video": "video",
        "document": "document", "ptt": "audio",
        "imageMessage": "image", "audioMessage": "audio",
        "videoMessage": "video", "documentMessage": "document",
      };
      if (typeMap[messageType]) contentType = typeMap[messageType];
    }
    
    // Reclassify content type based on actual MIME type
    if (mediaMimeType) {
      if (mediaMimeType.startsWith("video/") && contentType !== "video") contentType = "video";
      else if (mediaMimeType.startsWith("image/") && contentType !== "image") contentType = "image";
    }
    
    // Generate default content for media types without text (API Oficial Meta)
    if (contentType === "image" && !content) content = "[Imagem]";
    if (contentType === "audio" && !content) content = "[Áudio]";
    if (contentType === "video" && !content) content = "[Vídeo]";
    if (contentType === "document" && !content) content = "[Documento]";
    
    // Extract fluxo for IA detection
    const fluxoData = payload.fluxo as { apenasWebhookSaida?: boolean; id?: string; nome?: string } | undefined;
    
    const normalized: NormalizedPayload = {
      instanceId: String(payload.instanceId || "default"),
      chatId: String(payload.chatId),
      pushName: String(payload.pushName || payload.chatId),
      content,
      contentType,
      fromMe: Boolean(payload.fromMe),
      metaMessageId: String(key.id || `auto_${Date.now()}`),
      timestamp: payload.timestamp as string | number | undefined,
      fluxo: fluxoData,
      detectedFormat: "flat_key",
      mediaUrl,
      mediaMimeType,
      mediaKey,
      mediaMessageType,
    };
    
    console.log("[crm-openbot-inbound] Normalized (flat+key format):", {
      instanceId: normalized.instanceId,
      chatId: normalized.chatId.substring(0, 8) + "****",
      fromMe: normalized.fromMe,
      contentType: normalized.contentType,
      metaMessageId: normalized.metaMessageId,
      hasFluxo: !!normalized.fluxo,
      apenasWebhookSaida: normalized.fluxo?.apenasWebhookSaida,
      hasMedia: !!normalized.mediaUrl,
    });
    
    return normalized;
  }
  
  // Format 3: Simple flat format (fallback for variations)
  // { instanceId, chatId, fromMe, messageId, message: { conversation } }
  if (payload.chatId) {
    const innerMsg = payload.message as Record<string, unknown> | undefined;
    
    let content = "";
    let contentType: NormalizedPayload["contentType"] = "text";
    
    if (innerMsg?.conversation) {
      content = String(innerMsg.conversation);
    } else if (innerMsg?.extendedTextMessage) {
      const ext = innerMsg.extendedTextMessage as Record<string, unknown>;
      content = String(ext.text || "");
    } else if (innerMsg?.imageMessage) {
      const img = innerMsg.imageMessage as Record<string, unknown>;
      content = String(img.caption || "[Imagem]");
      contentType = "image";
    } else if (innerMsg?.audioMessage) {
      content = "[Áudio]";
      contentType = "audio";
    } else if (innerMsg?.documentMessage) {
      const doc = innerMsg.documentMessage as Record<string, unknown>;
      const docFileName = doc.fileName ? String(doc.fileName) : null;
      content = docFileName ? `[arquivo: ${docFileName}]` : String(doc.caption || "[Documento]");
      contentType = "document";
    } else if (typeof payload.text === 'string') {
      content = payload.text;
    }
    
    // Detect content type from placeholder text patterns
    contentType = detectContentTypeFromText(content, contentType);
    
    // Extract media from inner message
    let { mediaUrl, mediaMimeType, mediaKey, mediaMessageType } = extractMedia(innerMsg);
    
    // Fallback: extract top-level media.base64 (IA audio responses)
    if (!mediaUrl) {
      const topLevel = extractTopLevelMedia(payload, contentType);
      if (topLevel.mediaUrl) {
        mediaUrl = topLevel.mediaUrl;
        mediaMimeType = topLevel.mediaMimeType;
      }
    }
    
    // Fallback: extract top-level 'arquivo' field (IA outbound files)
    if (!mediaUrl && payload.arquivo) {
      const arquivo = String(payload.arquivo);
      if (arquivo.startsWith("data:")) {
        mediaUrl = arquivo;
        const mimeMatch = arquivo.match(/^data:(.+?);base64,/);
        if (mimeMatch) mediaMimeType = mimeMatch[1];
      } else if (arquivo.startsWith("http")) {
        mediaUrl = arquivo;
      }
    }
    
    // Use messageType field as fallback for content type detection (API Oficial Meta + Baileys)
    const messageType = payload.messageType as string | undefined;
    if (contentType === "text" && messageType) {
      const typeMap: Record<string, NormalizedPayload["contentType"]> = {
        "image": "image", "audio": "audio", "video": "video",
        "document": "document", "ptt": "audio",
        "imageMessage": "image", "audioMessage": "audio",
        "videoMessage": "video", "documentMessage": "document",
      };
      if (typeMap[messageType]) contentType = typeMap[messageType];
    }
    
    // Reclassify content type based on actual MIME type
    if (mediaMimeType) {
      if (mediaMimeType.startsWith("video/") && contentType !== "video") contentType = "video";
      else if (mediaMimeType.startsWith("image/") && contentType !== "image") contentType = "image";
    }
    
    // Generate default content for media types without text (API Oficial Meta)
    if (contentType === "image" && !content) content = "[Imagem]";
    if (contentType === "audio" && !content) content = "[Áudio]";
    if (contentType === "video" && !content) content = "[Vídeo]";
    if (contentType === "document" && !content) content = "[Documento]";
    
    // Extract fluxo for IA detection
    const fluxoData = payload.fluxo as { apenasWebhookSaida?: boolean; id?: string; nome?: string } | undefined;
    
    const normalized: NormalizedPayload = {
      instanceId: String(payload.instanceId || "default"),
      chatId: String(payload.chatId),
      pushName: String(payload.pushName || payload.chatId),
      content,
      contentType,
      fromMe: Boolean(payload.fromMe),
      metaMessageId: String(payload.messageId || payload.id || `auto_${Date.now()}`),
      timestamp: payload.messageTimestamp as string | number | undefined,
      fluxo: fluxoData,
      detectedFormat: "flat",
      mediaUrl,
      mediaMimeType,
      mediaKey,
      mediaMessageType,
    };
    
    console.log("[crm-openbot-inbound] Normalized (flat format):", {
      instanceId: normalized.instanceId,
      chatId: normalized.chatId.substring(0, 8) + "****",
      fromMe: normalized.fromMe,
      contentType: normalized.contentType,
      hasFluxo: !!normalized.fluxo,
      apenasWebhookSaida: normalized.fluxo?.apenasWebhookSaida,
    });
    
    return normalized;
  }
  
  // Unrecognized format
  console.error("[crm-openbot-inbound] Unrecognized payload format:", 
    JSON.stringify(payload).substring(0, 500));
  return null;
}

/**
 * Validates HMAC-SHA256 webhook signature
 */
async function validateWebhookSignature(
  body: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSig = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    // Constant-time comparison
    if (expectedSig.length !== signature.length) return false;
    let result = 0;
    for (let i = 0; i < expectedSig.length; i++) {
      result |= expectedSig.charCodeAt(i) ^ signature.charCodeAt(i);
    }
    return result === 0;
  } catch (e) {
    console.error("[crm-openbot-inbound] Signature validation error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  console.log("[crm-openbot-inbound] Request received:", req.method);

  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Start timing for logging
  const startTime = Date.now();
  let loggedOrganizationId: string | null = null;
  let loggedInstanceId: string | null = null;
  let loggedPhone: string | null = null;

  try {
    // Validate payload size (max 2MB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
      return new Response(
        JSON.stringify({ error: "Payload too large" }),
        { status: 413, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read raw body for signature validation
    const rawBody = await req.text();
    let rawPayload: unknown;
    try {
      rawPayload = JSON.parse(rawBody);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Permissive zod envelope (catches empty/garbage; preserves all real upstream variants)
    const parsedEnvelope = InboundEnvelopeSchema.safeParse(rawPayload);
    if (!parsedEnvelope.success) {
      console.warn("[crm-openbot-inbound] invalid_payload", parsedEnvelope.error.flatten());
      return new Response(
        JSON.stringify({ error: "invalid_payload", issues: parsedEnvelope.error.flatten() }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("[crm-openbot-inbound] Raw payload received:", rawBody.substring(0, 500));

    // ── Skip non-message event types (reactions, receipts, presence, etc.) ──
    const rawObj = rawPayload as Record<string, unknown>;
    const rawMessageType = String(rawObj.messageType || "");
    const rawMsg = rawObj.message as Record<string, unknown> | undefined;
    const nestedMsg = rawMsg?.message as Record<string, unknown> | undefined;

    // Detection 1: Native reaction/receipt event types from Baileys
    const hasReaction = rawMessageType === "reaction" || rawMessageType === "reactionMessage"
      || !!(nestedMsg?.reactionMessage) || !!(rawMsg?.reactionMessage);
    const hasReceipt = rawMessageType === "receipt" || rawMessageType === "protocolMessage"
      || !!(nestedMsg?.protocolMessage);

    // Detection 2: OpenBot converts unsupported types to text with placeholder content
    // e.g. "[Tipo de mensagem não suportado: reaction]", "[Tipo de mensagem não suportado: pollCreation]"
    const textContent = String(
      nestedMsg?.conversation || rawMsg?.conversation || ""
    );
    const isUnsupportedPlaceholder = /^\[Tipo de mensagem n[aã]o suportado:\s*.+\]$/i.test(textContent);

    if (hasReaction || hasReceipt || isUnsupportedPlaceholder) {
      const skippedType = hasReaction ? "reaction" 
        : isUnsupportedPlaceholder ? textContent.match(/:\s*(.+)\]$/i)?.[1] || "unknown"
        : rawMessageType;
      console.log(`[crm-openbot-inbound] Non-message event detected: ${skippedType}`);

      // ── Silent engagement tracking for reactions ──
      // Update contact's last_interaction_at and log event without creating a chat message
      const isReactionEvent = hasReaction || /reaction/i.test(textContent);
      if (isReactionEvent) {
        try {
          const supabaseSilent = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
          );

          // Extract chatId from payload to find the contact
          const silentChatId = String(rawObj.chatId || rawMsg?.chatId || "");
          const silentInstanceId = String(rawObj.instanceId || rawMsg?.instanceId || "");
          const silentPhone = silentChatId.replace(/@.*$/, "");

          if (silentPhone) {
            // Find instance by URL param or name
            const urlInstanceId = new URL(req.url).searchParams.get("instance_id");
            let orgId: string | null = null;

            if (urlInstanceId) {
              const { data: inst } = await supabaseSilent
                .from("instances")
                .select("organization_id")
                .eq("id", urlInstanceId)
                .single();
              orgId = inst?.organization_id || null;
            }

            if (orgId && silentPhone) {
              // Update contact engagement (last_interaction_at)
              await supabaseSilent
                .from("contacts")
                .update({ last_interaction_at: new Date().toISOString() })
                .eq("organization_id", orgId)
                .eq("phone", silentPhone);

              // Log as silent webhook event for analytics
              await supabaseSilent.from("crm_webhook_events").insert({
                organization_id: orgId,
                event_type: "reaction",
                status: "skipped",
                instance_id: silentInstanceId,
                phone: silentPhone,
                payload: { type: skippedType, raw_message_type: rawMessageType },
                processing_time_ms: Date.now() - startTime,
              });

              console.log(`[crm-openbot-inbound] Reaction engagement updated for ${silentPhone.substring(0, 6)}****`);
            }
          }
        } catch (engagementErr) {
          console.warn("[crm-openbot-inbound] Failed to update reaction engagement:", engagementErr);
        }
      }

      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: `Event type '${skippedType}' acknowledged - engagement updated` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Normalize payload to handle different formats
    const normalized = normalizePayload(rawPayload);

    if (!normalized || !normalized.chatId) {
      console.error("[crm-openbot-inbound] Unable to normalize payload");
      return new Response(
        JSON.stringify({ 
          error: "Invalid payload: unable to extract required fields (chatId, messageId)",
          hint: "Expected format: { instanceId, chatId, message: { conversation }, key: { id } }"
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client with service role
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // --- Webhook Signature Validation ---
    // Check if organization has a webhook_secret configured; if so, validate signature
    const incomingSignature = req.headers.get("x-webhook-secret") || req.headers.get("x-hub-signature-256") || req.headers.get("x-signature");
    
    // We need to find the instance first to get the org, then check for webhook_secret
    // This validation happens after instance lookup below (see "Signature validation checkpoint")

    const { instanceId, chatId, pushName, content, contentType, fromMe, metaMessageId, timestamp, fluxo, detectedFormat, mediaUrl, mediaMimeType, mediaKey, mediaMessageType } = normalized;
    loggedInstanceId = instanceId;

    // Prepare instrumentation data for logging
    const contentPreview = getContentPreview(content);
    const instrumentationData = {
      chatIdMasked: chatId.substring(0, 8) + "****",
      contentPreview,
      detectedFormat,
      hasFluxo: !!fluxo,
      apenasWebhookSaida: fluxo?.apenasWebhookSaida ?? null,
      fromMe,
      metaMessageId,
      contentType,
      pushName,
    };

    // Check for empty content
    if (!content) {
      console.log("[crm-openbot-inbound] Empty message content, ignoring");
      
      // Log ignored event with instrumentation
      // Note: We need organization_id but don't have instance yet, so skip logging here
      return new Response(
        JSON.stringify({ success: true, message: "Empty message ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Find instance - Priority order:
    //    P1: instance_id query parameter (Supabase UUID from webhook URL)
    //    P2: openbot_instance_id exact match
    // SECURITY: Global fallback auto-linking was removed because it could bind
    // a webhook from one tenant to an unconfigured instance from another tenant.
    let instance: { id: string; organization_id: string; openbot_instance_id: string | null; name?: string } | null = null;
    const normalizedInstanceId = instanceId?.trim() || null;
    
    // Priority 1: Use instance_id from URL query parameter (most reliable)
    const url = new URL(req.url);
    const queryInstanceId = url.searchParams.get("instance_id");
    
    if (queryInstanceId) {
      const { data: queryInstance } = await supabase
        .from("instances")
        .select("id, organization_id, openbot_instance_id, name, openbot_api_key_encrypted, api_url, api_key_encrypted, provider")
        .eq("id", queryInstanceId)
        .maybeSingle();
      
      if (queryInstance) {
        const linkedOpenbotInstanceId = queryInstance.openbot_instance_id?.trim() || null;

        if (
          linkedOpenbotInstanceId &&
          normalizedInstanceId &&
          linkedOpenbotInstanceId !== normalizedInstanceId
        ) {
          console.error(
            `[crm-openbot-inbound] SECURITY: instance_id URL mismatch. URL instance ${queryInstanceId} is linked to '${linkedOpenbotInstanceId}', but payload sent '${normalizedInstanceId}'. Rejecting to prevent cross-tenant routing.`
          );
          return new Response(
            JSON.stringify({
              error: "Webhook vinculado à instância errada",
              hint: "A URL usada neste cliente pertence a outra instância. Copie a URL exclusiva desta instância no CRM e atualize o webhook no provedor.",
            }),
            { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        instance = queryInstance;
        console.log("[crm-openbot-inbound] Instance found by URL query param:", queryInstanceId);
        
        // Safe auto-linking: only when the request already targets a specific instance URL
        if (!linkedOpenbotInstanceId && normalizedInstanceId) {
          console.log(`[crm-openbot-inbound] Safe auto-linking openbot_instance_id: ${normalizedInstanceId} to instance ${queryInstanceId}`);
          const { error: linkErr } = await supabase
            .from("instances")
            .update({ openbot_instance_id: normalizedInstanceId })
            .eq("id", queryInstance.id);
          if (linkErr) {
            console.error(`[crm-openbot-inbound] Auto-link FAILED for ${queryInstanceId}:`, linkErr.message);
          } else {
            console.log(`[crm-openbot-inbound] Auto-link SUCCESS: ${normalizedInstanceId} → ${queryInstanceId}`);
          }
          instance.openbot_instance_id = normalizedInstanceId;
        }
      } else {
        console.warn("[crm-openbot-inbound] instance_id from URL not found in DB:", queryInstanceId);
      }
    }
    
    // Priority 2: Try exact match by openbot_instance_id
    // SECURITY: Must handle duplicates to prevent cross-tenant routing
    if (!instance && normalizedInstanceId) {
      const { data: foundInstances } = await supabase
        .from("instances")
        .select("id, organization_id, openbot_instance_id, name, openbot_api_key_encrypted, api_url, api_key_encrypted, provider")
        .eq("openbot_instance_id", normalizedInstanceId);

      if (foundInstances && foundInstances.length === 1) {
        instance = foundInstances[0];
        console.log("[crm-openbot-inbound] Instance found by openbot_instance_id:", normalizedInstanceId);
      } else if (foundInstances && foundInstances.length > 1) {
        // CRITICAL: Multiple orgs share the same openbot_instance_id — reject to prevent cross-tenant leak
        const orgIds = [...new Set(foundInstances.map(i => i.organization_id))];
        console.error(`[crm-openbot-inbound] SECURITY: Ambiguous openbot_instance_id '${normalizedInstanceId}' found in ${orgIds.length} organizations. Rejecting to prevent cross-tenant routing.`);
        return new Response(
          JSON.stringify({ 
            error: "Ambiguous instance ID", 
            hint: "Multiple organizations share the same openbot_instance_id. Use instance_id query parameter in the webhook URL for safe routing.",
            affected_orgs: orgIds.length,
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    
    if (!instance) {
      console.error("[crm-openbot-inbound] Safe instance resolution failed for:", normalizedInstanceId);
      return new Response(
        JSON.stringify({ 
          error: "Instância não vinculada com segurança",
          instanceId: normalizedInstanceId,
          hint: queryInstanceId
            ? "A instância informada na URL não foi encontrada. Revise a configuração desta conexão no CRM e copie novamente a URL da instância."
            : "Este webhook foi bloqueado por segurança. Use a URL exclusiva da instância com ?instance_id=... e envie uma mensagem de teste para concluir o vínculo sem risco de cruzar tenants."
        }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    loggedOrganizationId = instance.organization_id;

    // --- Signature Validation Checkpoint ---
    // If the organization has a webhook_secret in crm_openbot_config, validate the signature
    const { data: openbotConfig } = await supabase
      .from("crm_openbot_config")
      .select("webhook_secret, openbot_send_url, openbot_api_key_encrypted")
      .eq("organization_id", instance.organization_id)
      .maybeSingle();

    if (openbotConfig?.webhook_secret) {
      if (!incomingSignature) {
        console.error("[crm-openbot-inbound] Missing webhook signature for org:", instance.organization_id);
        return new Response(
          JSON.stringify({ error: "Missing webhook signature", hint: "Include x-webhook-secret header with HMAC-SHA256 signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const isValid = await validateWebhookSignature(rawBody, incomingSignature, openbotConfig.webhook_secret);
      if (!isValid) {
        console.error("[crm-openbot-inbound] Invalid webhook signature for org:", instance.organization_id);
        return new Response(
          JSON.stringify({ error: "Invalid webhook signature" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.log("[crm-openbot-inbound] Webhook signature validated successfully");
    }

    // 2. Determine sender_type using CORRECTED 4-Pillar Architecture:
    // 
    // CRITICAL FIX: `apenasWebhookSaida` indicates FLOW CONFIGURATION, NOT message sender!
    // It means "this flow is in webhook-only mode" - ALL messages from this flow have this flag.
    // Customer messages also arrive with apenasWebhookSaida=true when flow is in webhook mode.
    // 
    // CORRECT DETECTION: Use ONLY `fromMe` to determine sender:
    //
    // PILLAR 1 (ENTRADA): Cliente → Meta → OpenBot → CRM
    //   - fromMe=false → sender_type="customer"
    //
    // PILLAR 2 (IA): OpenBot responde via Meta e espelha
    //   - fromMe=true, source="ia" (when OpenBot sends this field) → sender_type="ia"
    //   - Currently OpenBot does NOT mirror IA responses, so we can't detect them yet
    //
    // PILLAR 3 (HUMANO CRM): CRM → OpenBot → Meta → Cliente
    //   - Mensagem enviada pelo CRM, depois espelhada pelo webhook
    //   - fromMe=true, match recent CRM message → UPDATE existing (don't duplicate)
    //
    // PILLAR 4 (HUMANO WHATSAPP): Humano WhatsApp → Meta → OpenBot → CRM
    //   - Mensagem enviada manualmente pelo app WhatsApp (número da empresa)
    //   - fromMe=true, no match in CRM → sender_type="attendant"
    //
    // DECISION LOGIC (simplified until OpenBot sends IA indicator):
    // 1. fromMe=false → "customer" (PILLAR 1)
    // 2. fromMe=true → Check CRM dedupe, else "attendant" (PILLAR 3/4)
    // 3. When OpenBot implements IA indicator, we'll differentiate PILLAR 2

    let senderType: "customer" | "ia" | "attendant" = "customer";
    let decision: "customer" | "ia" | "attendant" | "mirror_deduped" | "duplicate" | "ignored_empty" = "customer";
    
    // Log the detection context (apenasWebhookSaida is flow config, NOT sender indicator)
    console.log("[crm-openbot-inbound] Sender detection (CORRECTED):", { 
      fromMe, 
      apenasWebhookSaida: fluxo?.apenasWebhookSaida,
      note: "apenasWebhookSaida is FLOW CONFIG, not sender indicator"
    });
    
    if (!fromMe) {
      // PILLAR 1: Customer message (fromMe=false)
      senderType = "customer";
      decision = "customer";
      console.log("[crm-openbot-inbound] ✓ PILLAR 1: Customer message (fromMe=false)");
    } else {
      // fromMe=true - Could be PILLAR 2 (IA), PILLAR 3 (CRM mirror), or PILLAR 4 (Manual WhatsApp)
      // Currently we can't distinguish IA (PILLAR 2) because OpenBot doesn't mirror IA responses.
      // When it does, messages may have a `source: "ia"` field or similar.
      // For now: dedupe for CRM, else treat as attendant.
      senderType = "ia";
      decision = "ia";
      console.log("[crm-openbot-inbound] ? PILLAR 2/4: Outbound candidate (fromMe=true), default=ia, will check dedupe");
    }

    // 3. Check for duplicate message by openbot_message_id
    const { data: existingMessage } = await supabase
      .from("messages")
      .select("id")
      .eq("openbot_message_id", metaMessageId)
      .maybeSingle();

    if (existingMessage) {
      console.log("[crm-openbot-inbound] Duplicate message by metaMessageId, ignoring:", metaMessageId);
      decision = "duplicate";
      
      // Log duplicate event with full instrumentation
      await supabase.from("crm_webhook_events").insert({
        organization_id: instance.organization_id,
        event_type: "inbound",
        status: "duplicate",
        instance_id: instanceId,
        phone: chatId.replace(/\D/g, "").substring(0, 6) + "****",
        payload: { 
          ...instrumentationData,
          decision,
          reason: "duplicate_message_id", 
        },
        processing_time_ms: Date.now() - startTime,
      });
      
      return new Response(
        JSON.stringify({ success: true, message: "Duplicate message ignored" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. UPSERT contact using ON CONFLICT to handle race conditions
    const phoneClean = chatId.replace(/\D/g, "");
    loggedPhone = phoneClean.substring(0, 6) + "****";
    
    // First try to find existing contact
    const { data: existingContact } = await supabase
      .from("contacts")
      .select("id, pipeline_stage_id, is_blocked, tags")
      .eq("organization_id", instance.organization_id)
      .eq("phone", phoneClean)
      .maybeSingle();

    let contactId: string;
    let needsStageAssignment = false;
    let isBlocked = false;
    let contactTags: string[] = [];

    if (existingContact) {
      contactId = existingContact.id;
      isBlocked = existingContact.is_blocked || false;
      contactTags = (existingContact.tags as string[] | null) || [];
      
      // Update contact info - ONLY update name for customer messages (inbound)
      // Don't overwrite customer name with IA/attendant pushName
      if (senderType === "customer") {
        await supabase
          .from("contacts")
          .update({ 
            name: pushName,
            last_interaction_at: new Date().toISOString() 
          })
          .eq("id", contactId);
        console.log("[crm-openbot-inbound] Existing contact updated with name:", contactId, pushName);
      } else {
        // IA/attendant message - only update timestamp, preserve customer name
        await supabase
          .from("contacts")
          .update({ 
            last_interaction_at: new Date().toISOString() 
          })
          .eq("id", contactId);
        console.log("[crm-openbot-inbound] Existing contact timestamp updated (name preserved):", contactId);
      }
    } else {
      // Insert new contact - use upsert to handle race conditions
      // For IA/attendant messages (outbound), don't set name - it would be the bot name, not customer
      const contactData = {
        organization_id: instance.organization_id,
        instance_id: instance.id,
        phone: phoneClean,
        name: senderType === "customer" ? pushName : null, // Only set name for customer messages
        last_interaction_at: new Date().toISOString(),
      };
      
      const { data: newContact, error: contactError } = await supabase
        .from("contacts")
        .upsert(contactData, { onConflict: "organization_id,phone" })
        .select("id, pipeline_stage_id, is_blocked")
        .single();

      if (contactError) {
        // If upsert fails, try to fetch existing contact (race condition)
        const { data: raceContact } = await supabase
          .from("contacts")
          .select("id, pipeline_stage_id, is_blocked")
          .eq("organization_id", instance.organization_id)
          .eq("phone", phoneClean)
          .single();
        
        if (raceContact) {
          contactId = raceContact.id;
          isBlocked = raceContact.is_blocked || false;
          console.log("[crm-openbot-inbound] Contact found after race condition:", contactId);
        } else {
          console.error("[crm-openbot-inbound] Error creating contact:", contactError);
          throw contactError;
        }
      } else {
        contactId = newContact.id;
        isBlocked = newContact.is_blocked || false;
        needsStageAssignment = !newContact.pipeline_stage_id;
        console.log("[crm-openbot-inbound] New contact created:", contactId);
      }
    }

    // Check if contact is blocked - skip processing but log the event
    if (isBlocked) {
      console.log("[crm-openbot-inbound] Contact is blocked, skipping message processing:", contactId);
      
      await supabase.from("crm_webhook_events").insert({
        organization_id: instance.organization_id,
        event_type: "inbound",
        status: "blocked",
        instance_id: instanceId,
        phone: loggedPhone,
        payload: {
          ...instrumentationData,
          decision: "blocked",
          reason: "contact_is_blocked",
        },
        processing_time_ms: Date.now() - startTime,
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Message ignored - contact is blocked",
          contactId 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── HUMAN HANDOVER: Check if contact has 'human' tag → pause bot ──
    // When a contact is tagged "human", the bot/automation must NOT respond.
    // The message is still saved to CRM for manual handling, but we return
    // `desativarFluxo: true` to instruct OpenBot to pause its native flow
    // for this specific contact.
    const HUMAN_TAG = "human";
    const hasHumanTag = contactTags.some(
      (t) => typeof t === "string" && t.toLowerCase().trim() === HUMAN_TAG
    );

    // --- Keyword Rule Matching ---
    // Check pipeline_keyword_rules for automatic stage assignment
    const { data: keywordRules } = await supabase
      .from("pipeline_keyword_rules")
      .select("id, keyword, match_mode, target_pipeline_id, target_stage_id, apply_on, priority")
      .eq("organization_id", instance.organization_id)
      .eq("is_active", true)
      .order("priority", { ascending: false });

    let keywordMatched = false;
    if (keywordRules && keywordRules.length > 0 && senderType === "customer") {
      const contentLower = content.toLowerCase();
      for (const rule of keywordRules) {
        // first_message rules only apply to new contacts
        if (rule.apply_on === "first_message" && !needsStageAssignment) continue;
        // any_message rules apply to all customer messages (new or existing)

        const keywordLower = rule.keyword.toLowerCase();
        const matched = rule.match_mode === "exact"
          ? contentLower === keywordLower
          : contentLower.includes(keywordLower);

        if (matched) {
          await supabase
            .from("contacts")
            .update({ pipeline_stage_id: rule.target_stage_id })
            .eq("id", contactId);
          keywordMatched = true;
          console.log("[crm-openbot-inbound] Keyword rule matched:", rule.keyword, "-> stage:", rule.target_stage_id);
          break; // First match wins (highest priority)
        }
      }
    }

    // Assign default pipeline stage if needed and no keyword rule matched
    if (needsStageAssignment && !keywordMatched) {
      const { data: pipeline } = await supabase
        .from("pipelines")
        .select("id")
        .eq("organization_id", instance.organization_id)
        .eq("is_default", true)
        .maybeSingle();
      
      if (pipeline) {
        const { data: stage } = await supabase
          .from("stages")
          .select("id")
          .eq("pipeline_id", pipeline.id)
          .order("order_index")
          .limit(1)
          .maybeSingle();
        
        if (stage) {
          await supabase
            .from("contacts")
            .update({ pipeline_stage_id: stage.id })
            .eq("id", contactId);
          console.log("[crm-openbot-inbound] Assigned default stage:", stage.id);
        }
      }
    }

    // --- Lead Rotation (Round-Robin) ---
    // Only for new contacts (needsStageAssignment) and customer messages
    if (needsStageAssignment && senderType === "customer") {
      const { data: rotationConfigs } = await supabase
        .from("lead_rotation_config")
        .select("id, team_profile_id, keyword_filter, last_assigned_member_id")
        .eq("organization_id", instance.organization_id)
        .eq("is_enabled", true);

      if (rotationConfigs && rotationConfigs.length > 0) {
        const contentLower = content.toLowerCase();
        
        for (const config of rotationConfigs) {
          // Check keyword filter if set
          if (config.keyword_filter && !contentLower.includes(config.keyword_filter.toLowerCase())) {
            continue;
          }

          // Get active members for this profile
          const { data: activeMembers } = await supabase
            .from("team_members")
            .select("id, user_id")
            .eq("organization_id", instance.organization_id)
            .eq("team_profile_id", config.team_profile_id)
            .eq("is_active", true)
            .order("created_at");

          if (!activeMembers || activeMembers.length === 0) continue;

          // Round-robin: find next member after last_assigned
          let nextIndex = 0;
          if (config.last_assigned_member_id) {
            const lastIdx = activeMembers.findIndex(m => m.id === config.last_assigned_member_id);
            nextIndex = lastIdx >= 0 ? (lastIdx + 1) % activeMembers.length : 0;
          }
          const assignedMember = activeMembers[nextIndex];

          // Assign to contact
          await supabase
            .from("contacts")
            .update({ assigned_to_member_id: assignedMember.id })
            .eq("id", contactId);

          // Update rotation pointer
          await supabase
            .from("lead_rotation_config")
            .update({ last_assigned_member_id: assignedMember.id })
            .eq("id", config.id);

          // Also assign conversation to the member's user_id
          const { data: existingConvForAssign } = await supabase
            .from("conversations")
            .select("id")
            .eq("contact_id", contactId)
            .eq("instance_id", instance.id)
            .maybeSingle();
          if (existingConvForAssign) {
            await supabase
              .from("conversations")
              .update({ assigned_to: assignedMember.user_id })
              .eq("id", existingConvForAssign.id);
          }

          console.log("[crm-openbot-inbound] Lead rotation assigned to member:", assignedMember.id, "user:", assignedMember.user_id);
          break; // First matching config wins
        }
      }
    }

    // 5. UPSERT conversation using ON CONFLICT to handle race conditions
    const { data: existingConv } = await supabase
      .from("conversations")
      .select("id, unread_count")
      .eq("contact_id", contactId)
      .eq("instance_id", instance.id)
      .maybeSingle();

    let conversationId: string;
    let currentUnread = 0;

    if (existingConv) {
      conversationId = existingConv.id;
      currentUnread = existingConv.unread_count || 0;
      console.log("[crm-openbot-inbound] Existing conversation found:", conversationId);
    } else {
      // Insert new conversation - use upsert to handle race conditions
      const { data: newConv, error: convError } = await supabase
        .from("conversations")
        .upsert(
          {
            contact_id: contactId,
            instance_id: instance.id,
            status: "active",
            last_message_at: new Date().toISOString(),
            last_message_preview: generateMessagePreview(contentType, content),
            last_sender_type: senderType,
            unread_count: senderType === "customer" ? 1 : 0,
          },
          { onConflict: "contact_id,instance_id" }
        )
        .select("id, unread_count")
        .single();

      if (convError) {
        // If upsert fails, try to fetch existing conversation (race condition)
        const { data: raceConv } = await supabase
          .from("conversations")
          .select("id, unread_count")
          .eq("contact_id", contactId)
          .eq("instance_id", instance.id)
          .single();
        
        if (raceConv) {
          conversationId = raceConv.id;
          currentUnread = raceConv.unread_count || 0;
          console.log("[crm-openbot-inbound] Conversation found after race condition:", conversationId);
        } else {
          console.error("[crm-openbot-inbound] Error creating conversation:", convError);
          throw convError;
        }
      } else {
        conversationId = newConv.id;
        currentUnread = newConv.unread_count || 0;
        console.log("[crm-openbot-inbound] New conversation created:", conversationId);
      }
    }

    // 6. For ATTENDANT messages (fromMe=true), check for CRM deduplication (PILLAR 3 vs PILLAR 4)
    if (senderType === "attendant") {
      // Look for a recent outbound message from CRM (last 30 seconds) with same content
      const thirtySecondsAgo = new Date(Date.now() - 30000).toISOString();
      
      const { data: recentCrmMessage } = await supabase
        .from("messages")
        .select("id, openbot_message_id")
        .eq("conversation_id", conversationId)
        .eq("direction", "outbound")
        .eq("sender_type", "attendant")
        .eq("content", content)
        .gte("created_at", thirtySecondsAgo)
        .is("openbot_message_id", null) // Message sent from CRM won't have openbot_message_id yet
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentCrmMessage) {
        // PILLAR 3: This is a mirror of a CRM-sent message - update existing instead of creating new
        console.log("[crm-openbot-inbound] ✓ PILLAR 3: CRM mirror detected, updating existing message:", recentCrmMessage.id);
        decision = "mirror_deduped";

        // Update existing message with openbot_message_id
        await supabase
          .from("messages")
          .update({ 
            openbot_message_id: metaMessageId,
            status: "delivered",
          })
          .eq("id", recentCrmMessage.id);

        // Log deduped event with full instrumentation
        await supabase.from("crm_webhook_events").insert({
          organization_id: instance.organization_id,
          event_type: "inbound",
          status: "success",
          instance_id: instanceId,
          phone: loggedPhone,
          payload: {
            ...instrumentationData,
            decision,
            reason: "crm_mirror_deduped",
            existingMessageId: recentCrmMessage.id,
          },
          response: {
            messageId: recentCrmMessage.id,
            conversationId,
            contactId,
            action: "updated_openbot_id",
          },
          processing_time_ms: Date.now() - startTime,
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            messageId: recentCrmMessage.id,
            action: "mirror_deduped",
            senderType,
            conversationId 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        // PILLAR 4: Manual WhatsApp or IA message - not from CRM, so classify as IA
        console.log("[crm-openbot-inbound] ✓ PILLAR 4: Non-CRM outbound message (no recent CRM match) → ia");
        decision = "ia";
      }
    }

    // 7. Insert message
    let messageTimestamp: string;
    if (timestamp) {
      const ts = Number(timestamp);
      const tsMs = ts > 9999999999 ? ts : ts * 1000;
      const parsed = new Date(tsMs);
      if (parsed.getFullYear() >= 2020 && parsed.getFullYear() <= 2030) {
        messageTimestamp = parsed.toISOString();
      } else {
        console.warn("[crm-openbot-inbound] Timestamp out of range, using now:", ts);
        messageTimestamp = new Date().toISOString();
      }
    } else {
      messageTimestamp = new Date().toISOString();
    }

    // Build metadata with OpenBot instrumentation
    // 7.4 Store audio in Supabase storage to prevent WhatsApp URL expiration
    let finalMediaUrl = mediaUrl || null;
    if (mediaUrl && ["audio", "image", "video", "document"].includes(contentType)) {
      try {
        let mediaBuffer: Uint8Array | null = null;
        let storageMime = mediaMimeType || "application/octet-stream";

        // Log media extraction diagnostics
        console.log("[crm-openbot-inbound] Media extraction:", {
          hasMediaUrl: !!mediaUrl,
          hasMediaKey: !!mediaKey,
          mediaMessageType,
          mediaMimeType,
          urlPrefix: mediaUrl.substring(0, 30),
        });

        if (mediaUrl.startsWith("data:")) {
          // Base64 data URL - decode directly
          const base64Match = mediaUrl.match(/^data:(.+?);base64,(.+)$/);
          if (base64Match) {
            storageMime = base64Match[1];
            const raw = atob(base64Match[2]);
            mediaBuffer = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) mediaBuffer[i] = raw.charCodeAt(i);
          }
        } else if (mediaUrl.startsWith("http") && mediaKey && mediaMessageType) {
          // WhatsApp E2E encrypted media (Baileys) - download + decrypt
          console.log("[crm-openbot-inbound] Attempting WhatsApp E2E media decryption");
          try {
            const mediaResp = await fetchWithRetry(mediaUrl, {});
            if (mediaResp.ok) {
              const encrypted = new Uint8Array(await mediaResp.arrayBuffer());
              console.log("[crm-openbot-inbound] Downloaded encrypted media, size:", encrypted.length);
              
              try {
                const decrypted = await decryptWhatsAppMedia(encrypted, mediaKey, mediaMessageType);
                console.log("[crm-openbot-inbound] Decrypted media, size:", decrypted.length);
                
                if (isValidMediaBytes(decrypted, storageMime)) {
                  mediaBuffer = decrypted;
                  console.log("[crm-openbot-inbound] Decrypted media validated OK");
                } else {
                  console.warn("[crm-openbot-inbound] Decrypted media failed magic byte check:", {
                    firstBytes: Array.from(decrypted.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
                  });
                  // Fallback: try raw bytes (maybe URL was already decrypted)
                  if (isValidMediaBytes(encrypted, storageMime)) {
                    mediaBuffer = encrypted;
                    console.log("[crm-openbot-inbound] Fallback: raw bytes are valid media");
                  }
                }
              } catch (decryptErr) {
                console.warn("[crm-openbot-inbound] Decryption algorithm failed:", decryptErr);
                // Fallback: try raw download if decryption fails
                if (isValidMediaBytes(encrypted, storageMime)) {
                  mediaBuffer = encrypted;
                  console.log("[crm-openbot-inbound] Fallback: raw bytes valid after decrypt failure");
                }
              }
            } else {
              console.warn("[crm-openbot-inbound] Failed to download encrypted media:", mediaResp.status);
            }
          } catch (dlErr) {
            console.warn("[crm-openbot-inbound] Encrypted media download failed:", dlErr);
          }
        } else if (mediaUrl.startsWith("http")) {
          // External URL without mediaKey - direct download with strict validation
          console.log("[crm-openbot-inbound] External media URL (no mediaKey), attempting direct download");
          try {
            const mediaResp = await fetchWithRetry(mediaUrl, {});
            if (mediaResp.ok) {
              const respContentType = mediaResp.headers.get("content-type") || "";
              const buffer = new Uint8Array(await mediaResp.arrayBuffer());
              
              const isValidMedia = !respContentType.includes("text/html") 
                && !respContentType.includes("application/xml")
                && buffer.length > 1024
                && isValidMediaBytes(buffer, storageMime);
              
              if (isValidMedia) {
                mediaBuffer = buffer;
                console.log("[crm-openbot-inbound] Direct download succeeded, size:", buffer.length);
              } else {
                console.warn("[crm-openbot-inbound] Direct download rejected (encrypted/invalid):", {
                  contentType: respContentType,
                  size: buffer.length,
                  firstBytes: Array.from(buffer.slice(0, 8)).map(b => b.toString(16).padStart(2, '0')).join(' '),
                });
                finalMediaUrl = null;
              }
            } else {
              console.warn("[crm-openbot-inbound] Failed to download media:", mediaResp.status);
            }
          } catch (dlErr) {
            console.warn("[crm-openbot-inbound] Direct download failed:", dlErr);
          }
        }

        // If no valid media was obtained after all attempts, ensure finalMediaUrl is null
        if (!mediaBuffer || mediaBuffer.length === 0) {
          finalMediaUrl = null;
          console.log("[crm-openbot-inbound] No valid media obtained, setting finalMediaUrl to null");
        }

        if (mediaBuffer && mediaBuffer.length > 0) {
          // Check storage limit before uploading
          let storageAllowed = true;
          try {
            const { data: usage } = await supabase
              .from("organization_storage_usage")
              .select("used_bytes")
              .eq("organization_id", instance.organization_id)
              .maybeSingle();

            const { data: sub } = await supabase
              .from("subscriptions")
              .select("plan_id, subscription_plans(limits)")
              .eq("organization_id", instance.organization_id)
              .eq("status", "active")
              .maybeSingle();

            const planLimits = (sub as any)?.subscription_plans?.limits as Record<string, unknown> | undefined;
            const storageLimitMB = (planLimits?.storage_limit_mb as number) ?? 500;
            const usedBytes = usage?.used_bytes || 0;
            if (usedBytes >= storageLimitMB * 1024 * 1024) {
              storageAllowed = false;
              console.warn("[crm-openbot-inbound] Storage limit reached, skipping media upload");
            }
          } catch (limitErr) {
            console.warn("[crm-openbot-inbound] Failed to check storage limit:", limitErr);
          }

          if (storageAllowed) {
            const normalizedMime = storageMime.replace(/\s*;\s*/g, ";");
            const mimeExtMap: Record<string, string> = {
              "ogg": "ogg", "mp4": "mp4", "webm": "webm", "m4a": "m4a",
              "mpeg": "mp3", "wav": "wav", "jpeg": "jpg", "png": "png",
              "gif": "gif", "pdf": "pdf", "mp4v": "mp4",
              "msword": "doc", "wordprocessing": "docx",
              "presentation": "pptx", "spreadsheet": "xlsx",
            };
            const mimeKey = Object.keys(mimeExtMap).find(k => normalizedMime.includes(k));
            const ext = mimeKey ? mimeExtMap[mimeKey] : "bin";
            const storagePath = `${instance.organization_id}/${crypto.randomUUID()}.${ext}`;
            
            const { error: uploadErr } = await supabase.storage
              .from("message-media")
              .upload(storagePath, mediaBuffer, {
                contentType: normalizedMime,
                upsert: false,
              });

            if (!uploadErr) {
              const { data: publicUrlData } = supabase.storage
                .from("message-media")
                .getPublicUrl(storagePath);
              finalMediaUrl = publicUrlData.publicUrl;
              // Recalculate storage usage accurately
              try {
                await supabase.rpc("recalculate_org_storage", { p_org_id: instance.organization_id });
              } catch (usageErr) {
                console.warn("[crm-openbot-inbound] Failed to recalculate storage usage:", usageErr);
              }
              console.log("[crm-openbot-inbound] Media stored in storage:", storagePath);
            } else {
              console.warn("[crm-openbot-inbound] Storage upload error:", uploadErr);
            }
          }
        }
      } catch (storageErr) {
        console.warn("[crm-openbot-inbound] Media storage error:", storageErr);
        // Keep original URL as fallback
      }
    }

    const messageMetadata = {
      openbot: {
        fromMe,
        apenasWebhookSaida: fluxo?.apenasWebhookSaida ?? null,
        instanceId,
        pushName,
        metaMessageId,
        detectedFormat,
        fluxoId: fluxo?.id ?? null,
        fluxoNome: fluxo?.nome ?? null,
      }
    };

    const { data: newMessage, error: msgError } = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        organization_id: instance.organization_id,
        content,
        content_type: contentType,
        direction: senderType === "customer" ? "inbound" : "outbound",
        sender_type: senderType,
        status: senderType === "customer" ? "delivered" : "sent",
        openbot_message_id: metaMessageId,
        timestamp: messageTimestamp,
        metadata: messageMetadata,
        media_url: finalMediaUrl,
        media_mime_type: mediaMimeType || null,
      })
      .select("id")
      .single();

    if (msgError) {
      console.error("[crm-openbot-inbound] Error inserting message:", msgError);
      throw msgError;
    }

    // 7.5 Fire-and-forget audio transcription if it's an audio message
    if (contentType === "audio" && finalMediaUrl) {
      const transcribeUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/transcribe-audio`;
      fetch(transcribeUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify({
          message_id: newMessage.id,
          audio_url: finalMediaUrl,
          mime_type: mediaMimeType || null,
        }),
      }).catch(err => console.warn("[crm-openbot-inbound] Transcription fire-and-forget error:", err));
      console.log("[crm-openbot-inbound] Audio transcription triggered for message:", newMessage.id);
    }

    // 8. Update conversation preview and unread count
    const newUnreadCount = senderType === "customer" ? currentUnread + 1 : 0;
    
    await supabase
      .from("conversations")
      .update({
        last_message_at: messageTimestamp,
        last_message_preview: generateMessagePreview(contentType, content),
        last_sender_type: senderType,
        unread_count: newUnreadCount,
      })
      .eq("id", conversationId);

    // 8.5 Meta Window Management - track 24h/72h window for meta_official instances
    const instanceData = instance as any;
    const isMetaInstance = instanceData.provider === "meta_official" || (!instanceData.openbot_api_key_encrypted && instanceData.api_key_encrypted);
    console.log("[crm-openbot-inbound] Meta window check:", { senderType, provider: instanceData.provider, isMetaInstance, hasApiKey: !!instanceData.api_key_encrypted });
    if (senderType === "customer" && isMetaInstance) {
      try {
        // Detect campaign referral (72h window) vs normal (24h)
        const rawPayloadObj = rawPayload as Record<string, unknown>;
        const hasReferral = !!(rawPayloadObj.referral || 
          (rawPayloadObj.message && (rawPayloadObj.message as any).referral));
        const contentLower = content.toLowerCase();
        const isCampaign = hasReferral || 
          contentLower.includes("anúncio do instagram") || 
          contentLower.includes("mostrar detalhes") ||
          contentLower.includes("ad_id");
        
        const windowHours = isCampaign ? 72 : 24;
        const windowExpiresAt = new Date(Date.now() + windowHours * 60 * 60 * 1000).toISOString();
        
        await supabase
          .from("meta_conversation_windows")
          .upsert({
            conversation_id: conversationId,
            window_type: isCampaign ? "72h" : "24h",
            window_expires_at: windowExpiresAt,
            last_customer_message_at: messageTimestamp,
            is_from_campaign: isCampaign,
          }, { onConflict: "conversation_id" });
        
        console.log(`[crm-openbot-inbound] Meta window set: ${windowHours}h, campaign=${isCampaign}`);
      } catch (windowErr) {
        console.warn("[crm-openbot-inbound] Failed to update meta window:", windowErr);
      }
    }

    console.log("[crm-openbot-inbound] Message processed successfully:", {
      messageId: newMessage.id,
      senderType,
      decision,
      conversationId,
    });

    // Log success event with full instrumentation
    await supabase.from("crm_webhook_events").insert({
      organization_id: instance.organization_id,
      event_type: "inbound",
      status: "success",
      instance_id: instanceId,
      phone: loggedPhone,
      payload: {
        ...instrumentationData,
        decision,
      },
      response: {
        messageId: newMessage.id,
        conversationId,
        contactId,
      },
      processing_time_ms: Date.now() - startTime,
    });

    if (hasHumanTag && senderType === "customer") {
      console.log(`[crm-openbot-inbound] HUMAN HANDOVER: contact ${contactId} has 'human' tag → instructing OpenBot to pause flow`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: newMessage.id,
        senderType,
        decision,
        conversationId,
        // Instructs OpenBot to pause its native flow for this contact when in human handover mode
        ...(hasHumanTag && senderType === "customer" ? { desativarFluxo: true, humanHandover: true } : {}),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("[crm-openbot-inbound] error:", error, getErrorMessage(error));

    if (loggedOrganizationId) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
        );
        await supabase.from("crm_webhook_events").insert({
          organization_id: loggedOrganizationId,
          event_type: "inbound",
          status: "error",
          instance_id: loggedInstanceId,
          phone: loggedPhone,
          payload: { error: "processing_failed" },
          error_message: getErrorMessage(error).slice(0, 500),
          processing_time_ms: Date.now() - startTime,
        });
      } catch (logError) {
        console.error("[crm-openbot-inbound] Failed to log error event:", logError);
      }
    }

    return new Response(
      JSON.stringify({ error: "internal_error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
