// Deno-only helpers for the Edge Functions.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.117.3";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

function env(name: string): string {
  const v = Deno.env.get(name);
  if (!v) throw new Error(`missing env ${name}`);
  return v;
}

/** Projects with the new API keys expose SUPABASE_PUBLISHABLE_KEYS / SUPABASE_SECRET_KEYS (JSON maps);
 *  older projects expose SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY. Accept either. */
function key(legacy: string, modern: string): string {
  const old = Deno.env.get(legacy);
  if (old) return old;
  const raw = Deno.env.get(modern);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      const first = typeof parsed === "string" ? parsed : Object.values(parsed as Record<string, string>)[0];
      if (first) return first;
    } catch {
      return raw;
    }
  }
  throw new Error(`missing env ${legacy} or ${modern}`);
}

/** Client acting AS the signed-in user: RLS and the audit-logging RPCs apply exactly as in the app. */
export function userClient(req: Request): SupabaseClient {
  return createClient(env("SUPABASE_URL"), key("SUPABASE_ANON_KEY", "SUPABASE_PUBLISHABLE_KEYS"), {
    global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Service-role client: only for writes the user may not do (AI cache, rejections, audit entries). */
export function serviceClient(): SupabaseClient {
  return createClient(env("SUPABASE_URL"), key("SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_SECRET_KEYS"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export const LANGS = ["fr", "so", "ar", "en"] as const;
export type Lang = (typeof LANGS)[number];
export function asLang(v: unknown): Lang {
  return (LANGS as readonly string[]).includes(String(v)) ? (v as Lang) : "fr";
}

export function devLog(label: string, payload: unknown) {
  // Set DJH_LOG_AI_PAYLOAD=1 (local only) to print exactly what is sent to Claude — M6 acceptance check.
  if (Deno.env.get("DJH_LOG_AI_PAYLOAD") === "1") console.log(`[${label}]`, JSON.stringify(payload));
}
