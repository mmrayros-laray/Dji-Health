// Date and schedule calculations shared by the app (calendar, timeline) and the AI assistant.
// Dates are ISO 'YYYY-MM-DD' strings handled in UTC to avoid timezone drift.
import type { Immunization, ScheduleEntry } from "./types.ts";

const DAY = 86_400_000;

export function toDay(iso: string): number {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY;
}
export function fromDay(day: number): string {
  return new Date(day * DAY).toISOString().slice(0, 10);
}
export function todayIso(now: Date = new Date()): string {
  return now.toISOString().slice(0, 10);
}
export function addDays(iso: string, days: number): string {
  return fromDay(toDay(iso) + days);
}
export function daysBetween(fromIso: string, toIso: string): number {
  return toDay(toIso) - toDay(fromIso);
}

export function ageYears(birthIso: string, today: string): number {
  const [by, bm, bd] = birthIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  let age = ty - by;
  if (tm < bm || (tm === bm && td < bd)) age -= 1;
  return Math.max(0, age);
}
export function ageMonths(birthIso: string, today: string): number {
  const [by, bm, bd] = birthIso.slice(0, 10).split("-").map(Number);
  const [ty, tm, td] = today.slice(0, 10).split("-").map(Number);
  let months = (ty - by) * 12 + (tm - bm);
  if (td < bd) months -= 1;
  return Math.max(0, months);
}

export interface GestationalAge {
  weeks: number;
  days: number;
  trimester: 1 | 2 | 3;
  daysToDue: number;
}
export function gestationalAge(lmpIso: string, eddIso: string, today: string): GestationalAge {
  const total = Math.max(0, daysBetween(lmpIso, today));
  const weeks = Math.floor(total / 7);
  return {
    weeks,
    days: total % 7,
    trimester: weeks < 14 ? 1 : weeks < 28 ? 2 : 3,
    daysToDue: daysBetween(today, eddIso),
  };
}

export type VaccineStatus = "done" | "overdue" | "due" | "upcoming";
export interface VaccineRow {
  schedule: ScheduleEntry;
  dueDate: string;
  status: VaccineStatus;
  givenDate?: string;
  daysUntilDue: number; // negative = in the past
}

/** Calendar driven entirely by the vaccination_schedule table (placeholder values) — never hard-coded. */
export function vaccinationCalendar(
  birthIso: string,
  schedule: ScheduleEntry[],
  immunizations: Immunization[],
  today: string,
  overdueGraceDays = 28,
): VaccineRow[] {
  return schedule
    .filter((s) => s.target === "child")
    .map((s) => {
      const dueDate = addDays(birthIso, s.due_age_weeks * 7);
      const given = immunizations.find(
        (i) => i.vaccine_code === s.vaccine_code && (i.dose_number ?? 1) === s.dose_number,
      );
      const daysUntilDue = daysBetween(today, dueDate);
      let status: VaccineStatus;
      if (given) status = "done";
      else if (daysUntilDue < -overdueGraceDays) status = "overdue";
      else if (daysUntilDue <= 0) status = "due";
      else status = "upcoming";
      return { schedule: s, dueDate, status, givenDate: given?.date_given, daysUntilDue };
    })
    .sort((a, b) => a.schedule.due_age_weeks - b.schedule.due_age_weeks || a.schedule.vaccine_code.localeCompare(b.schedule.vaccine_code));
}

/** The next dose(s) to plan: everything due/overdue, else the earliest upcoming group. */
export function nextVaccines(rows: VaccineRow[]): VaccineRow[] {
  const pending = rows.filter((r) => r.status === "due" || r.status === "overdue");
  if (pending.length) return pending;
  const upcoming = rows.filter((r) => r.status === "upcoming");
  if (!upcoming.length) return [];
  const first = Math.min(...upcoming.map((r) => r.daysUntilDue));
  return upcoming.filter((r) => r.daysUntilDue === first);
}
