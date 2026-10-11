import { useTranslation } from "react-i18next";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DEMO_MODE } from "../lib/config";
import { colors, type } from "../lib/theme";
import { Icon } from "./ui";

/** "DÉMO — données fictives" — visible on every screen (CLAUDE.md §2.1). Rendered once in the root layout. */
export function DemoBanner() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  return (
    <View style={[st.banner, { paddingTop: insets.top + 6 }]} accessibilityRole="text" accessibilityLabel={t("demo.banner")}>
      <Icon name="flask-outline" size={18} color={colors.navy} />
      <Text style={st.text}>{t("demo.banner")}{DEMO_MODE ? ` · ${t("preview.banner")}` : ""}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  banner: { backgroundColor: colors.gold, paddingBottom: 6, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  text: { color: colors.navy, fontWeight: "800", fontSize: type.small, letterSpacing: 0.5, textAlign: "center" },
});
