// Every UI string exists in all four demo languages (CLAUDE.md §6, §12).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const LANGS = ["fr", "so", "ar", "en"] as const;
const locales = Object.fromEntries(LANGS.map((l) => [l, JSON.parse(readFileSync(`locales/${l}.json`, "utf8"))]));

function leaves(o: Record<string, unknown>, prefix = ""): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    k === "_meta" ? [] : typeof v === "object" && v ? leaves(v as Record<string, unknown>, `${prefix}${k}.`) : [`${prefix}${k}`]);
}
const base = (k: string) => k.replace(/_(zero|one|two|few|many|other)$/, "");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
}

test("every locale has the same keys as French", () => {
  const fr = new Set(leaves(locales.fr).map(base));
  for (const l of LANGS) {
    const keys = new Set(leaves(locales[l]).map(base));
    const missing = [...fr].filter((k) => !keys.has(k));
    assert.deepEqual(missing, [], `${l} is missing ${missing.join(", ")}`);
  }
});

test("every static t('key') used in the app exists in every locale", () => {
  const used = new Set<string>();
  for (const f of [...files("app"), ...files("components")]) {
    for (const m of readFileSync(f, "utf8").matchAll(/\bt\(\s*"([a-z_.A-Z0-9-]+)"/g)) used.add(m[1]);
  }
  assert.ok(used.size > 100);
  for (const l of LANGS) {
    const keys = new Set(leaves(locales[l]).map(base));
    const missing = [...used].filter((k) => !keys.has(k));
    assert.deepEqual(missing, [], `${l} is missing ${missing.join(", ")}`);
  }
});

test("Arabic has all six plural categories for counted strings", () => {
  const ar = leaves(locales.ar);
  for (const k of ar.filter((k) => k.endsWith("_other"))) {
    for (const f of ["zero", "one", "two", "few", "many"]) assert.ok(ar.includes(`${base(k)}_${f}`), `${base(k)}_${f}`);
  }
});

test("translations not reviewed by a native speaker are flagged", () => {
  for (const l of ["so", "ar", "en"] as const) assert.equal(locales[l]._meta._review, "machine");
  assert.equal(locales.fr.demo.banner, "DÉMO — données fictives");
  assert.equal(locales.fr.demo.footer, "DjiHealth — prototype de démonstration · LARAY Strategic Advisory");
});
