import type { Session } from "@supabase/supabase-js";
import { useQuery } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEMO_PASSWORD } from "./config";
import type { Role } from "./demoAccounts";
import { persister, queryClient } from "./queryClient";
import { supabase } from "./supabase";

interface AuthState {
  session: Session | null;
  ready: boolean;
  role: Role | null;
  roleLoading: boolean;
  signInDemo: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;
  const roleQuery = useQuery({
    queryKey: ["role", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role").eq("user_id", userId!).maybeSingle();
      if (error) throw error;
      return (data?.role ?? null) as Role | null;
    },
  });

  const value = useMemo<AuthState>(() => ({
    session,
    ready,
    role: roleQuery.data ?? null,
    roleLoading: Boolean(userId) && roleQuery.isLoading,
    signInDemo: async (email: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
      if (error) throw error;
    },
    signOut: async () => {
      await supabase.auth.signOut();
      queryClient.clear();
      await persister.removeClient(); // no patient data stays on a shared demo device
    },
  }), [session, ready, roleQuery.data, roleQuery.isLoading, userId]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth outside AuthProvider");
  return ctx;
}
