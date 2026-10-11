import * as Print from "expo-print";
import { router } from "expo-router";
import QRCodeLib from "qrcode";
import { useTranslation } from "react-i18next";
import { Platform, StyleSheet, Text, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { Screen } from "../../components/Screen";
import { Badge, Body, Button, Card, H2, Icon, Notice, Row, Skeleton, Small } from "../../components/ui";
import { useAccessHistory, useCreateEmergencyCard, useEmergencyCard, useRecord, useRevokeEmergencyCard } from "../../lib/api";
import { appUrl, DEMO_MODE } from "../../lib/config";
import { formatDate, formatDateTime } from "../../lib/format";
import { colors, fonts, radius, space } from "../../lib/theme";

export default function EmergencyCard() {
  const { t, i18n } = useTranslation();
  const rec = useRecord();
  const pid = rec.data?.patient.id;
  const cardQ = useEmergencyCard(pid);
  const create = useCreateEmergencyCard(pid ?? "");
  const revoke = useRevokeEmergencyCard(pid ?? "");
  const access = useAccessHistory();
  const card = cardQ.data?.card ?? null;
  const url = card ? `${appUrl()}/emergency/${card.token}` : null;
  const scans = (access.data ?? []).filter((a) => a.action === "emergency_access" || a.action === "emergency_access_denied");
  const p = rec.data?.patient;

  const print = async () => {
    if (!url || !p) return;
    const svg = await QRCodeLib.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
    const html = printableCard({ name: `${p.given_name} ${p.family_name}`, blood: p.blood_group, svg, title: t("emergency.card_title"),
      scan: t("emergency.scan_me"), demo: t("demo.banner"), bloodLabel: t("vault.blood_group"), expires: t("emergency.expires", { date: formatDate(card!.expires_at, i18n.language) }) });
    if (Platform.OS === "web") {
      const w = window.open("", "_blank", "noopener=no,width=520,height=420");
      if (w) { w.document.write(html); w.document.close(); w.focus(); w.print(); }
    } else {
      await Print.printAsync({ html });
    }
  };

  return (
    <Screen title={t("emergency.title")} subtitle={t("emergency.subtitle")}>
      {!p || cardQ.isLoading ? <Card><Skeleton lines={5} /></Card> : (
        <>
          {card && url ? (
            <View style={st.wallet} accessible accessibilityLabel={t("emergency.card_a11y", { name: p.given_name, blood: p.blood_group })}>
              <View style={st.walletTop}>
                <View style={{ flex: 1 }}>
                  <Text style={st.walletBrand}>DjiHealth</Text>
                  <Text style={st.walletTitle}>{t("emergency.card_title")}</Text>
                </View>
                <Icon name="medical-bag" size={30} color={colors.gold} />
              </View>
              <View style={st.walletBody}>
                <View style={st.qrBox}>
                  <QRCode value={url} size={150} ecl="M" backgroundColor="#FFFFFF" color={colors.navy} />
                </View>
                <View style={{ flex: 1, gap: 6, minWidth: 140 }}>
                  <Text style={st.walletName}>{p.given_name} {p.family_name}</Text>
                  <Text style={st.walletLabel}>{t("vault.blood_group")}</Text>
                  <Text style={st.walletBlood}>{p.blood_group === "unknown" ? "?" : p.blood_group}</Text>
                  <Text style={st.walletSmall}>{t("emergency.scan_me")}</Text>
                </View>
              </View>
              <Text style={st.walletFoot}>{t("demo.banner")} · {t("emergency.expires", { date: formatDate(card.expires_at, i18n.language) })}</Text>
            </View>
          ) : (
            <Card>
              {cardQ.data?.hasActiveElsewhere ? <Notice tone="info" icon="cellphone-information">{t("emergency.active_elsewhere")}</Notice> : null}
              <Body>{t("emergency.none")}</Body>
            </Card>
          )}

          <Row>
            <Button icon={card ? "refresh" : "qrcode-plus"} label={card ? t("emergency.regenerate") : t("emergency.generate")} onPress={() => create.mutate()} loading={create.isPending} />
            {card && !DEMO_MODE ? <Button variant="secondary" icon="printer-outline" label={t("emergency.print")} onPress={print} /> : null}
            {card ? <Button variant="secondary" icon="eye-outline" label={t("emergency.preview")} onPress={() => router.push(`/emergency/${card.token}`)} /> : null}
            {card || cardQ.data?.hasActiveElsewhere ? <Button variant="danger" icon="card-remove-outline" label={t("emergency.revoke")} onPress={() => revoke.mutate()} loading={revoke.isPending} /> : null}
          </Row>
          {card && DEMO_MODE ? <Notice tone="info" icon="information-outline">{t("preview.qr_note")}</Notice> : null}
          {create.isError ? <Notice tone="error" icon="alert-circle-outline">{create.error.message}</Notice> : null}

          <Card>
            <Row><Icon name="shield-lock-outline" /><H2 style={{ flex: 1 }}>{t("emergency.privacy_title")}</H2></Row>
            <Body>{t("emergency.privacy_body")}</Body>
            <Small muted>{t("emergency.shows")}</Small>
            <Row>
              {(["first_name", "age", "blood_group", "allergies", "conditions", "medications", "contact"] as const).map((k) => (
                <Badge key={k} tone="neutral" label={t(`emergency.fields.${k}`)} />
              ))}
            </Row>
          </Card>

          <Card>
            <Row><Icon name="history" /><H2 style={{ flex: 1 }}>{t("emergency.scan_history")}</H2></Row>
            {scans.length === 0 ? <Body muted>{t("emergency.no_scans")}</Body> : scans.slice(0, 10).map((s) => (
              <Row key={s.id}>
                <Icon name={s.action === "emergency_access" ? "qrcode-scan" : "cancel"} color={colors.error} size={20} />
                <Body style={{ flex: 1 }}>{s.action === "emergency_access" ? t("access.emergency_scanned") : t("access.actions.emergency_access_denied")}</Body>
                <Small muted>{formatDateTime(s.created_at, i18n.language)}</Small>
              </Row>
            ))}
          </Card>
        </>
      )}
    </Screen>
  );
}

function esc(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
}

function printableCard(v: { name: string; blood: string; svg: string; title: string; scan: string; demo: string; bloodLabel: string; expires: string }) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(v.title)}</title><style>
  @page { size: 85.6mm 54mm; margin: 0 }
  body { margin: 0; font-family: Georgia, serif; }
  .card { width: 85.6mm; height: 54mm; box-sizing: border-box; padding: 3mm 4mm; background: #0B1F3A; color: #fff; border-radius: 3mm; display: flex; flex-direction: column; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .top { display: flex; justify-content: space-between; color: #C9A227; font-weight: bold; font-size: 9pt; }
  .main { display: flex; gap: 4mm; align-items: center; flex: 1; }
  .qr { background: #fff; padding: 1.5mm; border-radius: 1.5mm; width: 30mm; height: 30mm; }
  .qr svg { width: 100%; height: 100%; }
  .name { font-size: 12pt; font-weight: bold; }
  .label { font-size: 7pt; color: #F3E8C2; margin-top: 2mm; }
  .blood { font-size: 20pt; font-weight: bold; color: #C9A227; }
  .foot { font-size: 6pt; color: #F3E8C2; font-family: sans-serif; }
  </style></head><body><div class="card">
  <div class="top"><span>DjiHealth</span><span>${esc(v.title)}</span></div>
  <div class="main"><div class="qr">${v.svg}</div><div><div class="name">${esc(v.name)}</div>
  <div class="label">${esc(v.bloodLabel)}</div><div class="blood">${esc(v.blood)}</div><div class="label">${esc(v.scan)}</div></div></div>
  <div class="foot">${esc(v.demo)} · ${esc(v.expires)}</div></div></body></html>`;
}

const st = StyleSheet.create({
  wallet: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: space.lg, gap: space.md, maxWidth: 520, width: "100%", alignSelf: "center", borderWidth: 2, borderColor: colors.gold },
  walletTop: { flexDirection: "row", alignItems: "center" },
  walletBrand: { color: colors.gold, fontFamily: fonts.heading, fontSize: 22, fontWeight: "700" },
  walletTitle: { color: colors.goldSoft, fontSize: 16, fontWeight: "700" },
  walletBody: { flexDirection: "row", gap: space.lg, alignItems: "center", flexWrap: "wrap" },
  qrBox: { backgroundColor: colors.white, padding: 10, borderRadius: radius.md },
  walletName: { color: colors.white, fontSize: 22, fontWeight: "700", fontFamily: fonts.heading },
  walletLabel: { color: colors.goldSoft, fontSize: 14 },
  walletBlood: { color: colors.gold, fontSize: 40, fontWeight: "800" },
  walletSmall: { color: colors.goldSoft, fontSize: 14 },
  walletFoot: { color: colors.goldSoft, fontSize: 12 },
});
