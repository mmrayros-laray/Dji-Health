import { CameraView, useCameraPermissions } from "expo-camera";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { radius } from "../lib/theme";
import { Body, Button } from "./ui";

/** Scans the patient's consent QR (expo-camera). */
export function CodeScanner({ onCode, onClose }: { onCode: (data: string) => void; onClose: () => void }) {
  const { t } = useTranslation();
  const [perm, request] = useCameraPermissions();
  if (!perm) return null;
  if (!perm.granted) {
    return (
      <View style={{ gap: 8 }}>
        <Body>{t("clinician.camera_permission")}</Body>
        <Button icon="camera" label={t("clinician.allow_camera")} onPress={request} />
        <Button variant="ghost" label={t("common.cancel")} onPress={onClose} />
      </View>
    );
  }
  return (
    <View style={{ gap: 8 }}>
      <View style={{ height: 280, borderRadius: radius.lg, overflow: "hidden" }}>
        <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => onCode(data)} />
      </View>
      <Button variant="ghost" label={t("common.cancel")} onPress={onClose} />
    </View>
  );
}
