import { Stack } from "expo-router";
import { RoleGate } from "../../components/RoleGate";
import { colors } from "../../lib/theme";

export default function ClinicianLayout() {
  return (
    <RoleGate role="clinician">
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </RoleGate>
  );
}
