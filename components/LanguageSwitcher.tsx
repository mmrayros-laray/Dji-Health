import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LANGUAGES, setLanguage, type Lang } from "../lib/i18n";
import { colors, radius, TOUCH, type } from "../lib/theme";

export function LanguageSwitcher({ compact, value, onChange }: { compact?: boolean; value?: Lang; onChange?: (l: Lang) => void }) {
  const { t, i18n } = useTranslation();
  const current = value ?? (i18n.language as Lang);
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={t("language.choose")} style={st.row}>
      {LANGUAGES.map((l) => {
        const selected = l.code === current;
        return (
          <Pressable
            key={l.code}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={l.label}
            onPress={() => (onChange ? onChange(l.code) : setLanguage(l.code))}
            style={[st.pill, compact && st.compact, selected && st.selected]}
          >
            <Text style={[st.text, selected && st.selectedText]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const st = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: { minHeight: TOUCH, minWidth: TOUCH, paddingHorizontal: 16, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.navy, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" },
  compact: { paddingHorizontal: 12 },
  selected: { backgroundColor: colors.navy },
  text: { color: colors.navy, fontWeight: "700", fontSize: type.body },
  selectedText: { color: colors.white },
});
