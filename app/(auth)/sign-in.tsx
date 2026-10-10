import { Redirect } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { LanguageSwitcher } from "../../components/LanguageSwitcher";
import { Screen } from "../../components/Screen";
import { Body, Icon, Notice, Small, type IconName } from "../../components/ui";
import { useAuth } from "../../lib/auth";
import { DEMO_ACCOUNTS, homeFor } from "../../lib/demoAccounts";
import { colors, radius, space, type } from "../../lib/theme";

export default function SignIn() {
  const { t } = useTranslation();
  const { session, role, signInDemo } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (session && role) return <Redirect href={homeFor(role) as never} />;

  const go = async (email: string) => {
    setBusy(email);
    setError(null);
    try {
      await signInDemo(email);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen title={t("signin.title")} subtitle={t("signin.subtitle")} back="/">
      <LanguageSwitcher compact />
      {error ? <Notice tone="error" icon="alert-circle-outline" title={t("signin.error")}>{error}</Notice> : null}
      <View style={{ gap: space.md }}>
        {DEMO_ACCOUNTS.map((a) => (
          <Pressable
            key={a.key}
            accessibilityRole="button"
            accessibilityLabel={`${t(`signin.accounts.${a.key}.name`)}, ${t(`signin.accounts.${a.key}.desc`)}`}
            onPress={() => go(a.email)}
            disabled={Boolean(busy)}
            style={({ pressed }) => [st.account, pressed && { backgroundColor: colors.goldSoft }, a.key === "admin" && st.adminAccount]}
          >
            <View style={st.avatar}><Icon name={a.icon as IconName} size={30} color={colors.navy} /></View>
            <View style={{ flex: 1 }}>
              <Text style={st.name}>{t(`signin.accounts.${a.key}.name`)}</Text>
              <Body muted>{t(`signin.accounts.${a.key}.desc`)}</Body>
            </View>
            {busy === a.email ? <ActivityIndicator color={colors.navy} /> : <Icon name="login" color={colors.navy} />}
          </Pressable>
        ))}
      </View>
      <Small muted>{t("signin.note")}</Small>
    </Screen>
  );
}

const st = StyleSheet.create({
  account: { flexDirection: "row", alignItems: "center", gap: space.md, padding: space.lg, minHeight: 80, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  adminAccount: { opacity: 0.9, borderStyle: "dashed" },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.goldSoft, alignItems: "center", justifyContent: "center" },
  name: { fontSize: type.large, fontWeight: "700", color: colors.navy },
});
