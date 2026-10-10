// Plain react-native-svg charts (no chart library — small bundle, CLAUDE.md §3).
// Single-series marks use one validated hue; values/labels use text colours; every chart has a table view.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Line, Path, Text as SvgText } from "react-native-svg";
import { colors, radius, space, TOUCH, type } from "../lib/theme";
import { Small } from "./ui";

export const DATA_COLOR = "#2F6DB5"; // validated: lightness band + contrast vs surface
const GRID = "#E6E2D8";

export interface Point { x: number; y: number; label: string; valueLabel: string }

/** Line chart (2px line, ≥8px markers with surface ring, end label, tap a point to read it). */
export function LineChart({ points, height = 200, xLabel, yUnit, accessibilityLabel }: {
  points: Point[]; height?: number; xLabel?: string; yUnit?: string; accessibilityLabel: string;
}) {
  const { t } = useTranslation();
  const [width, setWidth] = useState(0);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  if (points.length === 0) return <Small muted>{t("common.no_data")}</Small>;
  const pad = { l: 40, r: 56, t: 16, b: 28 };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yLo = Math.floor(Math.min(...ys) * 0.9), yHi = Math.ceil(Math.max(...ys) * 1.05);
  const w = Math.max(width - pad.l - pad.r, 10), h = height - pad.t - pad.b;
  const sx = (x: number) => pad.l + (xMax === xMin ? w / 2 : ((x - xMin) / (xMax - xMin)) * w);
  const sy = (y: number) => pad.t + h - ((y - yLo) / (yHi - yLo || 1)) * h;
  const ticks = [yLo, Math.round((yLo + yHi) / 2), yHi];
  const d = points.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const sel = active !== null ? points[active] : null;

  return (
    <View style={{ gap: space.sm }}>
      <View onLayout={onLayout} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel} style={{ direction: "ltr" }}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            {ticks.map((v) => (
              <Line key={v} x1={pad.l} x2={pad.l + w} y1={sy(v)} y2={sy(v)} stroke={GRID} strokeWidth={1} />
            ))}
            {ticks.map((v) => (
              <SvgText key={`t${v}`} x={pad.l - 6} y={sy(v) + 4} fontSize={12} fill={colors.slate} textAnchor="end">{v}</SvgText>
            ))}
            <Path d={d} stroke={DATA_COLOR} strokeWidth={2} fill="none" strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <Circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={active === i ? 7 : 5} fill={DATA_COLOR} stroke={colors.surface} strokeWidth={2}
                onPress={() => setActive(active === i ? null : i)} />
            ))}
            <SvgText x={sx(last.x) + 8} y={sy(last.y) + 4} fontSize={13} fontWeight="bold" fill={colors.text}>{last.valueLabel}</SvgText>
            {xLabel ? <SvgText x={pad.l + w / 2} y={height - 6} fontSize={12} fill={colors.slate} textAnchor="middle">{xLabel}</SvgText> : null}
            {yUnit ? <SvgText x={4} y={10} fontSize={12} fill={colors.slate}>{yUnit}</SvgText> : null}
          </Svg>
        ) : <View style={{ height }} />}
      </View>
      {sel ? <Small><Text style={{ fontWeight: "700" }}>{sel.label}</Text> — {sel.valueLabel}</Small> : <Small muted>{t("charts.tap_point")}</Small>}
      <TableToggle open={table} onToggle={() => setTable(!table)} />
      {table ? <DataTable rows={points.map((p) => [p.label, p.valueLabel])} /> : null}
    </View>
  );
}

export interface BarDatum { key: string; label: string; value: number | null; valueLabel: string; suppressed?: boolean; sublabel?: string }

/** Horizontal bar list. Suppressed cells (< 5) show a hatched track and the text "< 5" — never a bar length. */
export function BarList({ data, max, accessibilityLabel }: { data: BarDatum[]; max?: number; accessibilityLabel: string }) {
  const { t } = useTranslation();
  const [table, setTable] = useState(false);
  const top = max ?? Math.max(1, ...data.map((d) => d.value ?? 0));
  return (
    <View style={{ gap: space.sm }} accessibilityLabel={accessibilityLabel}>
      {data.map((d) => (
        <View key={d.key} style={st.barRow} accessible accessibilityLabel={`${d.label}: ${d.suppressed ? t("ministry.suppressed_a11y") : d.valueLabel}`}>
          <View style={st.barLabelBox}>
            <Text style={st.barLabel} numberOfLines={2}>{d.label}</Text>
            {d.sublabel ? <Text style={st.barSub}>{d.sublabel}</Text> : null}
          </View>
          <View style={st.track}>
            {d.suppressed ? (
              <View style={st.suppressed} />
            ) : (
              <View style={[st.bar, { width: `${Math.max(1, ((d.value ?? 0) / top) * 100)}%` }]} />
            )}
          </View>
          <Text style={[st.barValue, d.suppressed && { color: colors.slate }]}>{d.suppressed ? "< 5" : d.valueLabel}</Text>
        </View>
      ))}
      <TableToggle open={table} onToggle={() => setTable(!table)} />
      {table ? <DataTable rows={data.map((d) => [d.label + (d.sublabel ? ` (${d.sublabel})` : ""), d.suppressed ? "< 5" : d.valueLabel])} /> : null}
    </View>
  );
}

/** Progress toward a target (e.g. antenatal visits done / recommended). */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = Math.min(100, (value / Math.max(max, 1)) * 100);
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max, now: value }} style={{ gap: 6 }}>
      <View style={[st.track, { height: 16 }]}>
        <View style={[st.bar, { width: `${pct}%`, height: 16, backgroundColor: colors.success }]} />
      </View>
      <Text style={st.barLabel}>{label}</Text>
    </View>
  );
}

export function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <View style={st.stat} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={st.statLabel}>{label}</Text>
      <Text style={st.statValue}>{value}</Text>
      {note ? <Text style={st.statNote}>{note}</Text> : null}
    </View>
  );
}

function TableToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const { t } = useTranslation();
  return (
    <Pressable accessibilityRole="button" onPress={onToggle} style={st.tableToggle}>
      <Text style={st.tableToggleText}>{open ? t("charts.hide_table") : t("charts.show_table")}</Text>
    </Pressable>
  );
}

function DataTable({ rows }: { rows: string[][] }) {
  return (
    <View style={st.table}>
      {rows.map((r, i) => (
        <View key={i} style={[st.tr, i % 2 === 1 && { backgroundColor: colors.bg }]}>
          {r.map((c, j) => <Text key={j} style={[st.td, j > 0 && { textAlign: "right", flex: 0, minWidth: 80 }]}>{c}</Text>)}
        </View>
      ))}
    </View>
  );
}

const st = StyleSheet.create({
  barRow: { flexDirection: "row", alignItems: "center", gap: space.sm, minHeight: 36 },
  barLabelBox: { width: "34%" },
  barLabel: { fontSize: type.small, color: colors.text, fontWeight: "600" },
  barSub: { fontSize: 12, color: colors.slate },
  track: { flex: 1, height: 20, backgroundColor: "#EFECE4", borderRadius: radius.sm, overflow: "hidden" },
  bar: { height: 20, backgroundColor: DATA_COLOR, borderTopEndRadius: 4, borderBottomEndRadius: 4 },
  suppressed: { flex: 1, borderWidth: 1, borderStyle: "dashed", borderColor: colors.slate, borderRadius: radius.sm },
  barValue: { minWidth: 64, textAlign: "right", fontSize: type.body, fontWeight: "700", color: colors.text, fontVariant: ["tabular-nums"] },
  stat: { flexBasis: 180, flexGrow: 1, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: space.lg, gap: 4 },
  statLabel: { fontSize: type.small, color: colors.slate, fontWeight: "600" },
  statValue: { fontSize: 34, color: colors.navy, fontWeight: "800", fontVariant: ["tabular-nums"] },
  statNote: { fontSize: 12, color: colors.slate },
  tableToggle: { minHeight: TOUCH, justifyContent: "center", alignSelf: "flex-start" },
  tableToggleText: { color: colors.info, fontWeight: "700", textDecorationLine: "underline", fontSize: type.small },
  table: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, overflow: "hidden" },
  tr: { flexDirection: "row", paddingHorizontal: space.md, paddingVertical: 8, backgroundColor: colors.surface },
  td: { flex: 1, fontSize: type.small, color: colors.text },
});
