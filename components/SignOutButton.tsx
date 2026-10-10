import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "../lib/auth";
import { Button } from "./ui";

export function SignOutButton() {
  const { t } = useTranslation();
  const { signOut } = useAuth();
  return <Button variant="ghost" icon="logout" label={t("common.sign_out")} onPress={async () => { await signOut(); router.replace("/"); }} />;
}
