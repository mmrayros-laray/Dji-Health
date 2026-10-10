// Copies the canonical glossary (locales/glossary.json) next to the Edge Functions,
// which are bundled from supabase/functions/ only. tests/glossary.test.ts fails if the copies drift.
import { copyFileSync } from "node:fs";
copyFileSync("locales/glossary.json", "supabase/functions/_shared/glossary.json");
console.log("glossary synced → supabase/functions/_shared/glossary.json");
