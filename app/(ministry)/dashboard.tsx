// Ministry dashboard (M7): aggregates only, small cells (< 5) suppressed server-side.
import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, View } from "react-native";
import { BarList, Progress, Stat } from "../../components/charts";
import { Screen } from "../../components/Screen";
import { SignOutButton } from "../../components/SignOutButton";
import { Badge, Button, Card, H2, Notice, Row, Skeleton, Small } from "../../components/ui";
import { useDashboard } from "../../lib/api";
import { formatDateTime, formatNumber } from "../../lib/format";
import { useTerm } from "../../lib/hooks";
import { space } from "../../lib/theme";

export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const term = useTerm();
  const [region, setRegion] = useState<string | null>(null);
  const q = useDashboard(region);
  const d = q.data;
  const n = (v: number | null | undefined) => (v == null ? "< 5" : formatNumber(v, lang));
  const activePreg = d?.pregnancies_by_trimester.reduce((s, x) => (x.count == null || s == null ? null : s + x.count), 0 as number | null);

  return (
    <Screen wide title={t("ministry.title")} subtitle={t("ministry.subtitle")} right={<SignOutButton />} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      <Notice tone="warning" icon="flask-outline" title={t("ministry.synthetic")}>{t("ministry.synthetic_body")}</Notice>

      <Card>
        <Small muted>{t("ministry.filter_region")}</Small>
        <Row>
          <Button variant={region === null ? "primary" : "secondary"} label={t("ministry.all_regions")} onPress={() => setRegion(null)} />
          {(d?.regions ?? []).map((r) => <Button key={r} variant={region === r ? "primary" : "secondary"} label={r} onPress={() => setRegion(r)} />)}
        </Row>
      </Card>

      {q.isLoading ? <Card><Skeleton lines={8} /></Card> : null}
      {q.isError ? <Notice tone="error" icon="alert-circle-outline">{q.error.message}</Notice> : null}

      {d ? (
        <>
          <View style={st.stats}>
            <Stat label={t("ministry.kpi.enrolled")} value={n(d.total_enrolled)} note={region ?? t("ministry.all_regions")} />
            <Stat label={t("ministry.kpi.pregnancies")} value={n(activePreg)} />
            <Stat label={t("ministry.kpi.anc")} value={d.anc_completion.pct == null ? "< 5" : `${formatNumber(d.anc_completion.pct, lang, 1)} %`} note={t("ministry.anc_rule", { n: d.anc_completion.recommended_visits })} />
          </View>

          <View style={st.grid}>
            <ChartCard title={t("ministry.charts.enrolled")}>
              <BarList accessibilityLabel={t("ministry.charts.enrolled")}
                data={d.enrolled_by_region.map((r) => ({ key: r.region, label: r.region, value: r.count, valueLabel: n(r.count), suppressed: r.suppressed }))} />
            </ChartCard>

            <ChartCard title={t("ministry.charts.coverage")} note={t("ministry.coverage_note")}>
              <BarList accessibilityLabel={t("ministry.charts.coverage")} max={100}
                data={d.vaccination_coverage.map((v) => ({
                  key: `${v.vaccine_code}${v.dose_number}`, label: `${term(v.vaccine_name, v.vaccine_code)} ${v.dose_number}`,
                  sublabel: v.suppressed ? undefined : `${n(v.vaccinated)} / ${n(v.eligible)}`,
                  value: v.coverage_pct, valueLabel: v.coverage_pct == null ? "< 5" : `${formatNumber(v.coverage_pct, lang, 0)} %`, suppressed: v.suppressed,
                }))} />
            </ChartCard>

            <ChartCard title={t("ministry.charts.trimester")}>
              <BarList accessibilityLabel={t("ministry.charts.trimester")}
                data={d.pregnancies_by_trimester.map((p) => ({ key: String(p.trimester), label: t("maternal.trimester", { n: p.trimester }), value: p.count, valueLabel: n(p.count), suppressed: p.suppressed }))} />
            </ChartCard>

            <ChartCard title={t("ministry.charts.anc")}>
              {d.anc_completion.suppressed ? <Small>{t("ministry.suppressed_a11y")}</Small> : (
                <Progress value={d.anc_completion.complete ?? 0} max={d.anc_completion.eligible ?? 1}
                  label={t("ministry.anc_progress", { complete: n(d.anc_completion.complete), eligible: n(d.anc_completion.eligible), pct: formatNumber(d.anc_completion.pct ?? 0, lang, 1) })} />
              )}
              <Row><Badge tone="warning" icon="alert-decagram-outline" label={d.anc_completion.recommended_visits_status} /><Small muted>{t("ministry.anc_rule", { n: d.anc_completion.recommended_visits })}</Small></Row>
            </ChartCard>

            <ChartCard title={t("ministry.charts.conditions")}>
              <BarList accessibilityLabel={t("ministry.charts.conditions")}
                data={d.top_conditions.map((c) => ({ key: c.code, label: term(c.display, c.code), value: c.count, valueLabel: n(c.count), suppressed: c.suppressed }))} />
            </ChartCard>
          </View>
          <Small muted>{t("ministry.footer", { min: d.min_cell_size, date: formatDateTime(d.generated_at, lang) })}</Small>
        </>
      ) : null}
    </Screen>
  );
}

function ChartCard({ title, note, children }: { title: string; note?: string; children: ReactNode }) {
  const { t } = useTranslation();
  return (
    <Card style={st.chart}>
      <H2>{title}</H2>
      <Badge tone="gold" icon="flask-outline" label={t("ministry.chart_label")} />
      {note ? <Small muted>{note}</Small> : null}
      {children}
    </Card>
  );
}

const st = StyleSheet.create({
  stats: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.lg },
  chart: { flexBasis: 460, flexGrow: 1 },
});
