import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { Screen } from "../../../components/Screen";
import { SignOutButton } from "../../../components/SignOutButton";
import { Badge, Body, Button, Card, H2, Icon, Notice, Row, Skeleton, Small, Tile } from "../../../components/ui";
import { useAccessHistory, useRecord } from "../../../lib/api";
import { formatDate, formatDateTime } from "../../../lib/format";
import { isOffline, todayIso } from "../../../lib/hooks";
import { colors, fonts, space } from "../../../lib/theme";
import { ageYears } from "../../../supabase/functions/_shared/clinical.ts";

export default function VaultHome() {
  const { t, i18n } = useTranslation();
  const q = useRecord();
  const access = useAccessHistory();
  const r = q.data;

  const recentScan = access.data?.find((a) => a.action === "emergency_access" && Date.now() - new Date(a.created_at).getTime() < 7 * 86400_000);
  const otherViews = access.data?.filter((a) => !a.is_self && a.action === "record_view").length ?? 0;

  return (
    <Screen title={t("vault.title")} onRefresh={() => { q.refetch(); access.refetch(); }} refreshing={q.isFetching} offline={isOffline(q)} right={<SignOutButton />}>
      {q.isLoading ? <Card><Skeleton lines={4} /></Card> : null}
      {q.isError && !r ? <Notice tone="error" icon="alert-circle-outline" title={t("common.error")}>{q.error.message}</Notice> : null}

      {r ? (
        <>
          <Card style={st.profile}>
            <View style={st.photo} accessibilityLabel={t("vault.photo_placeholder")}>
              <Text style={st.initials}>{r.patient.given_name[0]}{r.patient.family_name[0]}</Text>
            </View>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={st.name}>{r.patient.given_name} {r.patient.family_name}</Text>
              <Body muted>{t("vault.age", { count: ageYears(r.patient.birth_date, todayIso()) })} · {t(`sex.${r.patient.sex}`)}</Body>
              <Row>
                <Badge tone="error" icon="water" label={`${t("vault.blood_group")} ${r.patient.blood_group === "unknown" ? t("common.unknown") : r.patient.blood_group}`} />
                <Badge tone="gold" icon="map-marker-outline" label={r.patient.region} />
              </Row>
            </View>
          </Card>

          {recentScan ? (
            <Notice tone="error" icon="qrcode-scan" title={t("vault.emergency_scanned")}>
              {t("vault.emergency_scanned_when", { when: formatDateTime(recentScan.created_at, i18n.language) })}
            </Notice>
          ) : null}

          <Card accent={colors.gold}>
            <Row><Icon name="robot-outline" /><H2 style={{ flex: 1 }}>{t("summary.title")}</H2></Row>
            <Body muted>{t("vault.summary_teaser")}</Body>
            <Button variant="gold" icon="text-box-search-outline" label={t("vault.open_summary")} onPress={() => router.push("/summary")} />
          </Card>

          <View style={st.grid}>
            <Tile icon="clipboard-pulse-outline" label={t("sections.conditions")} badge={String(r.conditions.filter((c) => c.clinical_status === "active").length)} onPress={() => router.push("/vault/conditions")} />
            <Tile icon="alert-octagon-outline" tone={r.allergies.some((a) => a.criticality === "high") ? "error" : "navy"} label={t("sections.allergies")} badge={String(r.allergies.length)} onPress={() => router.push("/vault/allergies")} />
            <Tile icon="pill" label={t("sections.medications")} badge={String(r.medications.filter((m) => m.status === "active").length)} onPress={() => router.push("/vault/medications")} />
            <Tile icon="needle" label={t("sections.immunizations")} badge={String(r.immunizations.length)} onPress={() => router.push("/vault/immunizations")} />
            <Tile icon="hospital-building" label={t("sections.encounters")} badge={String(r.encounters.length)} onPress={() => router.push("/vault/encounters")} />
            <Tile icon="file-document-multiple-outline" label={t("sections.documents")} badge={String(r.documents.length)} onPress={() => router.push("/vault/documents")} />
          </View>

          <Card>
            <Row><Icon name="eye-outline" /><H2 style={{ flex: 1 }}>{t("access.title")}</H2></Row>
            <Body muted>{t("vault.access_teaser", { count: otherViews })}</Body>
            <Button variant="secondary" icon="history" label={t("vault.open_access")} onPress={() => router.push("/vault/access")} />
          </Card>

          {r.children.length ? (
            <Card>
              <Row><Icon name="human-female-boy" /><H2 style={{ flex: 1 }}>{t("children.title")}</H2></Row>
              {r.children.map((c) => (
                <Button key={c.id} variant="secondary" icon="baby-face-outline" label={`${c.given_name} — ${formatDate(c.birth_date, i18n.language)}`} onPress={() => router.push(`/children/${c.id}`)} />
              ))}
            </Card>
          ) : null}

          <Small muted>{t("vault.synthetic_note")}</Small>
        </>
      ) : null}
    </Screen>
  );
}

const st = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: space.lg },
  photo: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.navy, alignItems: "center", justifyContent: "center", borderWidth: 3, borderColor: colors.gold },
  initials: { color: colors.white, fontSize: 30, fontWeight: "700", fontFamily: fonts.heading },
  name: { fontSize: 24, fontWeight: "700", color: colors.navy, fontFamily: fonts.heading },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md },
});
