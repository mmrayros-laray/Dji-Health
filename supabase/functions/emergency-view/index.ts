// emergency-view — public endpoint behind the emergency QR card (CLAUDE.md §5).
// The QR holds only <app>/emergency/<opaque token>. This function resolves the token through
// public.emergency_lookup(), which returns the minimal emergency data set and writes a flagged
// 'emergency_access' entry to audit_log. Revoked/expired tokens return a status, never data.
import { corsHeaders, json, serviceClient } from "../_shared/http.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let token: string | null = null;
  if (req.method === "GET") {
    token = new URL(req.url).searchParams.get("token");
  } else if (req.method === "POST") {
    try {
      token = (await req.json())?.token ?? null;
    } catch {
      token = null;
    }
  } else {
    return json({ status: "error" }, 405);
  }
  if (!token || !/^[A-Za-z0-9_-]{20,100}$/.test(token)) return json({ status: "not_found" }, 404);

  // Minimal, non-identifying context about the scan (no IP address is stored).
  const details = {
    user_agent: (req.headers.get("user-agent") ?? "").slice(0, 120),
    accept_language: (req.headers.get("accept-language") ?? "").slice(0, 20),
  };

  const { data, error } = await serviceClient().rpc("emergency_lookup", { p_token: token, p_details: details });
  if (error) {
    console.error("emergency_lookup failed", error.message);
    return json({ status: "error" }, 500);
  }
  const status = (data as { status: string }).status;
  return json(data, status === "ok" ? 200 : status === "not_found" ? 404 : 410);
});
