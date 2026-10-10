// Every icon name used in the app is present in the subset icon font (scripts/build-icons.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { usedIconNames } from "../scripts/build-icons.mjs";

test("subset icon font covers every icon used in the app", () => {
  const map = JSON.parse(readFileSync("assets/icons/glyphmap.json", "utf8")) as Record<string, number>;
  const missing = (usedIconNames() as string[]).filter((n) => !(n in map));
  assert.deepEqual(missing, [], `run \`node scripts/build-icons.mjs\` — missing: ${missing.join(", ")}`);
});
