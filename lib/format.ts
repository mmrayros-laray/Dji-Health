import { localeFor } from "./i18n";

export function formatDate(iso: string | null | undefined, lang: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", year: "numeric" }): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00Z` : iso);
  try {
    return new Intl.DateTimeFormat(localeFor(lang), { timeZone: "UTC", ...opts }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

export function formatDateTime(iso: string, lang: string): string {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(localeFor(lang), { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
  } catch {
    return iso.replace("T", " ").slice(0, 16);
  }
}

export function formatNumber(n: number, lang: string, digits = 0): string {
  try {
    return new Intl.NumberFormat(localeFor(lang), { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
  } catch {
    return n.toFixed(digits);
  }
}
