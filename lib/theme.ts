import { Platform } from "react-native";

// LARAY palette — CLAUDE.md §8. All text/background pairs below meet WCAG AA.
export const colors = {
  navy: "#0B1F3A",
  navySoft: "#1B3358",
  gold: "#C9A227",
  goldSoft: "#F3E8C2",
  bg: "#F7F5EF",
  surface: "#FFFFFF",
  slate: "#4A5568",
  border: "#D9D4C7",
  error: "#B42318",
  errorSoft: "#FDECEA",
  success: "#1F7A4D",
  successSoft: "#E6F4EC",
  warning: "#8A5A00", // dark amber, AA on white
  warningSoft: "#FFF4D6",
  info: "#1D4E89",
  infoSoft: "#E7EEF8",
  white: "#FFFFFF",
  text: "#0B1F3A",
} as const;

export const fonts = {
  // Serif headings: Georgia on web/iOS, system Noto Serif on Android.
  heading: Platform.select({ web: 'Georgia, "Noto Serif", "Times New Roman", serif', ios: "Georgia", default: "serif" }),
  body: Platform.select({ web: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Arabic", sans-serif', default: undefined }),
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 16, pill: 999 } as const;
export const type = { body: 16, small: 14, large: 18, h3: 20, h2: 24, h1: 30, display: 40 } as const;
export const TOUCH = 48; // minimum touch target (px)
export const MAX_WIDTH = 760;
