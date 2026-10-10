// AI output validator (CLAUDE.md §7). "The prompt is a request. The validator is the guarantee."
// A draft is shown to the patient ONLY if every check passes; otherwise the caller stores the draft in
// ai_validator_rejections and returns a neutral fallback.
import { DOSE_UNIT_RE, FORBIDDEN_PATTERNS } from "./forbidden_patterns.ts";
import { findTerms, itemMatchesTerm, type Glossary } from "./glossary.ts";
import { countWords, extractNumbers, findAll, normalize } from "./text.ts";
import type { SummaryInput } from "./deidentify.ts";

export interface ValidationItem {
  ref: string;
  text: string; // display / name / substance
  code?: string;
}

export interface ValidationContext {
  items: ValidationItem[];
  /** Every number present anywhere in the model input (ages, weeks, dates, doses). */
  allowedNumbers: Set<number>;
  /** Numbers that appear in medication dosage texts. */
  doseNumbers: Set<number>;
}

export type ValidationResult =
  | { ok: true; text: string; source_refs: string[] }
  | { ok: false; reason: string };

export interface ValidateOptions {
  textField: "summary" | "answer";
  requireRefs: boolean;
  maxWords: number;
}

export function itemsFromSummaryInput(input: SummaryInput): ValidationItem[] {
  return [
    ...input.conditions.map((c) => ({ ref: c.ref, text: c.display, code: c.code })),
    ...input.allergies.map((a) => ({ ref: a.ref, text: a.substance })),
    ...input.medications.map((m) => ({ ref: m.ref, text: m.name })),
    ...input.immunizations.map((i) => ({ ref: i.ref, text: i.name, code: i.code })),
    ...(input.pregnancy ? [{ ref: input.pregnancy.ref, text: "" }] : []),
  ];
}

/** Digits normalised (Arabic-Indic → Latin), accents stripped, punctuation kept (for decimals and units). */
function numericView(s: string): string {
  return s
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .toLowerCase();
}

export function buildContext(items: ValidationItem[], modelInput: unknown, dosageTexts: string[]): ValidationContext {
  const json = numericView(JSON.stringify(modelInput));
  return {
    items,
    allowedNumbers: new Set(extractNumbers(json)),
    doseNumbers: new Set(dosageTexts.flatMap((d) => extractNumbers(numericView(d)))),
  };
}

function parseDraft(raw: string): unknown {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "");
  return JSON.parse(trimmed);
}

export function validateDraft(raw: string, ctx: ValidationContext, glossary: Glossary, opts: ValidateOptions): ValidationResult {
  // 1. JSON shape
  let parsed: unknown;
  try {
    parsed = parseDraft(raw);
  } catch {
    return { ok: false, reason: "invalid_json" };
  }
  if (!parsed || typeof parsed !== "object") return { ok: false, reason: "invalid_json" };
  const obj = parsed as Record<string, unknown>;
  const text = obj[opts.textField];
  const refs = obj.source_refs;
  if (typeof text !== "string" || !text.trim()) return { ok: false, reason: `missing_${opts.textField}` };
  if (!Array.isArray(refs) || refs.some((r) => typeof r !== "string")) return { ok: false, reason: "invalid_source_refs" };
  const sourceRefs = [...new Set(refs as string[])];
  if (opts.requireRefs && sourceRefs.length === 0) return { ok: false, reason: "empty_source_refs" };
  if (countWords(text) > opts.maxWords) return { ok: false, reason: "too_long" };

  // 2. every source_ref exists in the input
  const known = new Map(ctx.items.map((i) => [i.ref, i]));
  const unknown = sourceRefs.filter((r) => !known.has(r));
  if (unknown.length) return { ok: false, reason: `unknown_ref:${unknown.join(",")}` };

  // 3a. any medical entity (any language) mentioned must exist in the input AND be cited
  for (const hit of findTerms(text, glossary)) {
    const matching = ctx.items.filter((i) => i.text && itemMatchesTerm(i.text, i.code, hit.term));
    if (!matching.length) return { ok: false, reason: `entity_not_in_record:${hit.term.id}` };
    if (!matching.some((i) => sourceRefs.includes(i.ref))) return { ok: false, reason: `uncited_entity:${hit.term.id}` };
  }
  // 3b. literal mention of an input item's own text must be cited
  const normText = normalize(text);
  for (const item of ctx.items) {
    const n = normalize(item.text);
    if (n.length >= 4 && findAll(normText, n).length && !sourceRefs.includes(item.ref)) {
      // fine if another item with the same text is cited (e.g. several doses of one vaccine)
      const twins = ctx.items.filter((o) => normalize(o.text) === n);
      if (!twins.some((t) => sourceRefs.includes(t.ref))) return { ok: false, reason: `uncited_item:${item.ref}` };
    }
  }

  // 4. advice / diagnosis / risk / urgency patterns
  for (const fp of FORBIDDEN_PATTERNS) {
    if (fp.re.test(normText)) return { ok: false, reason: `forbidden_${fp.kind}:${fp.lang}:${fp.re.source}` };
  }

  // 4b. dosage numbers must come from the input; other numbers must exist in the input (small counts allowed)
  const numView = numericView(text);
  for (const m of numView.matchAll(new RegExp(DOSE_UNIT_RE.source, "gu"))) {
    const n = Number(m[1].replace(",", "."));
    if (!ctx.doseNumbers.has(n)) return { ok: false, reason: `dose_not_in_record:${m[0]}` };
  }
  for (const n of extractNumbers(numView)) {
    if (n <= 10 && Number.isInteger(n)) continue;
    if (!ctx.allowedNumbers.has(n)) return { ok: false, reason: `number_not_in_record:${n}` };
  }

  return { ok: true, text: text.trim(), source_refs: sourceRefs };
}
