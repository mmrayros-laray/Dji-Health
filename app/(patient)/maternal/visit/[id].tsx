import { useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";
import { LineChart } from "../../../../components/charts";
import { Screen } from "../../../../components/Screen";
import { Badge, Body, Card, H2, Row, Skeleton, Small } from "../../../../components/ui";
import { useRecord } from "../../../../lib/api";
import { formatDate, formatNumber } from "../../../../lib/format";
import { isOffline } from "../../../../lib/hooks";

export default function VisitDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const q = useRecord();
  const preg = q.data?.pregnancies.find((p) => p.antenatal_visits.some((v) => v.id === id));
  const v = preg?.antenatal_visits.find((x) => x.id === id);
  const weights = preg?.antenatal_visits.filter((x) => x.status === "done" && x.weight_kg != null) ?? [];

  return (
    <Screen title={v ? t("maternal.visit_n", { n: v.visit_number }) : t("maternal.visits")} back="/maternal" offline={isOffline(q)}>
      {!v ? <Card><Skeleton /></Card> : (
        <>
          <Card>
            <Row>
              <Badge tone={v.status === "done" ? "success" : "info"} icon={v.status === "done" ? "check" : "calendar"} label={t(`maternal.visit_status.${v.status}`)} />
              <Badge tone="gold" label={t("maternal.week_n", { n: v.gestational_weeks })} />
            </Row>
            <Body>{formatDate(v.date, i18n.language)}{v.facility ? ` · ${v.facility}` : ""}</Body>
            {v.status === "done" ? (
              <>
                <H2>{t("maternal.measures")}</H2>
                <Body>{t("obs.blood_pressure")}: <Body bold>{v.bp ?? "—"} mmHg</Body></Body>
                <Body>{t("obs.weight")}: <Body bold>{v.weight_kg != null ? `${formatNumber(Number(v.weight_kg), i18n.language, 1)} kg` : "—"}</Body></Body>
                {v.notes ? <><H2>{t("maternal.notes")}</H2><Body>{v.notes}</Body></> : null}
              </>
            ) : <Small muted>{t("maternal.planned_note")}</Small>}
          </Card>
          {weights.length ? (
            <Card>
              <H2>{t("maternal.weight_chart")}</H2>
              <LineChart accessibilityLabel={t("maternal.weight_chart")} yUnit="kg" xLabel={t("maternal.weeks_axis")}
                points={weights.map((w) => ({ x: w.gestational_weeks ?? 0, y: Number(w.weight_kg), label: t("maternal.week_n", { n: w.gestational_weeks }), valueLabel: `${formatNumber(Number(w.weight_kg), i18n.language, 1)} kg` }))} />
            </Card>
          ) : null}
        </>
      )}
    </Screen>
  );
}
