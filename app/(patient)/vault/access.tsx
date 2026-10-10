import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Screen } from "../../../components/Screen";
import { Badge, Body, Button, Card, Icon, Row, Skeleton, Small, type IconName } from "../../../components/ui";
import { useAccessHistory } from "../../../lib/api";
import { formatDateTime } from "../../../lib/format";
import { isOffline } from "../../../lib/hooks";
import { colors, space } from "../../../lib/theme";

const ICONS: Record<string, IconName> = {
  record_view: "eye-outline", emergency_access: "qrcode-scan", emergency_access_denied: "cancel",
  emergency_card_created: "card-account-details-outline", emergency_card_revoked: "card-remove-outline",
  consent_code_created: "key-plus", consent_granted: "account-key", consent_revoked: "key-remove",
  encounter_added: "note-plus-outline", ai_summary: "robot-outline", ai_assistant: "robot-outline",
};

export default function AccessHistory() {
  const { patient } = useLocalSearchParams<{ patient?: string }>();
  const { t, i18n } = useTranslation();
  const q = useAccessHistory(patient);
  const [showSelf, setShowSelf] = useState(false);
  const rows = (q.data ?? []).filter((a) => showSelf || !a.is_self || a.action.startsWith("emergency_card") || a.action.startsWith("consent"));

  return (
    <Screen title={t("access.title")} subtitle={t("access.subtitle")} back="/vault" offline={isOffline(q)} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      <Button variant="secondary" icon={showSelf ? "eye-off-outline" : "eye-outline"} label={showSelf ? t("access.hide_self") : t("access.show_self")} onPress={() => setShowSelf(!showSelf)} />
      {q.isLoading ? <Card><Skeleton lines={6} /></Card> : null}
      {rows.length === 0 && !q.isLoading ? <Body muted>{t("access.empty")}</Body> : null}
      {rows.map((a) => {
        const emergency = a.action === "emergency_access";
        return (
          <Card key={a.id} accent={a.flagged ? colors.error : a.actor_role === "clinician" ? colors.info : undefined}>
            <Row style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
              <Icon name={ICONS[a.action] ?? "information-outline"} color={a.flagged ? colors.error : colors.navy} />
              <View style={{ flex: 1, gap: space.xs }}>
                <Body bold>{emergency ? t("access.emergency_scanned") : t(`access.actions.${a.action}`, { defaultValue: a.action })}</Body>
                <Small muted>{formatDateTime(a.created_at, i18n.language)}</Small>
                <Body>{a.is_self ? t("access.by_you") : a.actor_name ?? t(`access.roles.${a.actor_role}`, { defaultValue: a.actor_role })}</Body>
                {a.reason ? <Small>{t("access.reason")}: {a.reason}</Small> : null}
                {a.flagged ? <Badge tone="error" icon="flag" label={t("access.flagged")} /> : null}
              </View>
            </Row>
          </Card>
        );
      })}
    </Screen>
  );
}
