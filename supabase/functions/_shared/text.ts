// Text normalisation shared by the AI validator, the scrubber and the app.
// Pure TypeScript: runs in Deno (Edge Functions), Node (tests) and React Native.

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

/** Lowercase, strip diacritics (Latin accents and Arabic harakat), unify Arabic letter variants,
 *  convert Arabic-Indic digits, and turn hyphens/punctuation runs into single spaces. */
export function normalize(input: string): string {
  let s = input.normalize("NFKD").replace(/\p{M}+/gu, "");
  s = s.replace(/[٠-٩]/g, (d) => String(ARABIC_INDIC.indexOf(d)));
  s = s.replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)));
  s = s
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ـ/g, ""); // tatweel
  s = s.toLowerCase();
  s = s.replace(/[’'`´]/g, "'");
  s = s.replace(/[\-‐‑–—_+/(),.;:!?«»"“”\[\]{}]+/g, " ");
  return s.replace(/\s+/g, " ").trim();
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface Span {
  start: number;
  end: number;
}

/** Find every occurrence of `needle` (already normalised) in `haystack` (already normalised).
 *  Short needles (<= 4 chars) must sit on word boundaries; longer ones match as substrings so that
 *  Arabic/Somali affixes ("بالسكري", "sonkorowga") are still detected — erring towards detection. */
export function findAll(haystack: string, needle: string): Span[] {
  if (!needle) return [];
  const body = escapeRegExp(needle);
  const pattern = needle.length <= 4 ? `(?<![\\p{L}\\p{N}])${body}(?![\\p{L}\\p{N}])` : body;
  const re = new RegExp(pattern, "gu");
  const out: Span[] = [];
  for (const m of haystack.matchAll(re)) {
    out.push({ start: m.index ?? 0, end: (m.index ?? 0) + m[0].length });
  }
  return out;
}

export function countWords(s: string): number {
  return s.trim().split(/\s+/u).filter(Boolean).length;
}

/** All numbers in a (normalised) text, as numbers. "1,5" and "1.5" both read as 1.5. */
export function extractNumbers(s: string): number[] {
  const out: number[] = [];
  for (const m of s.matchAll(/\d+(?:[.,]\d+)?/g)) {
    out.push(Number(m[0].replace(",", ".")));
  }
  return out;
}
