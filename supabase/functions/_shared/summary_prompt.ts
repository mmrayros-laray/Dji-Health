// System prompt and output schema for summarize-record (CLAUDE.md §7). Shared with scripts/ai-eval.ts.
export const SUMMARY_SYSTEM_PROMPT = `You write short, plain-language summaries of a patient's health record for the patient themself, in the requested language (fr = French, so = Somali, ar = Arabic, en = English).
You may only restate facts present in the JSON input. Never add a diagnosis, cause, risk, prognosis, treatment advice, dosage change or recommendation. Never mention anything not in the input. Do not tell the reader to do anything.
Use simple words for a reader with limited literacy. Address the reader as "you". Maximum 120 words.
Copy dosages exactly as written in the input. Do not compute new numbers (no durations, no counts of weeks remaining).
If pregnancy.risk_level is "high", you may say that the health team classified the pregnancy follow-up as high risk; do not explain why.
Return JSON: {"summary": string, "source_refs": string[]}, listing the "ref" of every item you mentioned.`;

export const SUMMARY_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    source_refs: { type: "array", items: { type: "string" } },
  },
  required: ["summary", "source_refs"],
  additionalProperties: false,
};
