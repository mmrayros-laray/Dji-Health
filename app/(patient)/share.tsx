// "Partager mon dossier" (M5, patient side): short-lived consent code + QR, list and revoke grants.
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "../../components/Screen";
import { Badge, Body, Button, Card, H2, Icon, Notice, Row, Skeleton, Small } from "../../components/ui";
import { useConsents, useCreateConsentCode, useRevokeConsent } from "../../lib/api";
import { CONSENT_QR_PREFIX } from "../../lib/config";
import { formatDateTime } from "../../lib/format";
import { colors, radius, space } from "../../lib/theme";

export default function Share() {
  const { t, i18n } = useTranslation();
  const consents = useConsents();
  const create = useCreateConsentCode();
  const revoke = useRevokeConsent();
  const code = create.data;
  const tone = { active: "success", pending: "info", expired: "neutral", revoked: "error" } as const;

  return (
    <Screen title={t("share.title")} subtitle={t("share.subtitle")} onRefresh={() => consents.refetch()} refreshing={consents.isFetching}>
      <Card accent={colors.gold}>
        <Row><Icon name="account-key-outline" /><H2 style={{ flex: 1 }}>{t("share.new_code")}</H2></Row>
        <Body>{t("share.explain")}</Body>
        {code ? (
          <View style={st.codeBox}>
            <View style={st.qr}><QRCode value={`${CONSENT_QR_PREFIX}${code.code}`} size={160} color={colors.navy} /></View>
            <View style={{ alignItems: "center", gap: 4 }}>
              <Small muted>{t("share.code_label")}</Small>
              <Text style={st.code} accessibilityLabel={code.code.split("").join(" ")} selectable>{code.code}</Text>
              <Small muted>{t("share.valid_until", { date: formatDateTime(code.expires_at, i18n.language) })}</Small>
            </View>
          </View>
        ) : null}
        <Button icon="key-plus" label={code ? t("share.another_code") : t("share.generate")} onPress={() => create.mutate()} loading={create.isPending} />
        {create.isError ? <Notice tone="error" icon="alert-circle-outline">{create.error.message}</Notice> : null}
      </Card>

      <Card>
        <H2>{t("share.grants")}</H2>
        {consents.isLoading ? <Skeleton /> : null}
        {consents.data?.length === 0 ? <Body muted>{t("share.no_grants")}</Body> : null}
        {consents.data?.map((c) => (
          <View key={c.id} style={st.grant}>
            <Row>
              <Badge tone={tone[c.status]} label={t(`share.status.${c.status}`)} />
              <Body bold style={{ flex: 1 }}>{c.practitioner_name ?? t("share.waiting")}</Body>
            </Row>
            {c.practitioner_facility ? <Small muted>{c.practitioner_facility}</Small> : null}
            <Small muted>{c.granted_at ? t("share.granted_at", { date: formatDateTime(c.granted_at, i18n.language) }) : t("share.created_at", { date: formatDateTime(c.created_at, i18n.language) })} · {t("share.expires_at", { date: formatDateTime(c.expires_at, i18n.language) })}</Small>
            {c.status === "active" || c.status === "pending" ? (
              <Button variant="danger" icon="key-remove" label={t("share.revoke")} onPress={() => revoke.mutate(c.id)} loading={revoke.isPending && revoke.variables === c.id} />
            ) : null}
          </View>
        ))}
      </Card>
      <Button variant="secondary" icon="history" label={t("vault.open_access")} onPress={() => router.push("/vault/access")} />
    </Screen>
  );
}

const st = StyleSheet.create({
  codeBox: { alignItems: "center", gap: space.md, padding: space.lg, backgroundColor: colors.bg, borderRadius: radius.lg },
  qr: { backgroundColor: colors.white, padding: 10, borderRadius: radius.md },
  code: { fontSize: 40, fontWeight: "800", letterSpacing: 4, color: colors.navy, fontVariant: ["tabular-nums"] },
  grant: { gap: 6, paddingVertical: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
