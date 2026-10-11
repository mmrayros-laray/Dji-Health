// Public configuration (EXPO_PUBLIC_* is bundled into the app — never put secrets here; CLAUDE.md §2.5).
import { Platform } from "react-native";

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
/** Offline preview: an in-browser engine replaces Supabase (lib/demo/engine.ts). Synthetic data only. */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE === "1";
export const isConfigured = DEMO_MODE || Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

/** Shared password of the seeded demo accounts (public by design: synthetic data only). */
export const DEMO_PASSWORD = process.env.EXPO_PUBLIC_DEMO_PASSWORD ?? "DjiHealth-demo-2026";

/** Base URL encoded in the emergency QR code. On web we default to the current origin. */
export function appUrl(): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (Platform.OS === "web" && typeof window !== "undefined") return window.location.origin;
  return "http://localhost:8081";
}

/** Content of the consent QR shown by the patient: a prefix + the short code (no medical data). */
export const CONSENT_QR_PREFIX = "DJH-CONSENT:";
