import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { LineChart } from "../../../components/charts";
import { ChildVaccineReminder } from "../../../components/ChildVaccineReminder";
import { Screen } from "../../../components/Screen";
import { Badge, Body, Button, Card, H2, Icon, Notice, Row, Skeleton, Small, type IconName } from "../../../components/ui";
import { useProgramParameters, useRecord, useSchedule } from "../../../lib/api";
import { formatDate, formatNumber } from "../../../lib/format";
import { isOffline, todayIso, useTerm } from "../../../lib/hooks";
import { colors, radius, space } from "../../../lib/theme";
import { ageMonths, daysBetween, vaccinationCalendar, type VaccineStatus } from "../../../supabase/functions/_shared/clinical.ts";

// Status is always shown as icon + text, never colour alone (BUILD_PLAN M4).
const STATUS: Record<VaccineStatus, { icon: IconName; color: string; bg: string }> = {
  done: { icon: "check-circle", color: colors.success, bg: colors.successSoft },
  overdue: { icon: "alert-circle", color: colors.error, bg: colors.errorSoft },
  due: { icon: "clock-alert-outline", color: colors.warning, bg: colors.warningSoft },
  upcoming: { icon: "calendar-blank-outline", color: colors.slate, bg: colors.surface },
};

export default function ChildScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const term = useTerm();
  const q = useRecord(id);
  const schedule = useSchedule();
  const params = useProgramParameters();
  const c = q.data;
  const today = todayIso();
  const grace = params.data?.vaccine_overdue_grace_days?.value ?? 28;
  const rows = c && schedule.data ? vaccinationCalendar(c.patient.birth_date, schedule.data, c.immunizations, today, grace) : [];
  const weights = c?.observations.filter((o) => o.type === "weight" && o.value != null) ?? [];

  return (
    <Screen title={c ? c.patient.given_name : t("children.title")} back="/maternal" offline={isOffline(q)} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      {!c || !schedule.data ? <Card><Skeleton lines={6} /></Card> : (
        <>
          <Card>
            <Body bold>{t("children.age_months", { count: ageMonths(c.patient.birth_date, today) })} · {t(`sex.${c.patient.sex}`)}</Body>
            <Small muted>{t("children.born", { date: formatDate(c.patient.birth_date, lang) })}</Small>
          </Card>

          <ChildVaccineReminder childId={c.patient.id} schedule={schedule.data} />

          <Card>
            <H2>{t("children.calendar")}</H2>
            <Notice tone="warning" icon="alert-decagram-outline" title={schedule.data[0]?.validation_status}>
              {t("children.schedule_source", { note: schedule.data[0]?.source_note })}
            </Notice>
            <View style={{ gap: space.sm }}>
              {rows.map((r) => {
                const s = STATUS[r.status];
                return (
                  <View key={r.schedule.id} style={[st.row, { backgroundColor: s.bg, borderColor: s.color }]}
                    accessible accessibilityLabel={`${term(r.schedule.vaccine_name, r.schedule.vaccine_code)}, ${t("vault.dose", { n: r.schedule.dose_number })}, ${t(`children.status.${r.status}`)}`}>
                    <Icon name={s.icon} color={s.color} size={26} />
                    <View style={{ flex: 1 }}>
                      <Text style={st.vName}>{term(r.schedule.vaccine_name, r.schedule.vaccine_code)} — {t("vault.dose", { n: r.schedule.dose_number })}</Text>
                      <Text style={st.vSub}>
                        {r.status === "done"
                          ? t("children.given_on", { date: formatDate(r.givenDate!, lang) })
                          : t("children.due_on", { date: formatDate(r.dueDate, lang), weeks: r.schedule.due_age_weeks })}
                      </Text>
                    </View>
                    <Text style={[st.status, { color: s.color }]}>{t(`children.status.${r.status}`)}</Text>
                  </View>
                );
              })}
            </View>
          </Card>

          <Card>
            <H2>{t("children.growth")}</H2>
            <LineChart accessibilityLabel={t("children.growth")} yUnit="kg" xLabel={t("children.months_axis")}
              points={weights.map((o) => {
                const m = Math.round(daysBetween(c.patient.birth_date, o.date) / 30.44 * 10) / 10;
                return { x: m, y: Number(o.value), label: t("children.at_months", { count: Math.round(m) }), valueLabel: `${formatNumber(Number(o.value), lang, 1)} kg` };
              })} />
            <Row><Badge tone="warning" icon="information-outline" label={t("children.no_reference")} /></Row>
          </Card>

          <Button variant="secondary" icon="history" label={t("access.title")} onPress={() => router.push(`/vault/access?patient=${c.patient.id}`)} />
        </>
      )}
    </Screen>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.md, borderRadius: radius.md, borderWidth: 1, borderStartWidth: 5 },
  vName: { fontSize: 16, fontWeight: "700", color: colors.text },
  vSub: { fontSize: 14, color: colors.slate },
  status: { fontSize: 14, fontWeight: "800", textTransform: "uppercase" },
});
