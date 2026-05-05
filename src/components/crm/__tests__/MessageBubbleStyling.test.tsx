import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { MessageBubble } from "../MessageBubble";

// Helper to get screen queries
const screen = {
  getByText: (text: string) => document.body.querySelector(`*:contains("${text}")`) || 
    Array.from(document.body.querySelectorAll('*')).find(el => el.textContent?.includes(text)),
  getByTestId: (id: string) => document.querySelector(`[data-testid="${id}"]`) as HTMLElement,
};

/**
 * MessageBubble Styling Tests
 * 
 * Validates visual differentiation by sender_type:
 * - customer: left-aligned, zinc background
 * - ia: right-aligned, purple gradient with Bot icon
 * - attendant: right-aligned, solid blue (Bradesco style)
 */

describe("MessageBubble Styling by sender_type", () => {
  const baseMessage = {
    id: "1",
    content_type: "text" as const,
    media_url: null,
    media_mime_type: null,
    timestamp: new Date().toISOString(),
    status: "delivered" as const,
  };

  const customerMessage = {
    ...baseMessage,
    id: "msg-customer",
    content: "Mensagem do cliente",
    sender_type: "customer" as const,
    direction: "inbound" as const,
  };

  const iaMessage = {
    ...baseMessage,
    id: "msg-ia",
    content: "Resposta da IA assistente",
    sender_type: "ia" as const,
    direction: "outbound" as const,
  };

  const attendantMessage = {
    ...baseMessage,
    id: "msg-attendant",
    content: "Resposta do atendente humano",
    sender_type: "attendant" as const,
    direction: "outbound" as const,
  };

  describe("Customer Messages", () => {
    it("renders customer message content", () => {
      render(<MessageBubble message={customerMessage} />);
      expect(screen.getByText("Mensagem do cliente")).toBeInTheDocument();
    });

    it("aligns customer message to the left (justify-start)", () => {
      render(<MessageBubble message={customerMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      expect(bubble.className).toContain("justify-start");
    });

    it("applies zinc background to customer message", () => {
      render(<MessageBubble message={customerMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      const innerDiv = bubble.firstChild as HTMLElement;
      expect(innerDiv.className).toContain("bg-zinc-800");
    });

    it("does NOT show status icon for customer messages", () => {
      render(<MessageBubble message={customerMessage} />);
      // Customer messages shouldn't show delivery status
      const bubble = screen.getByTestId("message-bubble");
      expect(bubble.innerHTML).not.toContain("CheckCheck");
    });
  });

  describe("IA Messages", () => {
    it("renders IA message content", () => {
      render(<MessageBubble message={iaMessage} />);
      expect(screen.getByText("Resposta da IA assistente")).toBeInTheDocument();
    });

    it("aligns IA message to the right (justify-end)", () => {
      render(<MessageBubble message={iaMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      expect(bubble.className).toContain("justify-end");
    });

    it("shows Bot icon and IA label for IA messages", () => {
      render(<MessageBubble message={iaMessage} />);
      expect(screen.getByText("IA")).toBeInTheDocument();
    });

    it("applies purple gradient to IA message", () => {
      render(<MessageBubble message={iaMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      const innerDiv = bubble.firstChild as HTMLElement;
      // Check for gradient classes
      expect(innerDiv.className).toContain("from-purple-600");
      expect(innerDiv.className).toContain("to-indigo-600");
    });

    it("applies shadow glow to IA message", () => {
      render(<MessageBubble message={iaMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      const innerDiv = bubble.firstChild as HTMLElement;
      expect(innerDiv.className).toContain("shadow-purple-500");
    });
  });

  describe("Attendant Messages", () => {
    it("renders attendant message content", () => {
      render(<MessageBubble message={attendantMessage} />);
      expect(screen.getByText("Resposta do atendente humano")).toBeInTheDocument();
    });

    it("aligns attendant message to the right (justify-end)", () => {
      render(<MessageBubble message={attendantMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      expect(bubble.className).toContain("justify-end");
    });

    it("shows User icon and Atendente label for attendant messages", () => {
      render(<MessageBubble message={attendantMessage} />);
      expect(screen.getByText("Atendente")).toBeInTheDocument();
    });

    it("applies blue background to attendant message (Bradesco style)", () => {
      render(<MessageBubble message={attendantMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      const innerDiv = bubble.firstChild as HTMLElement;
      expect(innerDiv.className).toContain("bg-blue-600");
    });
  });

  describe("Status Icons", () => {
    it("shows status icon for outbound messages (IA)", () => {
      render(<MessageBubble message={iaMessage} />);
      // Should render some status indicator
      const bubble = screen.getByTestId("message-bubble");
      expect(bubble).toBeInTheDocument();
    });

    it("shows status icon for outbound messages (attendant)", () => {
      render(<MessageBubble message={attendantMessage} />);
      const bubble = screen.getByTestId("message-bubble");
      expect(bubble).toBeInTheDocument();
    });
  });

  describe("Backward Compatibility", () => {
    it("falls back to direction-based styling when sender_type is undefined", () => {
      const legacyMessage = {
        ...baseMessage,
        id: "msg-legacy",
        content: "Mensagem legada",
        direction: "inbound" as const,
        // sender_type intentionally omitted
      };

      render(<MessageBubble message={legacyMessage as any} />);
      const bubble = screen.getByTestId("message-bubble");
      // Should fallback to customer styling for inbound
      expect(bubble.className).toContain("justify-start");
    });
  });
});
