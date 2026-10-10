import { useTranslation } from "react-i18next";
import { Badge } from "./ui";

/** "déclaré par le patient" vs "saisi par un professionnel" (BUILD_PLAN M2/M5). */
export function SourceBadge({ source }: { source: "patient" | "professional" }) {
  const { t } = useTranslation();
  return source === "professional"
    ? <Badge tone="info" icon="stethoscope" label={t("source.professional")} />
    : <Badge tone="neutral" icon="account-edit-outline" label={t("source.patient")} />;
}
