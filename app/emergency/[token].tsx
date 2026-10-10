// Public emergency view (CLAUDE.md §5). No login. Large, high-contrast type; French by default with a toggle.
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { Icon, Skeleton } from "../../components/ui";
import { useEmergencyView } from "../../lib/api";
import { isRTL, type Lang } from "../../lib/i18n";
import { colors, fonts, space } from "../../lib/theme";
import glossary from "../../locales/glossary.json";
import { translateItem, type Glossary } from "../../supabase/functions/_shared/glossary.ts";

export default function EmergencyView() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { i18n } = useTranslation();
  const [lang, setLang] = useState<Lang>("fr");
  const t = i18n.getFixedT(lang);
  const q = useEmergencyView(token ?? "");
  const term = (s: string) => translateItem(s, undefined, lang, glossary as unknown as Glossary);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.white }} contentContainerStyle={st.page}>
      <View style={[st.inner, { direction: isRTL(lang) ? "rtl" : "ltr" }]}>
        <View style={st.header}>
          <Icon name="medical-bag" size={36} color={colors.white} />
          <Text style={st.headerText} accessibilityRole="header">{t("ev.title")}</Text>
        </View>
        <LanguageSwitcher compact value={lang} onChange={setLang} />

        {q.isLoading ? <Skeleton lines={6} height={28} /> : null}

        {q.data?.status === "revoked" || q.data?.status === "expired" ? (
          <View style={[st.block, st.bad]}>
            <Icon name="card-remove-outline" size={48} color={colors.error} />
            <Text style={st.badText}>{q.data.status === "revoked" ? t("ev.revoked") : t("ev.expired")}</Text>
          </View>
        ) : null}
        {q.data?.status === "not_found" || q.data?.status === "error" || q.isError ? (
          <View style={[st.block, st.bad]}>
            <Icon name="help-circle-outline" size={48} color={colors.error} />
            <Text style={st.badText}>{t("ev.not_found")}</Text>
          </View>
        ) : null}

        {q.data?.status === "ok" ? (() => {
          const d = q.data.data;
          return (
            <>
              <View style={st.identity}>
                <Text style={st.name}>{d.first_name}</Text>
                <Text style={st.big}>{t("ev.age", { count: d.age_years })}</Text>
              </View>
              <View style={[st.block, { borderColor: colors.error }]}>
                <Text style={st.label}>{t("ev.blood_group")}</Text>
                <Text style={st.blood}>{d.blood_group === "unknown" ? t("ev.unknown") : d.blood_group}</Text>
              </View>
              <Section title={t("ev.allergies")} icon="alert-octagon" danger
                items={d.critical_allergies.map((a) => `${term(a.substance)}${a.reaction ? ` — ${a.reaction}` : ""}`)} none={t("ev.none")} />
              <Section title={t("ev.conditions")} icon="heart-pulse" danger items={d.critical_conditions.map((c) => term(c.display))} none={t("ev.none")} />
              <Section title={t("ev.medications")} icon="pill" items={d.current_medications.map((m) => `${term(m.name)}${m.dosage ? ` — ${m.dosage}` : ""}`)} none={t("ev.none")} />
              <View style={[st.block, { borderColor: colors.navy }]}>
                <Text style={st.label}>{t("ev.contact")}</Text>
                <Text style={st.big}>{d.emergency_contact.name ?? "—"}</Text>
                {d.emergency_contact.phone ? (
                  <Pressable accessibilityRole="link" onPress={() => Linking.openURL(`tel:${d.emergency_contact.phone!.replace(/\s/g, "")}`)} style={st.call}>
                    <Icon name="phone" color={colors.white} />
                    <Text style={st.callText}>{d.emergency_contact.phone}</Text>
                  </Pressable>
                ) : null}
              </View>
              <Text style={st.note}>{t("ev.logged")}</Text>
            </>
          );
        })() : null}
        <Text style={st.note}>{t("ev.demo_note")}</Text>
      </View>
    </ScrollView>
  );
}

function Section({ title, icon, items, none, danger }: { title: string; icon: "alert-octagon" | "heart-pulse" | "pill"; items: string[]; none: string; danger?: boolean }) {
  return (
    <View style={[st.block, { borderColor: danger && items.length ? colors.error : colors.navy }]}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Icon name={icon} size={28} color={danger && items.length ? colors.error : colors.navy} />
        <Text style={st.label}>{title}</Text>
      </View>
      {items.length ? items.map((i) => <Text key={i} style={[st.big, danger && { color: colors.error }]}>• {i}</Text>) : <Text style={st.big}>{none}</Text>}
    </View>
  );
}

const st = StyleSheet.create({
  page: { padding: space.lg, alignItems: "center", paddingBottom: 64 },
  inner: { width: "100%", maxWidth: 640, gap: space.lg },
  header: { backgroundColor: colors.error, borderRadius: 12, padding: space.lg, flexDirection: "row", gap: 12, alignItems: "center" },
  headerText: { color: colors.white, fontSize: 26, fontWeight: "800", flex: 1 },
  identity: { gap: 4 },
  name: { fontSize: 44, fontWeight: "800", color: colors.navy, fontFamily: fonts.heading },
  big: { fontSize: 24, fontWeight: "700", color: colors.navy, lineHeight: 32 },
  block: { borderWidth: 3, borderRadius: 12, padding: space.lg, gap: 6 },
  label: { fontSize: 18, fontWeight: "800", color: colors.slate, textTransform: "uppercase" },
  blood: { fontSize: 64, fontWeight: "900", color: colors.error },
  bad: { borderColor: colors.error, alignItems: "center", backgroundColor: colors.errorSoft },
  badText: { fontSize: 30, fontWeight: "800", color: colors.error, textAlign: "center" },
  call: { marginTop: 8, minHeight: 56, backgroundColor: colors.success, borderRadius: 10, flexDirection: "row", gap: 10, alignItems: "center", justifyContent: "center" },
  callText: { color: colors.white, fontSize: 22, fontWeight: "800" },
  note: { fontSize: 16, color: colors.slate, textAlign: "center" },
});
