import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { PatientRecord } from "../lib/api";
import { useTerm } from "../lib/hooks";
import { colors, radius, TOUCH } from "../lib/theme";
import { Icon } from "./ui";

/** Tappable chips linking an AI statement to the record items it came from. */
export function SourceChips({ refs, refMap, record }: { refs: string[]; refMap: Record<string, { section: string; id: string } | undefined>; record?: PatientRecord }) {
  const { t } = useTranslation();
  const term = useTerm();
  const seen = new Set<string>();
  const chips = refs.flatMap((ref) => {
    const target = refMap[ref];
    if (!target) return [];
    const label = labelFor(target, record, term, t);
    const key = `${target.section}:${label}`; // one chip per distinct item (a pregnancy and its visits share a page)
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ ref, target, label }];
  });
  if (!chips.length) return null;
  return (
    <View style={st.wrap}>
      <Text style={st.title}>{t("summary.sources")}</Text>
      <View style={st.row}>
        {chips.map((c) => (
          <Pressable key={c.ref} accessibilityRole="link" accessibilityLabel={`${t("summary.open_source")}: ${c.label}`} style={st.chip}
            onPress={() => router.push(pathFor(c.target))}>
            <Icon name="link-variant" size={16} color={colors.info} />
            <Text style={st.chipText}>{c.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function pathFor(t: { section: string; id: string }): never {
  if (t.section === "pregnancies") return "/maternal" as never;
  if (t.section === "children") return `/children/${t.id}` as never;
  return `/vault/${t.section}?focus=${t.id}` as never;
}

function labelFor(target: { section: string; id: string }, r: PatientRecord | undefined, term: (s: string, c?: string | null) => string, t: (k: string) => string): string {
  if (!r) return t(`sections.${target.section}`);
  switch (target.section) {
    case "conditions": { const c = r.conditions.find((x) => x.id === target.id); return c ? term(c.display, c.code) : t("sections.conditions"); }
    case "allergies": { const a = r.allergies.find((x) => x.id === target.id); return a ? term(a.substance) : t("sections.allergies"); }
    case "medications": { const m = r.medications.find((x) => x.id === target.id); return m ? term(m.name) : t("sections.medications"); }
    case "immunizations": { const i = r.immunizations.find((x) => x.id === target.id); return i ? term(i.vaccine_name, i.vaccine_code) : t("sections.immunizations"); }
    case "encounters": { const e = r.encounters.find((x) => x.id === target.id); return e ? e.reason : t("sections.encounters"); }
    case "pregnancies": return t("maternal.pregnancy");
    case "children": { const c = r.children.find((x) => x.id === target.id); return c ? c.given_name : t("children.title"); }
    default: return target.section;
  }
}

const st = StyleSheet.create({
  wrap: { gap: 6 },
  title: { fontSize: 14, fontWeight: "700", color: colors.slate },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: TOUCH - 8, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.info, backgroundColor: colors.infoSoft },
  chipText: { color: colors.info, fontWeight: "700", fontSize: 15 },
});
