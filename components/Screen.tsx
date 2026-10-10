import { router } from "expo-router";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { isMachineTranslated, isRTL } from "../lib/i18n";
import { colors, MAX_WIDTH, space, TOUCH, type } from "../lib/theme";
import { H1, Icon, Small } from "./ui";

export function Screen({ title, subtitle, children, back, right, wide, onRefresh, refreshing, offline }: {
  title?: string; subtitle?: string; children: ReactNode; back?: boolean | string; right?: ReactNode; wide?: boolean;
  onRefresh?: () => void; refreshing?: boolean; offline?: boolean;
}) {
  const { t, i18n } = useTranslation();
  const rtl = isRTL(i18n.language);
  const goBack = () => {
    if (typeof back === "string") router.replace(back as never);
    else if (router.canGoBack()) router.back();
    else router.replace("/" as never);
  };
  return (
    <ScrollView
      style={st.scroll}
      contentContainerStyle={st.content}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} /> : undefined}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[st.inner, wide && { maxWidth: 1280 }]}>
        {back || title || right ? (
          <View style={st.header}>
            {back ? (
              <Pressable accessibilityRole="button" accessibilityLabel={t("common.back")} onPress={goBack} style={st.back}>
                <Icon name={rtl ? "arrow-right" : "arrow-left"} size={24} />
                <Text style={st.backText}>{t("common.back")}</Text>
              </Pressable>
            ) : null}
            <View style={{ flex: 1 }} />
            {right}
          </View>
        ) : null}
        {title ? <H1>{title}</H1> : null}
        {subtitle ? <Text style={st.subtitle}>{subtitle}</Text> : null}
        {offline ? (
          <View style={st.offline} accessibilityRole="alert">
            <Icon name="cloud-off-outline" size={20} color={colors.warning} />
            <Text style={st.offlineText}>{t("common.offline")}</Text>
          </View>
        ) : null}
        {isMachineTranslated(i18n.language) ? <Small muted style={st.review}>{t("language.machine_note")}</Small> : null}
        <View style={{ gap: space.lg }}>{children}</View>
        {Platform.OS === "web" ? <Text style={st.footer}>{t("demo.footer")}</Text> : null}
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: space.xxl * 2, alignItems: "center" },
  inner: { width: "100%", maxWidth: MAX_WIDTH, gap: space.md },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm },
  back: { minHeight: TOUCH, flexDirection: "row", alignItems: "center", gap: 6, paddingEnd: space.md },
  backText: { fontSize: type.body, color: colors.navy, fontWeight: "700" },
  subtitle: { fontSize: type.large, color: colors.slate, marginTop: -space.xs },
  offline: { flexDirection: "row", gap: 8, alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 8, padding: space.sm },
  offlineText: { color: colors.warning, fontWeight: "700", flex: 1 },
  review: { fontStyle: "italic" },
  footer: { marginTop: space.xxl, textAlign: "center", color: colors.slate, fontSize: type.small },
});
