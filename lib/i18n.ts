// i18next setup — CLAUDE.md §6. Adding a language (Afar, Amharic, Oromo, Tigrinya) = add locales/<code>.json
// and one line in LANGUAGES below.
import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager, Platform } from "react-native";
import ar from "../locales/ar.json";
import en from "../locales/en.json";
import fr from "../locales/fr.json";
import so from "../locales/so.json";

export type Lang = "fr" | "so" | "ar" | "en";

export const LANGUAGES: { code: Lang; label: string; rtl: boolean; locale: string }[] = [
  { code: "fr", label: "Français", rtl: false, locale: "fr-DJ" },
  { code: "so", label: "Soomaali", rtl: false, locale: "so-DJ" },
  { code: "ar", label: "العربية", rtl: true, locale: "ar-DJ" },
  { code: "en", label: "English", rtl: false, locale: "en-GB" },
];

const resources = { fr, so, ar, en } as const;
const STORAGE_KEY = "djh.lang";

export function isRTL(lang: string): boolean {
  return LANGUAGES.find((l) => l.code === lang)?.rtl ?? false;
}

/** true if this language's strings have not all been reviewed by a native speaker. */
export function isMachineTranslated(lang: string): boolean {
  const meta = (resources as Record<string, { _meta?: { _review?: string } }>)[lang]?._meta;
  return meta?._review === "machine";
}

export function localeFor(lang: string): string {
  return LANGUAGES.find((l) => l.code === lang)?.locale ?? "fr-DJ";
}

function applyDirection(lang: string) {
  const rtl = isRTL(lang);
  if (Platform.OS === "web" && typeof document !== "undefined") {
    document.documentElement.dir = rtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  } else {
    // Native: the root view also sets style.direction so the switch is immediate;
    // forceRTL makes it stick after a restart.
    I18nManager.allowRTL(true);
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
  }
}

export async function setLanguage(lang: Lang) {
  await i18n.changeLanguage(lang);
  applyDirection(lang);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* storage unavailable (private mode) — language still switches for this session */
  }
}

i18n.use(initReactI18next).init({
  resources: Object.fromEntries(Object.entries(resources).map(([k, v]) => [k, { translation: v }])),
  lng: "fr",
  fallbackLng: "fr",
  interpolation: { escapeValue: false },
  returnNull: false,
});
applyDirection("fr");

export async function restoreLanguage() {
  try {
    const saved = (await AsyncStorage.getItem(STORAGE_KEY)) as Lang | null;
    if (saved && saved in resources && saved !== i18n.language) await setLanguage(saved);
  } catch {
    /* ignore */
  }
}

export default i18n;
