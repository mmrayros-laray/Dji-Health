import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { Screen } from "../../components/Screen";
import { SourceChips } from "../../components/SourceChips";
import { Badge, Body, Button, Card, Field, Icon, Notice, Row, Skeleton, Small } from "../../components/ui";
import { useRecord, useSummary } from "../../lib/api";
import { formatDateTime } from "../../lib/format";
import { isRTL, type Lang } from "../../lib/i18n";
import { colors, space } from "../../lib/theme";

export default function Summary() {
  const { t, i18n } = useTranslation();
  const [lang, setLang] = useState<Lang>((i18n.language as Lang) ?? "fr");
  const rec = useRecord();
  const q = useSummary(lang);
  const ok = q.data?.status === "ok";

  return (
    <Screen title={t("summary.title")} subtitle={t("summary.subtitle")} back="/vault">
      <Field label={t("summary.language")}>
        <LanguageSwitcher compact value={lang} onChange={setLang} />
      </Field>

      <Card accent={colors.gold}>
        <Row>
          <Icon name="robot-outline" />
          <Badge tone="gold" icon="creation" label={t("summary.ai_badge")} />
        </Row>
        {q.isLoading ? <Skeleton lines={5} /> : null}
        {q.isError ? <Notice tone="error" icon="alert-circle-outline" title={t("common.error")}>{q.error.message}</Notice> : null}
        {q.data ? (
          <View style={{ gap: space.md, direction: isRTL(lang) ? "rtl" : "ltr" }}>
            <Text style={{ fontSize: 19, lineHeight: 30, color: ok ? colors.text : colors.slate, textAlign: isRTL(lang) ? "right" : "left" }}>
              {q.data.summary}
            </Text>
            <Notice tone="warning" icon="account-check-outline">{q.data.label}</Notice>
            {ok ? <SourceChips refs={q.data.source_refs} refMap={q.data.ref_map} record={rec.data} /> : null}
            {q.data.created_at ? <Small muted>{t("summary.generated_at", { date: formatDateTime(q.data.created_at, i18n.language) })}</Small> : null}
          </View>
        ) : null}
      </Card>

      <Card>
        <Row><Icon name="shield-check-outline" /><Body bold style={{ flex: 1 }}>{t("summary.how_title")}</Body></Row>
        {(["only_record", "no_advice", "deid", "validator"] as const).map((k) => (
          <Row key={k} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Icon name="check" size={20} color={colors.success} />
            <Body style={{ flex: 1 }}>{t(`summary.how.${k}`)}</Body>
          </Row>
        ))}
      </Card>
      <Button variant="ghost" icon="refresh" label={t("common.refresh")} onPress={() => q.refetch()} loading={q.isFetching} />
    </Screen>
  );
}
