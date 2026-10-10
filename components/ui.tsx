// Small design-system primitives. Accessibility (CLAUDE.md §8): 48 px targets, ≥16 px body text,
// icons always paired with text, AA contrast, screen-reader labels.
import { MaterialCommunityIcons } from "@expo/vector-icons";
import type { ComponentProps, ReactNode } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from "react-native";
import { colors, fonts, radius, space, TOUCH, type } from "../lib/theme";

export type IconName = ComponentProps<typeof MaterialCommunityIcons>["name"];

export function Icon({ name, size = 24, color = colors.navy }: { name: IconName; size?: number; color?: string }) {
  return <MaterialCommunityIcons name={name} size={size} color={color} accessibilityElementsHidden importantForAccessibility="no" />;
}

export function H1({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[s.h1, style]}>{children}</Text>;
}
export function H2({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[s.h2, style]}>{children}</Text>;
}
export function H3({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text accessibilityRole="header" style={[s.h3, style]}>{children}</Text>;
}
export function Body({ children, style, muted, bold, numberOfLines }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; bold?: boolean; numberOfLines?: number }) {
  return <Text numberOfLines={numberOfLines} style={[s.body, muted && s.muted, bold && s.bold, style]}>{children}</Text>;
}
export function Small({ children, style, muted }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean }) {
  return <Text style={[s.small, muted && s.muted, style]}>{children}</Text>;
}

export function Card({ children, style, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  return <View style={[s.card, accent ? { borderStartWidth: 5, borderStartColor: accent } : null, style]}>{children}</View>;
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "gold";
export function Button({ label, onPress, icon, variant = "primary", disabled, loading, accessibilityHint, style }: {
  label: string; onPress?: () => void; icon?: IconName; variant?: ButtonVariant; disabled?: boolean; loading?: boolean;
  accessibilityHint?: string; style?: StyleProp<ViewStyle>;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [s.button, { backgroundColor: v.bg, borderColor: v.border }, pressed && { opacity: 0.85 }, (disabled || loading) && { opacity: 0.5 }, style]}
    >
      {loading ? <ActivityIndicator color={v.fg} /> : icon ? <Icon name={icon} size={22} color={v.fg} /> : null}
      <Text style={[s.buttonText, { color: v.fg }]}>{label}</Text>
    </Pressable>
  );
}
const buttonVariants: Record<ButtonVariant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.navy, fg: colors.white, border: colors.navy },
  secondary: { bg: colors.surface, fg: colors.navy, border: colors.navy },
  danger: { bg: colors.surface, fg: colors.error, border: colors.error },
  ghost: { bg: "transparent", fg: colors.navy, border: "transparent" },
  gold: { bg: colors.gold, fg: colors.navy, border: colors.gold },
};

/** Big icon + text tile used on home screens (low-literacy friendly). */
export function Tile({ icon, label, sublabel, onPress, tone = "navy", badge }: {
  icon: IconName; label: string; sublabel?: string; onPress: () => void; tone?: "navy" | "gold" | "error"; badge?: string;
}) {
  const color = tone === "error" ? colors.error : tone === "gold" ? colors.warning : colors.navy;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={[label, sublabel, badge].filter(Boolean).join(", ")} onPress={onPress}
      style={({ pressed }) => [s.tile, pressed && { backgroundColor: colors.goldSoft }]}>
      <View style={[s.tileIcon, { backgroundColor: tone === "error" ? colors.errorSoft : colors.goldSoft }]}>
        <Icon name={icon} size={30} color={color} />
      </View>
      <Text style={s.tileLabel}>{label}</Text>
      {sublabel ? <Text style={s.tileSub}>{sublabel}</Text> : null}
      {badge ? <View style={s.tileBadge}><Text style={s.tileBadgeText}>{badge}</Text></View> : null}
    </Pressable>
  );
}

export function Badge({ label, tone = "info", icon }: { label: string; tone?: "info" | "success" | "error" | "warning" | "neutral" | "gold"; icon?: IconName }) {
  const t = badgeTones[tone];
  return (
    <View style={[s.badge, { backgroundColor: t.bg, borderColor: t.fg }]} accessible accessibilityLabel={label}>
      {icon ? <Icon name={icon} size={16} color={t.fg} /> : null}
      <Text style={[s.badgeText, { color: t.fg }]}>{label}</Text>
    </View>
  );
}
const badgeTones = {
  info: { bg: colors.infoSoft, fg: colors.info },
  success: { bg: colors.successSoft, fg: colors.success },
  error: { bg: colors.errorSoft, fg: colors.error },
  warning: { bg: colors.warningSoft, fg: colors.warning },
  neutral: { bg: "#EEF0F3", fg: colors.slate },
  gold: { bg: colors.goldSoft, fg: colors.navy },
};

export function Row({ children, style, gap = space.sm }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap, flexWrap: "wrap" }, style]}>{children}</View>;
}

/** Skeleton placeholder (no spinners on slow connections — CLAUDE.md §8). */
export function Skeleton({ lines = 3, height = 18 }: { lines?: number; height?: number }) {
  return (
    <View accessibilityLabel="…" style={{ gap: space.sm }}>
      {Array.from({ length: lines }).map((_, i) => (
        <View key={i} style={{ height, borderRadius: radius.sm, backgroundColor: "#E7E3D8", width: `${90 - i * 12}%` }} />
      ))}
    </View>
  );
}

export function Notice({ tone = "info", icon, title, children }: { tone?: "info" | "warning" | "error" | "success"; icon?: IconName; title?: string; children?: ReactNode }) {
  const t = badgeTones[tone];
  return (
    <View style={[s.notice, { backgroundColor: t.bg, borderColor: t.fg }]} accessibilityRole="alert">
      {icon ? <Icon name={icon} size={22} color={t.fg} /> : null}
      <View style={{ flex: 1, gap: 2 }}>
        {title ? <Text style={[s.body, s.bold, { color: t.fg }]}>{title}</Text> : null}
        {typeof children === "string" ? <Text style={[s.small, { color: colors.text }]}>{children}</Text> : children}
      </View>
    </View>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[s.body, s.bold]}>{label}</Text>
      {children}
      {hint ? <Text style={[s.small, s.muted]}>{hint}</Text> : null}
    </View>
  );
}

export function Divider() {
  return <View style={{ height: 1, backgroundColor: colors.border, marginVertical: space.sm }} />;
}

export const s = StyleSheet.create({
  h1: { fontFamily: fonts.heading, fontSize: type.h1, color: colors.navy, fontWeight: "700" },
  h2: { fontFamily: fonts.heading, fontSize: type.h2, color: colors.navy, fontWeight: "700" },
  h3: { fontFamily: fonts.heading, fontSize: type.h3, color: colors.navy, fontWeight: "700" },
  body: { fontFamily: fonts.body, fontSize: type.body, color: colors.text, lineHeight: 24 },
  small: { fontFamily: fonts.body, fontSize: type.small, color: colors.text, lineHeight: 20 },
  muted: { color: colors.slate },
  bold: { fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border },
  button: { minHeight: TOUCH, paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.md, borderWidth: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm },
  buttonText: { fontFamily: fonts.body, fontSize: type.body, fontWeight: "700", textAlign: "center", flexShrink: 1 },
  tile: { flexBasis: 150, flexGrow: 1, minHeight: 132, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.md, gap: space.sm, alignItems: "flex-start" },
  tileIcon: { width: 52, height: 52, borderRadius: radius.md, alignItems: "center", justifyContent: "center" },
  tileLabel: { fontFamily: fonts.body, fontSize: type.large, fontWeight: "700", color: colors.navy },
  tileSub: { fontFamily: fonts.body, fontSize: type.small, color: colors.slate },
  tileBadge: { position: "absolute", top: space.sm, end: space.sm, backgroundColor: colors.navy, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 2 },
  tileBadgeText: { color: colors.white, fontWeight: "700", fontSize: type.small },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, borderRadius: radius.pill, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 3, alignSelf: "flex-start" },
  badgeText: { fontSize: type.small, fontWeight: "700" },
  notice: { flexDirection: "row", gap: space.sm, padding: space.md, borderRadius: radius.md, borderWidth: 1, alignItems: "flex-start" },
});
