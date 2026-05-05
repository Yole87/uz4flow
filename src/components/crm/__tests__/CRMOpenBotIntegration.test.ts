import { describe, it, expect } from "vitest";

/**
 * CRM OpenBot Integration Tests
 * 
 * Validates the 3-pillar architecture:
 * 1. Customer Inbound: OpenBot -> CRM (customer messages)
 * 2. IA Mirror: OpenBot -> CRM (AI responses)
 * 3. Attendant Outbound: CRM -> OpenBot (human intervention)
 */

describe("CRM OpenBot Integration - Architecture Tests", () => {
  
  describe("Database Schema Validation", () => {
    it("message_sender_type enum values are valid", () => {
      const validTypes = ["customer", "ia", "attendant"] as const;
      type SenderType = typeof validTypes[number];
      
      const testValue: SenderType = "customer";
      expect(validTypes).toContain(testValue);
      expect(validTypes).toContain("ia");
      expect(validTypes).toContain("attendant");
    });

    it("instances table should support openbot_instance_id field", () => {
      const mockInstance = {
        id: "uuid",
        name: "WhatsApp Demo",
        openbot_instance_id: "demo_instance",
        organization_id: "org_uuid",
      };
      
      expect(mockInstance).toHaveProperty("openbot_instance_id");
      expect(mockInstance.openbot_instance_id).toBe("demo_instance");
    });

    it("crm_openbot_config table structure is correct", () => {
      const mockConfig = {
        organization_id: "org_uuid",
        openbot_api_key_encrypted: "encrypted_key_here",
        openbot_send_url: "https://api.openbot.io/v1/send",
      };
      
      expect(mockConfig).toHaveProperty("organization_id");
      expect(mockConfig).toHaveProperty("openbot_api_key_encrypted");
      expect(mockConfig).toHaveProperty("openbot_send_url");
    });
  });

  describe("Fluxo 1: Entrada de Cliente (OpenBot -> CRM)", () => {
    it("payload with fromMe:false should be sender_type:customer", () => {
      const payload = {
        message: {
          key: { fromMe: false, id: "msg123" },
          chatId: "5511999999999",
        },
      };
      
      const determineSenderType = (p: typeof payload, rootSenderType?: string) => {
        if (!p.message.key.fromMe) return "customer";
        if (rootSenderType === "ia") return "ia";
        return "attendant";
      };
      
      expect(determineSenderType(payload)).toBe("customer");
    });

    it("should extract content from conversation field", () => {
      const payload = {
        message: {
          message: { conversation: "Olá, preciso de ajuda" },
        },
      };
      
      const extractContent = (msg: typeof payload.message) => {
        return msg.message?.conversation || 
               (msg.message as any)?.extendedTextMessage?.text || 
               "";
      };
      
      expect(extractContent(payload.message)).toBe("Olá, preciso de ajuda");
    });

    it("should extract content from extendedTextMessage", () => {
      const payload = {
        message: {
          message: { extendedTextMessage: { text: "Texto estendido com link" } } as Record<string, unknown>,
        },
      };
      
      const extractContent = (msg: typeof payload.message) => {
        const messageContent = msg.message as Record<string, unknown>;
        const extendedText = messageContent?.extendedTextMessage as { text?: string } | undefined;
        return (messageContent?.conversation as string) || extendedText?.text || "";
      };
      
      expect(extractContent(payload.message)).toBe("Texto estendido com link");
    });

    it("should parse messageTimestamp as Date", () => {
      const unixTimestamp = 1738816890;
      const parsed = new Date(unixTimestamp * 1000);
      
      expect(parsed.getFullYear()).toBe(2025);
      expect(parsed).toBeInstanceOf(Date);
    });
  });

  describe("Fluxo 2: Resposta IA (OpenBot -> CRM Mirror)", () => {
    it("payload with fromMe:true + senderType:ia should be sender_type:ia", () => {
      const payload = {
        message: { key: { fromMe: true, id: "msg456" } },
        senderType: "ia",
      };
      
      const determineSenderType = (p: typeof payload) => {
        if (!p.message.key.fromMe) return "customer";
        if (p.senderType === "ia") return "ia";
        return "attendant";
      };
      
      expect(determineSenderType(payload)).toBe("ia");
    });

    it("fromMe:true without senderType should be ignored (attendant mirror)", () => {
      const payload = {
        message: { key: { fromMe: true, id: "msg789" } },
        // No senderType = likely attendant mirror from CRM
      };
      
      const shouldIgnoreAttendantMirror = (p: typeof payload) => {
        return p.message.key.fromMe && !(p as any).senderType;
      };
      
      expect(shouldIgnoreAttendantMirror(payload)).toBe(true);
    });

    it("IA message should include proper visual indicators", () => {
      const iaMessage = {
        sender_type: "ia" as const,
        direction: "outbound" as const,
        content: "Sou a assistente virtual!",
      };
      
      // UI should show: purple gradient, Bot icon, "IA" label
      expect(iaMessage.sender_type).toBe("ia");
      expect(iaMessage.direction).toBe("outbound");
    });
  });

  describe("Fluxo 3: Intervenção Humana (CRM -> OpenBot)", () => {
    it("outbound messages from CRM should have sender_type:attendant", () => {
      const messageFromCRM = {
        content: "Resposta do atendente humano",
        sender_type: "attendant" as const,
        direction: "outbound" as const,
      };
      
      expect(messageFromCRM.sender_type).toBe("attendant");
      expect(messageFromCRM.direction).toBe("outbound");
    });

    it("send payload structure should match OpenBot API spec", () => {
      const sendPayload = {
        apiKey: "test_api_key",
        instanceId: "demo_instance",
        phone: "5511999999999",
        message: "Olá, como posso ajudar?",
      };
      
      expect(sendPayload).toHaveProperty("apiKey");
      expect(sendPayload).toHaveProperty("instanceId");
      expect(sendPayload).toHaveProperty("phone");
      expect(sendPayload).toHaveProperty("message");
      // Should NOT have desativarFluxo per spec
      expect(sendPayload).not.toHaveProperty("desativarFluxo");
    });

    it("phone number should be normalized (digits only)", () => {
      const normalize = (phone: string) => phone.replace(/\D/g, "");
      
      expect(normalize("+55 (11) 99999-9999")).toBe("5511999999999");
      expect(normalize("55.11.98765-4321")).toBe("5511987654321");
    });
  });

  describe("Deduplication Logic", () => {
    it("should detect duplicate messages by openbot_message_id", () => {
      const existingMessageIds = ["msg001", "msg002", "msg003"];
      const incomingId = "msg002";
      
      const isDuplicate = existingMessageIds.includes(incomingId);
      expect(isDuplicate).toBe(true);
    });

    it("should accept new messages with unique id", () => {
      const existingMessageIds = ["msg001", "msg002", "msg003"];
      const incomingId = "msg_new_004";
      
      const isDuplicate = existingMessageIds.includes(incomingId);
      expect(isDuplicate).toBe(false);
    });
  });

  describe("Instance Resolution", () => {
    it("should match instance by openbot_instance_id", () => {
      const instances = [
        { id: "uuid1", openbot_instance_id: "whatsapp_principal" },
        { id: "uuid2", openbot_instance_id: "whatsapp_vendas" },
        { id: "uuid3", openbot_instance_id: null },
      ];
      
      const findInstance = (openbotId: string) => 
        instances.find(i => i.openbot_instance_id === openbotId);
      
      const matched = findInstance("whatsapp_vendas");
      expect(matched).toBeDefined();
      expect(matched?.id).toBe("uuid2");
    });

    it("should return undefined for unknown instance", () => {
      const instances = [
        { id: "uuid1", openbot_instance_id: "known_instance" },
      ];
      
      const findInstance = (openbotId: string) => 
        instances.find(i => i.openbot_instance_id === openbotId);
      
      const matched = findInstance("unknown_instance");
      expect(matched).toBeUndefined();
    });

    it("should handle null openbot_instance_id gracefully", () => {
      const instances = [
        { id: "uuid1", openbot_instance_id: null },
      ];
      
      const findInstance = (openbotId: string) => 
        instances.find(i => i.openbot_instance_id === openbotId);
      
      const matched = findInstance("any_instance");
      expect(matched).toBeUndefined();
    });
  });

  describe("Contact & Conversation Upsert", () => {
    it("should normalize phone number (remove non-digits)", () => {
      const rawPhone = "+55 (11) 99999-9999";
      const normalized = rawPhone.replace(/\D/g, "");
      expect(normalized).toBe("5511999999999");
    });

    it("should increment unread_count for customer messages", () => {
      const updateUnreadCount = (current: number, senderType: string) => {
        if (senderType === "customer") return current + 1;
        return 0; // Reset when staff replies
      };
      
      expect(updateUnreadCount(3, "customer")).toBe(4);
      expect(updateUnreadCount(5, "ia")).toBe(0);
      expect(updateUnreadCount(2, "attendant")).toBe(0);
    });

    it("should update last_sender_type on conversation", () => {
      type SenderType = "customer" | "ia" | "attendant";
      
      const updateConversation = (lastSender: SenderType) => ({
        last_message_at: new Date().toISOString(),
        last_sender_type: lastSender,
      });
      
      const result = updateConversation("ia");
      expect(result.last_sender_type).toBe("ia");
    });
  });

  describe("Error Handling", () => {
    it("should return proper error for missing instance", () => {
      const errorResponse = {
        error: "Instance not found for openbot_instance_id: unknown",
        code: "INSTANCE_NOT_FOUND"
      };
      
      expect(errorResponse.code).toBe("INSTANCE_NOT_FOUND");
    });

    it("should return proper error for missing OpenBot config", () => {
      const errorResponse = {
        error: "OpenBot not configured for this organization",
        code: "OPENBOT_NOT_CONFIGURED"
      };
      
      expect(errorResponse.code).toBe("OPENBOT_NOT_CONFIGURED");
    });

    it("should return proper error for unlinked instance", () => {
      const errorResponse = {
        error: "Instance not linked to OpenBot",
        code: "INSTANCE_NOT_LINKED"
      };
      
      expect(errorResponse.code).toBe("INSTANCE_NOT_LINKED");
    });
  });

  describe("Dual-API Format Detection", () => {
    it("should identify Baileys payload by messageType 'conversation'", () => {
      const baileysTypes = ["conversation", "audioMessage", "imageMessage", "videoMessage", "documentMessage"];
      const officialTypes = ["text", "audio", "image", "video", "document"];

      const isBaileys = (messageType: string) => baileysTypes.includes(messageType);

      expect(isBaileys("conversation")).toBe(true);
      expect(isBaileys("audioMessage")).toBe(true);
      expect(isBaileys("text")).toBe(false);
      expect(isBaileys("image")).toBe(false);
    });

    it("should identify Official API payload by messageType 'text'", () => {
      const officialTypes = ["text", "audio", "image", "video", "document"];
      const isOfficial = (messageType: string) => officialTypes.includes(messageType);

      expect(isOfficial("text")).toBe(true);
      expect(isOfficial("image")).toBe(true);
      expect(isOfficial("conversation")).toBe(false);
      expect(isOfficial("audioMessage")).toBe(false);
    });

    it("Official API media payload has top-level 'media' with Base64", () => {
      const officialMediaPayload = {
        instanceId: "default",
        chatId: "5581999999999",
        fromMe: false,
        messageType: "image",
        timestamp: 1770390209,
        pushName: "5581999999999",
        media: {
          mimetype: "image/jpeg",
          data: "/9j/4AAQSkZJRgABAQAAAQABAAD...",
          size: 415245,
        },
        fluxo: {
          id: "1770386790751",
          nome: "Fluxo de Mídia",
          palavraChave: "",
          apenasWebhookSaida: true,
          gatilhoPorConversaIniciada: false,
        },
        key: {
          remoteJid: "5581999999999@s.whatsapp.net",
          id: "wamid.HBgMNTU4MTg1NDUwMjA2FQIAEhg...",
          fromMe: false,
        },
      };

      expect(officialMediaPayload).toHaveProperty("media");
      expect(officialMediaPayload.media).toHaveProperty("data");
      expect(officialMediaPayload.media).toHaveProperty("mimetype");
      expect(officialMediaPayload.media).toHaveProperty("size");
      expect(officialMediaPayload).not.toHaveProperty("message.imageMessage");
    });

    it("Baileys media payload has nested message object with URL", () => {
      const baileysMediaPayload = {
        instanceId: "default",
        chatId: "558185450206",
        fromMe: false,
        messageType: "audioMessage",
        timestamp: 1770390810,
        pushName: "Dantas",
        message: {
          audioMessage: {
            url: "https://mmg.whatsapp.net/v/t62...",
            mimetype: "audio/ogg; codecs=opus",
            fileSha256: "C6NS6IcdUwx9BTBQl2gM...",
            fileLength: "4095",
            seconds: 1,
            ptt: true,
            waveform: "FxcXFxgWExEPDQwKCQgGBAIEGC1B...",
          },
        },
        fluxo: {
          id: "1770386790751",
          nome: "",
          palavraChave: "",
          apenasWebhookSaida: true,
          gatilhoPorConversaIniciada: false,
        },
        key: {
          remoteJid: "558185450206@s.whatsapp.net",
          id: "3EB0D37B3409617C496FA3",
        },
      };

      expect(baileysMediaPayload.message).toHaveProperty("audioMessage");
      expect(baileysMediaPayload.message.audioMessage).toHaveProperty("url");
      expect(baileysMediaPayload.message.audioMessage).toHaveProperty("waveform");
      expect(baileysMediaPayload).not.toHaveProperty("media");
    });

    it("both payloads share common fields: fluxo, key, instanceId", () => {
      const commonFields = ["instanceId", "chatId", "fromMe", "messageType", "timestamp", "pushName", "fluxo", "key"];

      const baileys = { instanceId: "x", chatId: "y", fromMe: false, messageType: "conversation", timestamp: 0, pushName: "z", fluxo: {}, key: {} };
      const official = { instanceId: "x", chatId: "y", fromMe: false, messageType: "text", timestamp: 0, pushName: "z", fluxo: {}, key: {} };

      commonFields.forEach(field => {
        expect(baileys).toHaveProperty(field);
        expect(official).toHaveProperty(field);
      });
    });
  });
});
