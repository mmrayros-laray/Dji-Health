// Glossary helpers: find medical entities (in any demo language) inside a text.
import { findAll, normalize, type Span } from "./text.ts";

export type Lang = "fr" | "so" | "ar" | "en";
export const LANGS: Lang[] = ["fr", "so", "ar", "en"];

export interface GlossaryTerm {
  id: string;
  category: "condition" | "allergy" | "medication" | "vaccine";
  codes?: string[];
  guard?: boolean;
  fr: string;
  so: string;
  ar: string;
  en: string;
  aliases?: Partial<Record<Lang, string[]>>;
  _review?: string;
}

export interface Glossary {
  terms: GlossaryTerm[];
}

/** Every surface form of a term, normalised, longest first. */
export function termForms(t: GlossaryTerm): string[] {
  const forms = new Set<string>();
  for (const l of LANGS) {
    forms.add(normalize(t[l]));
    for (const a of t.aliases?.[l] ?? []) forms.add(normalize(a));
  }
  forms.delete("");
  return [...forms].sort((a, b) => b.length - a.length);
}

export interface TermHit {
  term: GlossaryTerm;
  span: Span;
}

/** Longest-match-first scan: once a span is claimed by a longer form (e.g. "فقر الدم المنجلي",
 *  sickle cell), shorter overlapping forms ("فقر الدم", anaemia) are ignored. */
export function findTerms(text: string, glossary: Glossary): TermHit[] {
  const norm = normalize(text);
  const candidates: { term: GlossaryTerm; form: string; span: Span }[] = [];
  for (const term of glossary.terms) {
    for (const form of termForms(term)) {
      for (const span of findAll(norm, form)) candidates.push({ term, form, span });
    }
  }
  candidates.sort((a, b) => b.form.length - a.form.length);
  const claimed: Span[] = [];
  const hits: TermHit[] = [];
  for (const c of candidates) {
    if (claimed.some((s) => c.span.start < s.end && s.start < c.span.end)) continue;
    claimed.push(c.span);
    hits.push({ term: c.term, span: c.span });
  }
  return hits;
}

/** Does a record item (its display text and optional code) correspond to this glossary term? */
export function itemMatchesTerm(itemText: string, itemCode: string | undefined, term: GlossaryTerm): boolean {
  if (itemCode && term.codes?.some((c) => c.toUpperCase() === itemCode.toUpperCase())) return true;
  const item = normalize(itemText);
  if (!item) return false;
  return termForms(term).some((f) => findAll(item, f).length > 0 || (f.length > 4 && findAll(f, item).length > 0));
}

/** Best glossary term for a record item (used by the UI to translate French record text). */
export function termForItem(itemText: string, itemCode: string | undefined, glossary: Glossary): GlossaryTerm | undefined {
  if (itemCode) {
    const byCode = glossary.terms.find((t) => t.codes?.some((c) => c.toUpperCase() === itemCode.toUpperCase()));
    if (byCode) return byCode;
  }
  const n = normalize(itemText);
  const exact = glossary.terms.find((t) => termForms(t).includes(n));
  if (exact) return exact;
  // fall back to the longest term found inside the text
  const hits = findTerms(itemText, glossary);
  if (hits.length === 1) return hits[0].term;
  return undefined;
}

export function translateItem(itemText: string, itemCode: string | undefined, lang: Lang, glossary: Glossary): string {
  if (lang === "fr") return itemText;
  const t = termForItem(itemText, itemCode, glossary);
  return t ? t[lang] : itemText;
}
