import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { LineChart, Progress } from "../../../components/charts";
import { Screen } from "../../../components/Screen";
import { Badge, Body, Button, Card, H2, Icon, Notice, Row, Skeleton, Small } from "../../../components/ui";
import { useProgramParameters, useRecord, useSchedule, type PatientRecord } from "../../../lib/api";
import { formatDate, formatNumber } from "../../../lib/format";
import { isOffline, todayIso } from "../../../lib/hooks";
import { colors, space } from "../../../lib/theme";
import { ageMonths, daysBetween, gestationalAge } from "../../../supabase/functions/_shared/clinical.ts";
import { ChildVaccineReminder } from "../../../components/ChildVaccineReminder";

export default function Maternal() {
  const { t } = useTranslation();
  const q = useRecord();
  const r = q.data;
  const preg = r?.pregnancies.find((p) => p.status === "active");
  return (
    <Screen title={t("maternal.title")} offline={isOffline(q)} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      {!r ? <Card><Skeleton lines={5} /></Card> : (
        <>
          {preg ? <PregnancyCard record={r} /> : null}
          {r.children.length ? <ChildrenList record={r} /> : null}
          {!preg && !r.children.length ? <Card><Body muted>{t("maternal.empty")}</Body></Card> : null}
        </>
      )}
    </Screen>
  );
}

function PregnancyCard({ record }: { record: PatientRecord }) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const params = useProgramParameters();
  const preg = record.pregnancies.find((p) => p.status === "active")!;
  const today = todayIso();
  const ga = gestationalAge(preg.lmp_date, preg.edd_date, today);
  const done = preg.antenatal_visits.filter((v) => v.status === "done");
  const next = preg.antenatal_visits.find((v) => v.status === "planned" && v.date >= today);
  const rec = params.data?.anc_recommended_visits;
  const weights = done.filter((v) => v.weight_kg != null);

  return (
    <>
      <Card accent={colors.gold}>
        <Row><Icon name="human-pregnant" size={30} /><H2 style={{ flex: 1 }}>{t("maternal.pregnancy")}</H2></Row>
        <Body style={{ fontSize: 28, fontWeight: "800", color: colors.navy }}>{t("maternal.ga", { weeks: ga.weeks, days: ga.days })}</Body>
        <Row>
          <Badge tone="gold" label={t("maternal.trimester", { n: ga.trimester })} />
          <Badge tone={preg.risk_level === "high" ? "error" : "success"} icon={preg.risk_level === "high" ? "alert" : "check"} label={t(`maternal.risk.${preg.risk_level}`)} />
        </Row>
        <Body>{t("maternal.edd", { date: formatDate(preg.edd_date, lang) })}</Body>
      </Card>

      {next ? (
        <Notice tone="info" icon="calendar-clock" title={t("maternal.next_visit")}>
          {t("maternal.next_visit_in", { count: daysBetween(today, next.date), date: formatDate(next.date, lang) })}
        </Notice>
      ) : null}

      <Card>
        <H2>{t("maternal.visits")}</H2>
        {rec ? (
          <>
            <Progress value={done.length} max={rec.value} label={t("maternal.visits_progress", { done: done.length, total: rec.value })} />
            <Row><Badge tone="warning" icon="alert-decagram-outline" label={rec.validation_status} /><Small muted>{rec.source_note}</Small></Row>
          </>
        ) : null}
        <View style={{ gap: space.sm }}>
          {preg.antenatal_visits.map((v) => (
            <Button key={v.id} variant={v.status === "done" ? "secondary" : "ghost"} icon={v.status === "done" ? "check-circle" : "calendar-blank-outline"}
              label={`${t("maternal.visit_n", { n: v.visit_number })} · ${formatDate(v.date, lang)} · ${t("maternal.week_n", { n: v.gestational_weeks })} — ${t(`maternal.visit_status.${v.status}`)}`}
              onPress={() => router.push(`/maternal/visit/${v.id}`)} style={{ justifyContent: "flex-start" }} />
          ))}
        </View>
      </Card>

      {weights.length ? (
        <Card>
          <H2>{t("maternal.weight_chart")}</H2>
          <LineChart accessibilityLabel={t("maternal.weight_chart")} yUnit="kg" xLabel={t("maternal.weeks_axis")}
            points={weights.map((v) => ({ x: v.gestational_weeks ?? 0, y: Number(v.weight_kg), label: t("maternal.week_n", { n: v.gestational_weeks }), valueLabel: `${formatNumber(Number(v.weight_kg), lang, 1)} kg` }))} />
        </Card>
      ) : null}
    </>
  );
}

function ChildrenList({ record }: { record: PatientRecord }) {
  const { t } = useTranslation();
  const schedule = useSchedule();
  return (
    <Card>
      <Row><Icon name="human-female-boy" size={30} /><H2 style={{ flex: 1 }}>{t("children.title")}</H2></Row>
      {record.children.map((c) => (
        <View key={c.id} style={{ gap: space.sm, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border }}>
          <Body bold>{c.given_name} · {t("children.age_months", { count: ageMonths(c.birth_date, todayIso()) })}</Body>
          {schedule.data ? <ChildVaccineReminder childId={c.id} schedule={schedule.data} /> : null}
          <Button variant="secondary" icon="needle" label={t("children.open")} onPress={() => router.push(`/children/${c.id}`)} />
        </View>
      ))}
    </Card>
  );
}
