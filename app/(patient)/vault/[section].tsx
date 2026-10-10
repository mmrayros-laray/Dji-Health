import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Input } from "../../../components/Input";
import { Screen } from "../../../components/Screen";
import { SourceBadge } from "../../../components/SourceBadge";
import { Badge, Body, Button, Card, Field, H3, Notice, Row, Skeleton, Small } from "../../../components/ui";
import { useDeleteItem, useRecord, useSaveItem, type EditableSection, type PatientRecord } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { isOffline, useTerm } from "../../../lib/hooks";
import { colors, radius, space, TOUCH } from "../../../lib/theme";

type Section = EditableSection | "encounters";
const SECTIONS: Section[] = ["conditions", "allergies", "medications", "immunizations", "encounters"];

type Values = Record<string, string>;
const EMPTY: Record<EditableSection, Values> = {
  conditions: { display: "", onset_date: "", clinical_status: "active" },
  allergies: { substance: "", reaction: "", criticality: "low" },
  medications: { name: "", dosage_text: "", status: "active" },
  immunizations: { vaccine_name: "", date_given: "", dose_number: "" },
};

export default function SectionScreen() {
  const { section: raw, focus, patient } = useLocalSearchParams<{ section: string; focus?: string; patient?: string }>();
  const section = (SECTIONS.includes(raw as Section) ? raw : "conditions") as Section;
  const { t } = useTranslation();
  const q = useRecord(patient);
  const r = q.data;
  const [editing, setEditing] = useState<{ id?: string; values: Values } | null>(null);

  return (
    <Screen title={t(`sections.${section}`)} back="/vault" offline={isOffline(q)} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      {!r ? <Card><Skeleton lines={5} /></Card> : (
        <>
          {section !== "encounters" && !isOffline(q) ? (
            editing ? (
              <ItemForm section={section} patientId={r.patient.id} initial={editing} onDone={() => setEditing(null)} />
            ) : (
              <Button icon="plus" label={t("vault.add_item")} onPress={() => setEditing({ values: { ...EMPTY[section] } })} />
            )
          ) : null}
          <ItemList section={section} record={r} focus={focus} onEdit={(id, values) => setEditing({ id, values })} />
        </>
      )}
    </Screen>
  );
}

function ItemList({ section, record, focus, onEdit }: { section: Section; record: PatientRecord; focus?: string; onEdit: (id: string, v: Values) => void }) {
  const { t, i18n } = useTranslation();
  const term = useTerm();
  const del = useDeleteItem();
  const lang = i18n.language;
  const highlight = (id: string) => (id === focus ? { borderColor: colors.gold, borderWidth: 3 } : null);
  const actions = (id: string, source: string, values: Values) =>
    source === "patient" ? (
      <Row>
        <Button variant="secondary" icon="pencil-outline" label={t("common.edit")} onPress={() => onEdit(id, values)} />
        <Button variant="danger" icon="trash-can-outline" label={t("common.delete")} loading={del.isPending && del.variables?.id === id}
          onPress={() => del.mutate({ section: section as EditableSection, id })} />
      </Row>
    ) : null;

  const empty = <Body muted>{t("vault.empty")}</Body>;

  switch (section) {
    case "conditions":
      return record.conditions.length ? (
        <>{record.conditions.map((c) => (
          <Card key={c.id} style={highlight(c.id)} accent={c.is_critical ? colors.error : undefined}>
            <H3>{term(c.display, c.code)}</H3>
            <Row>
              <Badge tone={c.clinical_status === "active" ? "warning" : "neutral"} label={t(`status.${c.clinical_status}`)} />
              {c.is_critical ? <Badge tone="error" icon="alert" label={t("vault.critical")} /> : null}
              <SourceBadge source={c.source} />
            </Row>
            {c.onset_date ? <Small muted>{t("vault.since", { date: formatDate(c.onset_date, lang) })}</Small> : null}
            {c.code ? <Small muted>CIM-10 : {c.code}</Small> : null}
            {actions(c.id, c.source, { display: c.display, onset_date: c.onset_date ?? "", clinical_status: c.clinical_status })}
          </Card>
        ))}</>
      ) : empty;
    case "allergies":
      return record.allergies.length ? (
        <>{record.allergies.map((a) => (
          <Card key={a.id} style={highlight(a.id)} accent={a.criticality === "high" ? colors.error : undefined}>
            <H3>{term(a.substance)}</H3>
            <Row>
              <Badge tone={a.criticality === "high" ? "error" : "neutral"} icon={a.criticality === "high" ? "alert-octagon" : undefined} label={t(`criticality.${a.criticality}`)} />
              <SourceBadge source={a.source} />
            </Row>
            {a.reaction ? <Body>{t("vault.reaction")}: {a.reaction}</Body> : null}
            {actions(a.id, a.source, { substance: a.substance, reaction: a.reaction ?? "", criticality: a.criticality })}
          </Card>
        ))}</>
      ) : empty;
    case "medications":
      return record.medications.length ? (
        <>{record.medications.map((m) => (
          <Card key={m.id} style={highlight(m.id)}>
            <H3>{term(m.name)}</H3>
            {m.dosage_text ? <Body>{m.dosage_text}</Body> : null}
            <Row>
              <Badge tone={m.status === "active" ? "success" : "neutral"} label={t(`status.${m.status}`)} />
              <SourceBadge source={m.source} />
            </Row>
            {m.start_date ? <Small muted>{t("vault.since", { date: formatDate(m.start_date, lang) })}</Small> : null}
            {actions(m.id, m.source, { name: m.name, dosage_text: m.dosage_text ?? "", status: m.status })}
          </Card>
        ))}</>
      ) : empty;
    case "immunizations":
      return record.immunizations.length ? (
        <>{record.immunizations.map((i) => (
          <Card key={i.id} style={highlight(i.id)}>
            <H3>{term(i.vaccine_name, i.vaccine_code)}{i.dose_number ? ` — ${t("vault.dose", { n: i.dose_number })}` : ""}</H3>
            <Body>{formatDate(i.date_given, lang)}{i.facility ? ` · ${i.facility}` : ""}</Body>
            <SourceBadge source={i.source} />
            {actions(i.id, i.source, { vaccine_name: i.vaccine_name, date_given: i.date_given, dose_number: String(i.dose_number ?? "") })}
          </Card>
        ))}</>
      ) : empty;
    case "encounters":
      return record.encounters.length ? (
        <>{record.encounters.map((e) => {
          const obs = record.observations.filter((o) => o.encounter_id === e.id);
          return (
            <Card key={e.id} style={highlight(e.id)}>
              <Small muted>{formatDate(e.date, lang)}</Small>
              <H3>{e.reason}</H3>
              <Body>{e.facility}{e.practitioner_name ? ` · ${e.practitioner_name}` : ""}</Body>
              {e.notes ? <Body muted>{e.notes}</Body> : null}
              {obs.length ? (
                <Row>{obs.map((o) => <Badge key={o.id} tone="info" label={`${t(`obs.${o.type}`)}: ${o.value ?? o.value_text} ${o.unit ?? ""}`} />)}</Row>
              ) : null}
              <SourceBadge source={e.source} />
            </Card>
          );
        })}</>
      ) : empty;
  }
}

function Choice({ value, options, onChange, labelFor }: { value: string; options: string[]; onChange: (v: string) => void; labelFor: (v: string) => string }) {
  return (
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {options.map((o) => (
        <Pressable key={o} accessibilityRole="radio" accessibilityState={{ selected: value === o }} onPress={() => onChange(o)}
          style={[st.chip, value === o && st.chipOn]}>
          <Text style={[st.chipText, value === o && { color: colors.white }]}>{labelFor(o)}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function ItemForm({ section, patientId, initial, onDone }: { section: EditableSection; patientId: string; initial: { id?: string; values: Values }; onDone: () => void }) {
  const { t } = useTranslation();
  const save = useSaveItem(patientId);
  const [v, setV] = useState<Values>(initial.values);
  const set = (k: string) => (text: string) => setV((p) => ({ ...p, [k]: text }));
  const dateOk = (d: string) => !d || /^\d{4}-\d{2}-\d{2}$/.test(d);

  const fields: Record<EditableSection, { main: string; required: string[] }> = {
    conditions: { main: "display", required: ["display"] },
    allergies: { main: "substance", required: ["substance"] },
    medications: { main: "name", required: ["name"] },
    immunizations: { main: "vaccine_name", required: ["vaccine_name", "date_given"] },
  };
  const valid = fields[section].required.every((k) => v[k]?.trim()) && dateOk(v.onset_date ?? "") && dateOk(v.date_given ?? "");

  const submit = () => {
    const values: Record<string, unknown> = { ...v };
    for (const k of Object.keys(values)) if (values[k] === "") values[k] = null;
    if (section === "immunizations") {
      values.vaccine_code = "AUTRE";
      values.dose_number = v.dose_number ? Number(v.dose_number) : null;
    }
    save.mutate({ section, id: initial.id, values }, { onSuccess: onDone });
  };

  return (
    <Card accent={colors.gold}>
      <H3>{initial.id ? t("vault.edit_item") : t("vault.add_item")}</H3>
      <Notice tone="info" icon="account-edit-outline">{t("vault.patient_reported_note")}</Notice>
      {section === "conditions" ? (
        <>
          <Field label={t("fields.condition")}><Input value={v.display} onChangeText={set("display")} /></Field>
          <Field label={t("fields.onset_date")} hint={t("fields.date_hint")}><Input value={v.onset_date} onChangeText={set("onset_date")} placeholder="2026-01-31" /></Field>
          <Field label={t("fields.status")}><Choice value={v.clinical_status} options={["active", "resolved"]} onChange={set("clinical_status")} labelFor={(o) => t(`status.${o}`)} /></Field>
        </>
      ) : section === "allergies" ? (
        <>
          <Field label={t("fields.substance")}><Input value={v.substance} onChangeText={set("substance")} /></Field>
          <Field label={t("fields.reaction")}><Input value={v.reaction} onChangeText={set("reaction")} /></Field>
          <Field label={t("fields.criticality")}><Choice value={v.criticality} options={["low", "high"]} onChange={set("criticality")} labelFor={(o) => t(`criticality.${o}`)} /></Field>
        </>
      ) : section === "medications" ? (
        <>
          <Field label={t("fields.medication")}><Input value={v.name} onChangeText={set("name")} /></Field>
          <Field label={t("fields.dosage")}><Input value={v.dosage_text} onChangeText={set("dosage_text")} /></Field>
          <Field label={t("fields.status")}><Choice value={v.status} options={["active", "stopped"]} onChange={set("status")} labelFor={(o) => t(`status.${o}`)} /></Field>
        </>
      ) : (
        <>
          <Field label={t("fields.vaccine")}><Input value={v.vaccine_name} onChangeText={set("vaccine_name")} /></Field>
          <Field label={t("fields.date_given")} hint={t("fields.date_hint")}><Input value={v.date_given} onChangeText={set("date_given")} placeholder="2026-01-31" /></Field>
          <Field label={t("fields.dose_number")}><Input value={v.dose_number} onChangeText={set("dose_number")} keyboardType="number-pad" /></Field>
        </>
      )}
      {save.isError ? <Notice tone="error" icon="alert-circle-outline">{save.error.message}</Notice> : null}
      <Row>
        <Button icon="content-save-outline" label={t("common.save")} onPress={submit} disabled={!valid} loading={save.isPending} />
        <Button variant="ghost" label={t("common.cancel")} onPress={onDone} />
      </Row>
    </Card>
  );
}

const st = StyleSheet.create({
  chip: { minHeight: TOUCH, paddingHorizontal: space.lg, borderRadius: radius.pill, borderWidth: 2, borderColor: colors.navy, justifyContent: "center" },
  chipOn: { backgroundColor: colors.navy },
  chipText: { color: colors.navy, fontWeight: "700", fontSize: 16 },
});
