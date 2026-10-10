// Admin-only: AI drafts rejected by the validator (never shown to patients). RLS restricts the table to admins.
import { useTranslation } from "react-i18next";
import { Screen } from "../../components/Screen";
import { SignOutButton } from "../../components/SignOutButton";
import { Badge, Body, Card, Notice, Row, Skeleton, Small } from "../../components/ui";
import { useRejections } from "../../lib/api";
import { formatDateTime } from "../../lib/format";

export default function Rejections() {
  const { t, i18n } = useTranslation();
  const q = useRejections();
  return (
    <Screen wide title={t("admin.title")} subtitle={t("admin.subtitle")} right={<SignOutButton />} onRefresh={() => q.refetch()} refreshing={q.isFetching}>
      <Notice tone="info" icon="shield-check-outline">{t("admin.explain")}</Notice>
      {q.isLoading ? <Card><Skeleton lines={6} /></Card> : null}
      {q.isError ? <Notice tone="error" icon="alert-circle-outline">{q.error.message}</Notice> : null}
      {q.data?.length === 0 ? <Body muted>{t("admin.empty")}</Body> : null}
      {q.data?.map((r) => (
        <Card key={r.id}>
          <Row>
            <Badge tone="error" icon="close-octagon-outline" label={r.reason.split(":").slice(0, 2).join(":")} />
            <Badge tone="neutral" label={r.function_name} />
            {r.language ? <Badge tone="neutral" label={r.language} /> : null}
            <Small muted>{formatDateTime(r.created_at, i18n.language)}</Small>
          </Row>
          <Small muted>{t("admin.draft")}</Small>
          <Body style={{ fontFamily: "monospace", fontSize: 14 }}>{r.draft}</Body>
        </Card>
      ))}
    </Screen>
  );
}
