import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Linking, Platform } from "react-native";
import { Input } from "../../../components/Input";
import { Screen } from "../../../components/Screen";
import { SourceBadge } from "../../../components/SourceBadge";
import { Body, Button, Card, Field, H3, Notice, Row, Skeleton, Small } from "../../../components/ui";
import { documentUrl, useDeleteItem, useRecord, useUploadDocument } from "../../../lib/api";
import { formatDate } from "../../../lib/format";
import { isOffline } from "../../../lib/hooks";
import { colors } from "../../../lib/theme";

const KINDS = ["lab_result", "prescription", "imaging", "report", "other"] as const;

export default function Documents() {
  const { t, i18n } = useTranslation();
  const q = useRecord();
  const r = q.data;
  const upload = useUploadDocument(r?.patient.id ?? "");
  const del = useDeleteItem();
  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<(typeof KINDS)[number]>("lab_result");
  const [openError, setOpenError] = useState<string | null>(null);

  const pick = async () => {
    const res = await DocumentPicker.getDocumentAsync({ type: ["application/pdf", "image/*"], copyToCacheDirectory: true, multiple: false });
    if (!res.canceled && res.assets[0]) {
      setPicked(res.assets[0]);
      setTitle(res.assets[0].name.replace(/\.[^.]+$/, ""));
    }
  };
  const send = () => {
    if (!picked) return;
    upload.mutate(
      { uri: picked.uri, name: picked.name, mimeType: picked.mimeType ?? "application/octet-stream", size: picked.size, title: title || picked.name, kind, webFile: picked.file },
      { onSuccess: () => { setPicked(null); setTitle(""); } },
    );
  };
  const open = async (path: string) => {
    setOpenError(null);
    try {
      const url = await documentUrl(path);
      if (Platform.OS === "web") window.open(url, "_blank", "noopener");
      else await Linking.openURL(url);
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Screen title={t("sections.documents")} back="/vault" offline={isOffline(q)}>
      {!r ? <Card><Skeleton /></Card> : (
        <>
          {!isOffline(q) ? (
            <Card accent={colors.gold}>
              <H3>{t("documents.upload_title")}</H3>
              <Small muted>{t("documents.upload_hint")}</Small>
              <Button variant="secondary" icon="paperclip" label={picked ? picked.name : t("documents.choose_file")} onPress={pick} />
              {picked ? (
                <>
                  <Field label={t("documents.doc_title")}><Input value={title} onChangeText={setTitle} /></Field>
                  <Field label={t("documents.kind")}>
                    <Row>{KINDS.map((k) => <Button key={k} variant={kind === k ? "primary" : "secondary"} label={t(`documents.kinds.${k}`)} onPress={() => setKind(k)} />)}</Row>
                  </Field>
                  <Button icon="cloud-upload-outline" label={t("documents.upload")} onPress={send} loading={upload.isPending} />
                </>
              ) : null}
              {upload.isError ? <Notice tone="error" icon="alert-circle-outline">{upload.error.message}</Notice> : null}
            </Card>
          ) : null}
          {openError ? <Notice tone="error" icon="alert-circle-outline">{openError}</Notice> : null}
          {r.documents.length === 0 ? <Body muted>{t("documents.empty")}</Body> : r.documents.map((d) => (
            <Card key={d.id}>
              <H3>{d.title}</H3>
              <Small muted>{t(`documents.kinds.${d.kind}`)} · {formatDate(d.created_at, i18n.language)}</Small>
              <SourceBadge source={d.source} />
              <Row>
                <Button variant="secondary" icon="open-in-new" label={t("documents.open")} onPress={() => open(d.storage_path)} />
                {d.source === "patient" ? <Button variant="danger" icon="trash-can-outline" label={t("common.delete")} onPress={() => del.mutate({ section: "documents", id: d.id })} /> : null}
              </Row>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}
