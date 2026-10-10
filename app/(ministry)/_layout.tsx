import { Stack } from "expo-router";
import { RoleGate } from "../../components/RoleGate";
import { colors } from "../../lib/theme";

export default function Layout() {
  return (
    <RoleGate role="ministry_viewer">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </RoleGate>
  );
}
