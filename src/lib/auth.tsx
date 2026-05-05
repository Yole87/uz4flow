import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, metadata?: { full_name?: string; phone?: string }) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPasswordForEmail: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        // Always update session
        setSession(session);
        // For USER_UPDATED (e.g. after password change), keep the same user reference
        // if the ID didn't change — this prevents needless cascade refetches in queries
        // keyed by user.id (e.g. organization-status, plan).
        setUser((prev) => {
          const next = session?.user ?? null;
          if (event === "USER_UPDATED" && prev && next && prev.id === next.id) {
            return prev; // keep same reference
          }
          return next;
        });
        setLoading(false);
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, metadata?: { full_name?: string; phone?: string }) => {
    // After email confirmation, redirect to a route that knows how to read
    // pending checkout intent (saved before signup) and forward to /checkout.
    const redirectUrl = `${window.location.origin}/?tab=login`;

    // Inject affiliate ref code if present (30-day window)
    let refCode: string | undefined;
    try {
      const ts = Number(localStorage.getItem("of_ref_ts") || 0);
      if (ts && Date.now() - ts < 30 * 24 * 60 * 60 * 1000) {
        refCode = localStorage.getItem("of_ref") || undefined;
      }
    } catch { /* ignore */ }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: { ...(metadata || {}), ...(refCode ? { ref_code: refCode } : {}) },
      }
    });

    return { error };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    
    return { error };
  };

  const signOut = async () => {
    setSession(null);
    setUser(null);
    
    try {
      await supabase.auth.signOut({ scope: 'local' });
    } catch (error) {
      // Ignore errors - cleanup below
    }
    
    // Clear all Supabase auth tokens from localStorage dynamically
    Object.keys(localStorage).forEach(key => {
      if (key.startsWith('sb-') && key.endsWith('-auth-token')) {
        localStorage.removeItem(key);
      }
    });
    
    window.location.href = '/';
  };

  const resetPasswordForEmail = async (email: string) => {
    const redirectUrl = `${window.location.origin}/reset-password`;
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    });
    
    return { error };
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    
    return { error };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, signUp, signIn, signOut, resetPasswordForEmail, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    // During HMR / hot-reload the provider may momentarily be absent.
    // Return a safe loading state instead of crashing the whole app.
    return {
      user: null,
      session: null,
      loading: true,
      signUp: async () => ({ error: new Error("AuthProvider not ready") }),
      signIn: async () => ({ error: new Error("AuthProvider not ready") }),
      signOut: async () => {},
      resetPasswordForEmail: async () => ({ error: new Error("AuthProvider not ready") }),
      updatePassword: async () => ({ error: new Error("AuthProvider not ready") }),
    } as AuthContextType;
  }
  return context;
}