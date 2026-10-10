import { useTranslation } from "react-i18next";
import { useProgramParameters, useRecord, type ScheduleEntry } from "../lib/api";
import { todayIso, useTerm } from "../lib/hooks";
import { nextVaccines, vaccinationCalendar } from "../supabase/functions/_shared/clinical.ts";
import { Notice, Skeleton } from "./ui";

/** Gentle in-app reminder ("Prochain vaccin dans 2 semaines") — no push notifications in the demo. */
export function ChildVaccineReminder({ childId, schedule }: { childId: string; schedule: ScheduleEntry[] }) {
  const { t } = useTranslation();
  const term = useTerm();
  const q = useRecord(childId);
  const params = useProgramParameters();
  if (!q.data) return <Skeleton lines={1} />;
  const grace = params.data?.vaccine_overdue_grace_days?.value ?? 28;
  const rows = vaccinationCalendar(q.data.patient.birth_date, schedule, q.data.immunizations, todayIso(), grace);
  const overdue = rows.filter((r) => r.status === "overdue");
  const next = nextVaccines(rows);
  const names = [...new Set(next.map((r) => term(r.schedule.vaccine_name, r.schedule.vaccine_code)))].join(", ");
  if (overdue.length) {
    return <Notice tone="error" icon="alert-circle" title={t("children.overdue_title", { count: overdue.length })}>{t("children.overdue_body")}</Notice>;
  }
  if (!next.length) return <Notice tone="success" icon="check-circle">{t("children.all_done")}</Notice>;
  const days = next[0].daysUntilDue;
  return (
    <Notice tone="info" icon="bell-ring-outline" title={t("children.next_vaccine")}>
      {days <= 0 ? t("children.due_now", { names }) : days < 14 ? t("children.due_in_days", { count: days, names }) : t("children.due_in_weeks", { count: Math.round(days / 7), names })}
    </Notice>
  );
}
