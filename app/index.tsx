import { Redirect, router } from "expo-router";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { Screen } from "../components/Screen";
import { Body, Button, Card, H2, Icon, Row } from "../components/ui";
import { useAuth } from "../lib/auth";
import { homeFor } from "../lib/demoAccounts";
import { colors, fonts, space } from "../lib/theme";

export default function Home() {
  const { t } = useTranslation();
  const { session, role, ready } = useAuth();
  if (ready && session && role) return <Redirect href={homeFor(role) as never} />;

  return (
    <Screen>
      <View style={st.hero}>
        <View style={st.logo} accessibilityElementsHidden importantForAccessibility="no">
          <Icon name="heart-pulse" size={44} color={colors.gold} />
        </View>
        <Text accessibilityRole="header" style={st.title}>DjiHealth</Text>
        <Text style={st.tagline}>{t("home.tagline")}</Text>
      </View>

      <Card>
        <H2>{t("language.choose")}</H2>
        <LanguageSwitcher />
      </Card>

      <Card>
        <Row><Icon name="lock-outline" /><Body bold>{t("home.privacy_title")}</Body></Row>
        <Body muted>{t("home.privacy_body")}</Body>
      </Card>

      <Button label={t("home.start")} icon="play-circle-outline" onPress={() => router.push("/sign-in")} />

      <View style={{ gap: space.sm }}>
        {(["vault", "emergency", "maternal", "ai", "ministry"] as const).map((k) => (
          <Row key={k} style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
            <Icon name={featureIcons[k]} color={colors.navy} />
            <Body style={{ flex: 1 }}>{t(`home.features.${k}`)}</Body>
          </Row>
        ))}
      </View>
    </Screen>
  );
}

const featureIcons = { vault: "folder-heart-outline", emergency: "qrcode", maternal: "mother-heart", ai: "robot-outline", ministry: "chart-box-outline" } as const;

const st = StyleSheet.create({
  hero: { backgroundColor: colors.navy, borderRadius: 20, padding: space.xl, alignItems: "center", gap: space.sm },
  logo: { width: 76, height: 76, borderRadius: 38, borderWidth: 2, borderColor: colors.gold, alignItems: "center", justifyContent: "center" },
  title: { fontFamily: fonts.heading, fontSize: 40, color: colors.white, fontWeight: "700" },
  tagline: { color: colors.goldSoft, fontSize: 18, textAlign: "center" },
});
