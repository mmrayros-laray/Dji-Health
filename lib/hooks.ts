import { useTranslation } from "react-i18next";
import glossary from "../locales/glossary.json";
import { translateItem, type Glossary, type Lang } from "../supabase/functions/_shared/glossary.ts";

const G = glossary as unknown as Glossary;

/** Translates French record text (conditions, medications, vaccines…) through the shared medical glossary. */
export function useTerm() {
  const { i18n } = useTranslation();
  const lang = (i18n.language as Lang) ?? "fr";
  return (text: string, code?: string | null) => translateItem(text, code ?? undefined, lang, G);
}

/** True when we are showing cached data because the network request failed (read-only offline mode). */
export function isOffline(q: { isPaused?: boolean; isError: boolean; failureCount?: number; data?: unknown }): boolean {
  return Boolean(q.data) && (Boolean(q.isPaused) || q.isError || (q.failureCount ?? 0) > 0);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
