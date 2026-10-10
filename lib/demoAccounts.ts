// The five one-tap demo accounts seeded in supabase/seed.sql (synthetic people).
export type Role = "patient" | "clinician" | "ministry_viewer" | "admin";

export interface DemoAccount {
  key: "amina" | "fatouma" | "hassan" | "ministry" | "admin";
  email: string;
  role: Role;
  icon: string;
}

export const DEMO_ACCOUNTS: DemoAccount[] = [
  { key: "amina", email: "amina@demo.djihealth.test", role: "patient", icon: "human-pregnant" },
  { key: "fatouma", email: "fatouma@demo.djihealth.test", role: "patient", icon: "human-female-boy" },
  { key: "hassan", email: "dr.hassan@demo.djihealth.test", role: "clinician", icon: "doctor" },
  { key: "ministry", email: "ministere@demo.djihealth.test", role: "ministry_viewer", icon: "chart-bar" },
  { key: "admin", email: "admin@demo.djihealth.test", role: "admin", icon: "shield-check" },
];

export function homeFor(role: Role | null | undefined): string {
  switch (role) {
    case "patient": return "/vault";
    case "clinician": return "/clinician";
    case "ministry_viewer": return "/dashboard";
    case "admin": return "/ai-rejections";
    default: return "/sign-in";
  }
}
