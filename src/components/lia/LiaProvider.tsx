import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type LiaMessage = {
  role: "user" | "assistant";
  content: string;
};

export type GuidedCallbacks = {
  onComplete: () => void;
  onSkip: () => void;
} | null;

interface LiaContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  messages: LiaMessage[];
  setMessages: React.Dispatch<React.SetStateAction<LiaMessage[]>>;
  isStreaming: boolean;
  setIsStreaming: (streaming: boolean) => void;
  guidedSteps: GuidedStep[] | null;
  setGuidedSteps: (steps: GuidedStep[] | null) => void;
  currentGuidedIndex: number;
  setCurrentGuidedIndex: (index: number) => void;
  onGuidedComplete: GuidedCallbacks;
  setOnGuidedComplete: (cb: GuidedCallbacks) => void;
}

export interface GuidedStep {
  route: string;
  selector: string;
  title: string;
  description: string;
}

const LiaContext = createContext<LiaContextType | null>(null);

export function useLia() {
  const ctx = useContext(LiaContext);
  if (!ctx) throw new Error("useLia must be used within LiaProvider");
  return ctx;
}

const STORAGE_KEY = "lia-chat-messages";

function loadMessages(): LiaMessage[] {
  try {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function LiaProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<LiaMessage[]>(loadMessages);
  const [isStreaming, setIsStreaming] = useState(false);
  const [guidedSteps, setGuidedSteps] = useState<GuidedStep[] | null>(null);
  const [currentGuidedIndex, setCurrentGuidedIndex] = useState(0);
  const [guidedCallbacks, setGuidedCallbacks] = useState<GuidedCallbacks>(null);
  const onGuidedComplete = guidedCallbacks;

  // Persist messages to sessionStorage whenever they change
  const setMessagesWithPersist: typeof setMessages = useCallback((action) => {
    setMessages((prev) => {
      const next = typeof action === "function" ? action(prev) : action;
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  return (
    <LiaContext.Provider
      value={{
        isOpen,
        setIsOpen,
        messages,
        setMessages: setMessagesWithPersist,
        isStreaming,
        setIsStreaming,
        guidedSteps,
        setGuidedSteps,
        currentGuidedIndex,
        setCurrentGuidedIndex,
        onGuidedComplete,
        setOnGuidedComplete: setGuidedCallbacks,
      }}
    >
      {children}
    </LiaContext.Provider>
  );
}
