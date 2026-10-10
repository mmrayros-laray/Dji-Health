// Claude API client — server-side only. ANTHROPIC_API_KEY lives in Supabase secrets (CLAUDE.md §2.5).
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";

export const MODEL = "claude-sonnet-5-5";

let client: Anthropic | null = null;
export function anthropic(): Anthropic {
  if (!client) {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set (supabase secrets set ANTHROPIC_API_KEY=...)");
    client = new Anthropic({ apiKey, maxRetries: 2, timeout: 30_000 });
  }
  return client;
}

/** First text block of a response, or null (refusal, truncation, no text). */
export function responseText(msg: Anthropic.Message): string | null {
  if (msg.stop_reason === "refusal" || msg.stop_reason === "max_tokens") return null;
  for (const block of msg.content) if (block.type === "text") return block.text;
  return null;
}

export { Anthropic };
