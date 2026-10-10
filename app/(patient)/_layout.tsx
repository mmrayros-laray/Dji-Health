import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { RoleGate } from "../../components/RoleGate";
import { Icon, type IconName } from "../../components/ui";
import { colors } from "../../lib/theme";

function tab(icon: IconName) {
  function TabIcon({ color }: { color: string }) {
    return <Icon name={icon} size={26} color={color} />;
  }
  return TabIcon;
}

export default function PatientLayout() {
  const { t } = useTranslation();
  return (
    <RoleGate role="patient">
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: colors.navy,
          tabBarInactiveTintColor: colors.slate,
          tabBarLabelStyle: { fontSize: 13, fontWeight: "700" },
          tabBarStyle: { minHeight: 64, paddingTop: 6, borderTopColor: colors.border, backgroundColor: colors.surface },
          sceneStyle: { backgroundColor: colors.bg },
        }}
      >
        <Tabs.Screen name="vault" options={{ title: t("tabs.vault"), tabBarIcon: tab("folder-heart-outline") }} />
        <Tabs.Screen name="emergency-card" options={{ title: t("tabs.emergency"), tabBarIcon: tab("card-account-details-star-outline") }} />
        <Tabs.Screen name="maternal" options={{ title: t("tabs.maternal"), tabBarIcon: tab("mother-heart") }} />
        <Tabs.Screen name="assistant" options={{ title: t("tabs.assistant"), tabBarIcon: tab("robot-outline") }} />
        <Tabs.Screen name="share" options={{ title: t("tabs.share"), tabBarIcon: tab("account-key-outline") }} />
        <Tabs.Screen name="children" options={{ href: null }} />
        <Tabs.Screen name="summary" options={{ href: null }} />
      </Tabs>
    </RoleGate>
  );
}
