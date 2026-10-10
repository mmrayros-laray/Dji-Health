import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "../../../../components/Input";
import { Screen } from "../../../../components/Screen";
import { SourceBadge } from "../../../../components/SourceBadge";
import { Badge, Body, Button, Card, Field, H2, H3, Icon, Notice, Row, Skeleton, Small } from "../../../../components/ui";
import { useAddEncounter, useClinicianRecord } from "../../../../lib/api";
import { formatDate } from "../../../../lib/format";
import { todayIso, useTerm } from "../../../../lib/hooks";
import { colors } from "../../../../lib/theme";
import { ageYears, gestationalAge } from "../../../../supabase/functions/_shared/clinical.ts";

export default function ClinicianPatient() {
  const { id, reason: initialReason } = useLocalSearchParams<{ id: string; reason?: string }>();
  const { t } = useTranslation();
  const [reasonDraft, setReasonDraft] = useState(initialReason ?? "");
  const [reason, setReason] = useState<string | null>(initialReason ?? null);
  const q = useClinicianRecord(id, reason);

  if (!reason) {
    return (
      <Screen title={t("clinician.reason_title")} back="/clinician">
        <Card>
          <Body>{t("clinician.reason_required")}</Body>
          <Field label={t("clinician.reason")}><Input value={reasonDraft} onChangeText={setReasonDraft} /></Field>
          <Button icon="eye-check-outline" label={t("clinician.view_record")} disabled={!reasonDraft.trim()} onPress={() => setReason(reasonDraft.trim())} />
        </Card>
      </Screen>
    );
  }

  return (
    <Screen title={q.data ? `${q.data.patient.given_name} ${q.data.patient.family_name}` : t("clinician.record")} back="/clinician" onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      <Notice tone="info" icon="clipboard-text-clock-outline">{t("clinician.logged_reason", { reason })}</Notice>
      {q.isLoading ? <Card><Skeleton lines={6} /></Card> : null}
      {q.isError ? <Notice tone="error" icon="lock-alert-outline" title={t("clinician.no_access")}>{q.error.message}</Notice> : null}
      {q.data ? <RecordView record={q.data} /> : null}
      {q.data ? <EncounterForm patientId={id} /> : null}
    </Screen>
  );
}

function RecordView({ record: r }: { record: NonNullable<ReturnType<typeof useClinicianRecord>["data"]> }) {
  const { t, i18n } = useTranslation();
  const term = useTerm();
  const lang = i18n.language;
  const preg = r.pregnancies.find((p) => p.status === "active");
  return (
    <>
      <Card>
        <Row>
          <Badge tone="neutral" label={t("vault.age", { count: ageYears(r.patient.birth_date, todayIso()) })} />
          <Badge tone="error" icon="water" label={`${t("vault.blood_group")} ${r.patient.blood_group}`} />
          {preg ? <Badge tone="gold" icon="human-pregnant" label={t("maternal.ga", { weeks: gestationalAge(preg.lmp_date, preg.edd_date, todayIso()).weeks, days: 0 })} /> : null}
        </Row>
      </Card>
      <Card accent={r.allergies.some((a) => a.criticality === "high") ? colors.error : undefined}>
        <H3>{t("sections.allergies")}</H3>
        {r.allergies.length ? r.allergies.map((a) => <Body key={a.id}>• {term(a.substance)} — {t(`criticality.${a.criticality}`)}{a.reaction ? ` (${a.reaction})` : ""}</Body>) : <Body muted>{t("vault.empty")}</Body>}
      </Card>
      <Card>
        <H3>{t("sections.conditions")}</H3>
        {r.conditions.map((c) => <Row key={c.id}><Body style={{ flex: 1 }}>• {term(c.display, c.code)} ({t(`status.${c.clinical_status}`)})</Body><SourceBadge source={c.source} /></Row>)}
        <H3>{t("sections.medications")}</H3>
        {r.medications.filter((m) => m.status === "active").map((m) => <Body key={m.id}>• {term(m.name)} — {m.dosage_text}</Body>)}
      </Card>
      {preg ? (
        <Card>
          <H3>{t("maternal.visits")}</H3>
          {preg.antenatal_visits.map((v) => <Body key={v.id}>{v.status === "done" ? "✓" : "○"} {t("maternal.visit_n", { n: v.visit_number })} · {formatDate(v.date, lang)} · {t("maternal.week_n", { n: v.gestational_weeks })}{v.bp ? ` · ${v.bp}` : ""}{v.weight_kg ? ` · ${v.weight_kg} kg` : ""}</Body>)}
        </Card>
      ) : null}
      <Card>
        <H3>{t("sections.encounters")}</H3>
        {r.encounters.slice(0, 6).map((e) => (
          <Row key={e.id}><Small style={{ flex: 1 }}>{formatDate(e.date, lang)} · {e.reason}{e.practitioner_name ? ` · ${e.practitioner_name}` : ""}</Small><SourceBadge source={e.source} /></Row>
        ))}
      </Card>
    </>
  );
}

function EncounterForm({ patientId }: { patientId: string }) {
  const { t } = useTranslation();
  const add = useAddEncounter(patientId);
  const [reason, setReason] = useState(t("clinician.reasons.antenatal"));
  const [notes, setNotes] = useState("");
  const [weight, setWeight] = useState("");
  const [bp, setBp] = useState("");
  const [done, setDone] = useState(false);
  const valid = reason.trim() && (!weight || /^\d{1,3}([.,]\d)?$/.test(weight)) && (!bp || /^\d{2,3}\/\d{2,3}$/.test(bp));

  const submit = () => {
    const observations = [
      ...(weight ? [{ type: "weight", value: weight.replace(",", "."), unit: "kg" }] : []),
      ...(bp ? [{ type: "blood_pressure", value_text: bp, unit: "mmHg" }] : []),
    ];
    add.mutate({ reason, notes, observations }, { onSuccess: () => { setDone(true); setNotes(""); setWeight(""); setBp(""); } });
  };

  return (
    <Card accent={colors.gold}>
      <Row><Icon name="note-plus-outline" /><H2 style={{ flex: 1 }}>{t("clinician.add_encounter")}</H2></Row>
      <Field label={t("fields.reason")}><Input value={reason} onChangeText={setReason} /></Field>
      <Row style={{ alignItems: "flex-start" }}>
        <Field label={`${t("obs.weight")} (kg)`}><Input value={weight} onChangeText={setWeight} keyboardType="decimal-pad" placeholder="62.4" style={{ minWidth: 120 }} /></Field>
        <Field label={`${t("obs.blood_pressure")} (mmHg)`}><Input value={bp} onChangeText={setBp} placeholder="110/70" style={{ minWidth: 120 }} /></Field>
      </Row>
      <Field label={t("fields.notes")}><Input value={notes} onChangeText={setNotes} multiline /></Field>
      <Button icon="content-save-outline" label={t("clinician.save_encounter")} onPress={submit} disabled={!valid} loading={add.isPending} />
      {done ? <Notice tone="success" icon="check-circle" title={t("clinician.saved")}>{t("clinician.saved_body")}</Notice> : null}
      {add.isError ? <Notice tone="error" icon="alert-circle-outline">{add.error.message}</Notice> : null}
    </Card>
  );
}
