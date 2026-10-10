import { Redirect } from "expo-router";
import type { ReactNode } from "react";
import { View } from "react-native";
import { useAuth } from "../lib/auth";
import { homeFor, type Role } from "../lib/demoAccounts";
import { space } from "../lib/theme";
import { Skeleton } from "./ui";

/** UI-level routing only — the real enforcement is RLS in the database (CLAUDE.md §2.7). */
export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const auth = useAuth();
  if (!auth.ready || auth.roleLoading) {
    return <View style={{ padding: space.xl }}><Skeleton lines={4} /></View>;
  }
  if (!auth.session) return <Redirect href="/sign-in" />;
  if (auth.role !== role) return <Redirect href={homeFor(auth.role) as never} />;
  return <>{children}</>;
}
