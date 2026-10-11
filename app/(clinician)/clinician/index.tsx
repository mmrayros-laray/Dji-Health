import { router } from "expo-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeScanner } from "../../../components/CodeScanner";
import { Input } from "../../../components/Input";
import { Screen } from "../../../components/Screen";
import { SignOutButton } from "../../../components/SignOutButton";
import { Body, Button, Card, Field, H2, Icon, Notice, Row, Skeleton, Small } from "../../../components/ui";
import { useClaimConsent, useClinicianPatients } from "../../../lib/api";
import { CONSENT_QR_PREFIX, DEMO_MODE } from "../../../lib/config";
import { formatDateTime } from "../../../lib/format";
import { todayIso } from "../../../lib/hooks";
import { colors } from "../../../lib/theme";
import { ageYears } from "../../../supabase/functions/_shared/clinical.ts";

const REASONS = ["consultation", "antenatal", "followup", "emergency"] as const;

export default function ClinicianHome() {
  const { t, i18n } = useTranslation();
  const patients = useClinicianPatients();
  const claim = useClaimConsent();
  const [code, setCode] = useState("");
  const [reason, setReason] = useState<string>(t("clinician.reasons.antenatal"));
  const [scanning, setScanning] = useState(false);

  const submit = (c = code) => claim.mutate({ code: c, reason }, {
    onSuccess: (res) => router.push(`/clinician/patient/${res.patient_id}?reason=${encodeURIComponent(reason)}`),
  });

  return (
    <Screen title={t("clinician.title")} subtitle={t("clinician.subtitle")} right={<SignOutButton />} onRefresh={() => patients.refetch()} refreshing={patients.isFetching}>
      <Card accent={colors.gold}>
        <Row><Icon name="key-outline" /><H2 style={{ flex: 1 }}>{t("clinician.enter_code")}</H2></Row>
        <Body muted>{t("clinician.enter_code_hint")}</Body>
        <Field label={t("clinician.code")}>
          <Input value={code} onChangeText={(v) => setCode(v.toUpperCase())} autoCapitalize="characters" autoCorrect={false} placeholder="ABCD-EFGH" maxLength={9}
            style={{ fontSize: 26, letterSpacing: 4, fontWeight: "800" }} />
        </Field>
        <Field label={t("clinician.reason")} hint={t("clinician.reason_hint")}>
          <Row>{REASONS.map((r) => {
            const label = t(`clinician.reasons.${r}`);
            return <Button key={r} variant={reason === label ? "primary" : "secondary"} label={label} onPress={() => setReason(label)} />;
          })}</Row>
          <Input value={reason} onChangeText={setReason} />
        </Field>
        <Row>
          <Button icon="lock-open-check-outline" label={t("clinician.open_record")} onPress={() => submit()} disabled={code.replace(/\W/g, "").length < 8 || !reason.trim()} loading={claim.isPending} />
          {!DEMO_MODE ? <Button variant="secondary" icon="qrcode-scan" label={t("clinician.scan")} onPress={() => setScanning(true)} /> : null}
        </Row>
        {scanning ? (
          <CodeScanner onClose={() => setScanning(false)} onCode={(data) => {
            if (!data.startsWith(CONSENT_QR_PREFIX)) return;
            const c = data.slice(CONSENT_QR_PREFIX.length);
            setScanning(false);
            setCode(c);
            if (reason.trim()) submit(c);
          }} />
        ) : null}
        {claim.isError ? <Notice tone="error" icon="alert-circle-outline" title={t("clinician.code_error")}>{claim.error.message}</Notice> : null}
      </Card>

      <Card>
        <H2>{t("clinician.my_patients")}</H2>
        <Small muted>{t("clinician.my_patients_hint")}</Small>
        {patients.isLoading ? <Skeleton /> : null}
        {patients.data?.length === 0 ? <Body muted>{t("clinician.no_patients")}</Body> : null}
        {patients.data?.map((p) => (
          <Button key={p.consent_id} variant="secondary" icon="account-heart-outline" style={{ justifyContent: "flex-start" }}
            label={`${p.given_name} ${p.family_name} · ${t("vault.age", { count: ageYears(p.birth_date, todayIso()) })} · ${t("share.expires_at", { date: formatDateTime(p.expires_at, i18n.language) })}`}
            onPress={() => router.push(`/clinician/patient/${p.patient_id}`)} />
        ))}
      </Card>
      <Notice tone="info" icon="shield-lock-outline">{t("clinician.rls_note")}</Notice>
    </Screen>
  );
}
