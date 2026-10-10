import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DemoBanner } from "../components/DemoBanner";
import { Notice } from "../components/ui";
import { AuthProvider } from "../lib/auth";
import { isConfigured } from "../lib/config";
import { isRTL, restoreLanguage } from "../lib/i18n";
import { OFFLINE_MAX_AGE, persister, queryClient, shouldPersist } from "../lib/queryClient";
import { colors } from "../lib/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: OFFLINE_MAX_AGE,
          dehydrateOptions: { shouldDehydrateQuery: (q) => q.state.status === "success" && shouldPersist(q.queryKey) },
        }}
      >
        <AuthProvider>
          <Shell />
        </AuthProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { t, i18n } = useTranslation();
  useEffect(() => {
    restoreLanguage();
  }, []);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, direction: isRTL(i18n.language) ? "rtl" : "ltr" }}>
      <StatusBar style="dark" />
      <DemoBanner />
      {!isConfigured ? (
        <View style={{ padding: 16 }}>
          <Notice tone="warning" icon="cog-outline" title={t("setup.title")}>{t("setup.body")}</Notice>
        </View>
      ) : null}
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </View>
  );
}
