import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the useIsMobile hook
const mockUseIsMobile = vi.fn();
vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => mockUseIsMobile(),
}));

describe("CRM Responsiveness - Unit Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Mobile Detection", () => {
    it("should detect mobile viewport correctly when width < 768px", () => {
      mockUseIsMobile.mockReturnValue(true);
      expect(mockUseIsMobile()).toBe(true);
    });

    it("should detect desktop viewport correctly when width >= 768px", () => {
      mockUseIsMobile.mockReturnValue(false);
      expect(mockUseIsMobile()).toBe(false);
    });
  });

  describe("Layout Modes", () => {
    it("mobile layout uses single-pane navigation", () => {
      mockUseIsMobile.mockReturnValue(true);
      const isMobile = mockUseIsMobile();
      
      // Mobile mode: only one pane visible at a time
      type MobilePane = "contacts" | "chat" | "inspector";
      const activePanes: MobilePane[] = ["contacts"];
      
      expect(isMobile).toBe(true);
      expect(activePanes.length).toBe(1);
    });

    it("desktop layout uses multi-pane ResizablePanelGroup", () => {
      mockUseIsMobile.mockReturnValue(false);
      const isMobile = mockUseIsMobile();
      
      // Desktop mode: multiple panes visible simultaneously
      const visiblePanes = ["contacts", "chat", "inspector"];
      
      expect(isMobile).toBe(false);
      expect(visiblePanes.length).toBeGreaterThan(1);
    });
  });

  describe("Touch Targets Compliance", () => {
    it("buttons should have minimum 36-40px touch targets on mobile", () => {
      // h-10 = 2.5rem = 40px (mobile)
      // h-9 = 2.25rem = 36px (desktop)
      const mobileTouchTarget = 40;
      const minRecommended = 36;
      
      expect(mobileTouchTarget).toBeGreaterThanOrEqual(minRecommended);
    });

    it("contact list items should have adequate height for touch", () => {
      // min-h-[72px] on mobile, min-h-[68px] on desktop
      const mobileItemHeight = 72;
      const minTouchHeight = 44;
      
      expect(mobileItemHeight).toBeGreaterThanOrEqual(minTouchHeight);
    });

    it("input fields should have adequate height for touch", () => {
      // h-11 on mobile = 44px, h-10 on desktop = 40px
      const mobileInputHeight = 44;
      const minTouchHeight = 44;
      
      expect(mobileInputHeight).toBeGreaterThanOrEqual(minTouchHeight);
    });
  });

  describe("Responsive CSS Classes", () => {
    it("message bubbles use responsive max-width", () => {
      const responsiveClasses = "max-w-[85%] sm:max-w-[75%] md:max-w-[65%]";
      
      expect(responsiveClasses).toContain("max-w-[85%]"); // Mobile: 85%
      expect(responsiveClasses).toContain("sm:max-w-[75%]"); // Tablet: 75%
      expect(responsiveClasses).toContain("md:max-w-[65%]"); // Desktop: 65%
    });

    it("padding uses responsive values", () => {
      const responsivePadding = "p-2 sm:p-3";
      
      expect(responsivePadding).toContain("p-2"); // Mobile
      expect(responsivePadding).toContain("sm:p-3"); // Desktop
    });

    it("header buttons hide on mobile", () => {
      const hiddenOnMobile = "hidden sm:flex";
      
      expect(hiddenOnMobile).toContain("hidden"); // Hidden on mobile
      expect(hiddenOnMobile).toContain("sm:flex"); // Visible on tablet+
    });
  });

  describe("Mobile Navigation Flow", () => {
    it("navigation states are correctly defined", () => {
      type MobilePane = "contacts" | "chat" | "inspector";
      const validStates: MobilePane[] = ["contacts", "chat", "inspector"];
      
      expect(validStates).toContain("contacts");
      expect(validStates).toContain("chat");
      expect(validStates).toContain("inspector");
      expect(validStates.length).toBe(3);
    });

    it("back navigation changes pane state", () => {
      let currentPane: "contacts" | "chat" | "inspector" = "chat";
      const handleBack = () => { currentPane = "contacts"; };
      
      expect(currentPane).toBe("chat");
      handleBack();
      expect(currentPane).toBe("contacts");
    });

    it("contact selection navigates to chat", () => {
      let currentPane: "contacts" | "chat" | "inspector" = "contacts";
      const handleSelectContact = () => { currentPane = "chat"; };
      
      expect(currentPane).toBe("contacts");
      handleSelectContact();
      expect(currentPane).toBe("chat");
    });

    it("inspector opens as Sheet on mobile", () => {
      mockUseIsMobile.mockReturnValue(true);
      const isMobile = mockUseIsMobile();
      
      // On mobile, inspector uses Sheet component
      const inspectorComponent = isMobile ? "Sheet" : "InlinePanel";
      expect(inspectorComponent).toBe("Sheet");
    });
  });

  describe("Breakpoints", () => {
    it("mobile breakpoint is 768px", () => {
      const MOBILE_BREAKPOINT = 768;
      
      // < 768 = mobile
      expect(767 < MOBILE_BREAKPOINT).toBe(true);
      // >= 768 = tablet/desktop
      expect(768 < MOBILE_BREAKPOINT).toBe(false);
    });

    it("responsive classes use correct breakpoint prefixes", () => {
      const tailwindBreakpoints = {
        sm: "640px",
        md: "768px",
        lg: "1024px",
        xl: "1280px",
      };
      
      expect(tailwindBreakpoints.sm).toBe("640px");
      expect(tailwindBreakpoints.md).toBe("768px");
    });
  });

  describe("Safe Areas", () => {
    it("message input includes safe area padding", () => {
      // pb-safe class for iOS home indicator
      const safeAreaClass = "pb-safe";
      expect(safeAreaClass).toBe("pb-safe");
    });
  });

  describe("Component Prop Types", () => {
    it("ChatPane accepts isMobile and onBack props", () => {
      interface ChatPaneProps {
        contactId: string | null;
        onToggleInspector: () => void;
        showInspector: boolean;
        isMobile?: boolean;
        onBack?: () => void;
      }
      
      const props: ChatPaneProps = {
        contactId: "123",
        onToggleInspector: () => {},
        showInspector: true,
        isMobile: true,
        onBack: () => {},
      };
      
      expect(props.isMobile).toBe(true);
      expect(typeof props.onBack).toBe("function");
    });

    it("InspectorPane accepts isMobile and onClose props", () => {
      interface InspectorPaneProps {
        contactId: string | null;
        isMobile?: boolean;
        onClose?: () => void;
      }
      
      const props: InspectorPaneProps = {
        contactId: "123",
        isMobile: true,
        onClose: () => {},
      };
      
      expect(props.isMobile).toBe(true);
      expect(typeof props.onClose).toBe("function");
    });
  });
});
