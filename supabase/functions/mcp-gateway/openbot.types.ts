/**
 * Openbot MCP Gateway - Type Definitions
 * 
 * This file defines the TypeScript interfaces for the two payload formats
 * sent by Openbot (Baileys and Official WhatsApp API), plus the internal
 * standardized message format used throughout the MCP Gateway pipeline.
 * 
 * 100% ISOLATED - Does not depend on or affect any existing CRM code.
 */

// ============================================================
// Payload Baileys (Media via URL)
// ============================================================

export interface BaileysMediaMessage {
  url: string;
  mimetype: string;
  fileSha256?: string;
  fileLength?: string;
  seconds?: number;
  ptt?: boolean;
  directPath?: string;
  mediaKey?: string;
  waveform?: string;
  caption?: string;
  fileName?: string;
}

export interface OpenbotBaileysPayload {
  instanceId: string;
  chatId: string;
  fromMe: boolean;
  messageType:
    | "conversation"
    | "audioMessage"
    | "imageMessage"
    | "videoMessage"
    | "documentMessage";
  timestamp: number;
  pushName: string;
  message: {
    conversation?: string;
    audioMessage?: BaileysMediaMessage;
    imageMessage?: BaileysMediaMessage;
    videoMessage?: BaileysMediaMessage;
    documentMessage?: BaileysMediaMessage;
  };
  fluxo: {
    id: string;
    nome: string;
    palavraChave: string;
    apenasWebhookSaida: boolean;
    gatilhoPorConversaIniciada: boolean;
  };
  key: {
    remoteJid: string;
    id: string;
    fromMe: boolean;
  };
}

// ============================================================
// Payload API Oficial (Media in Base64)
// ============================================================

export interface OpenbotOfficialPayload {
  instanceId: string;
  chatId: string;
  fromMe: boolean;
  messageType: "text" | "audio" | "image" | "video" | "document";
  timestamp: number;
  pushName: string;
  message?: {
    conversation: string;
  };
  media?: {
    mimetype: string;
    data: string; // Base64
    size: number;
  };
  fluxo: {
    id: string;
    nome: string;
    palavraChave: string;
    apenasWebhookSaida: boolean;
    gatilhoPorConversaIniciada: boolean;
  };
  key: {
    remoteJid: string;
    id: string;
    fromMe: boolean;
  };
}

// ============================================================
// Union Type & Type Guard
// ============================================================

export type OpenbotPayload = OpenbotBaileysPayload | OpenbotOfficialPayload;

/**
 * Differentiates Baileys payloads from Official API payloads.
 * Baileys uses nested message objects (audioMessage, imageMessage, etc.)
 * while Official uses a top-level `media` object with Base64 data.
 */
export function isBaileysPayload(
  payload: OpenbotPayload
): payload is OpenbotBaileysPayload {
  const baileysTypes = [
    "conversation",
    "audioMessage",
    "imageMessage",
    "videoMessage",
    "documentMessage",
  ];
  return baileysTypes.includes(payload.messageType);
}

// ============================================================
// Standardized Internal Message (Output of normalization)
// ============================================================

export interface StandardizedMessage {
  chatId: string;
  instanceId: string;
  senderName: string;
  messageType: "text" | "audio" | "image" | "video" | "document";
  textContent?: string;
  mediaContent?: {
    mimetype: string;
    base64Data: string;
  };
  fluxoId: string;
  isBaileys: boolean;
}
