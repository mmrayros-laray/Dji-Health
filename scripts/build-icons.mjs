// Builds a small icon font containing only the MaterialCommunityIcons glyphs the app uses
// (the full font is 1.3 MB; CLAUDE.md §8 asks for a 3G-friendly app).
//   node scripts/build-icons.mjs     (needs Python fonttools: pip install fonttools)
// Re-run after using a new icon name; tests/icons.test.ts fails if one is missing.
import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const VI = "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons";
const full = JSON.parse(readFileSync(`${VI}/glyphmaps/MaterialCommunityIcons.json`, "utf8"));

export function usedIconNames() {
  const files = (dir) => readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.tsx?$/.test(f) ? [p] : [];
  });
  const names = new Set();
  for (const f of [...files("app"), ...files("components"), ...files("lib")]) {
    for (const m of readFileSync(f, "utf8").matchAll(/["']([a-z0-9-]+)["']/g)) if (m[1] in full) names.add(m[1]);
  }
  return [...names].sort();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const names = usedIconNames();
  const map = Object.fromEntries(names.map((n) => [n, full[n]]));
  writeFileSync("assets/icons/glyphmap.json", JSON.stringify(map, null, 1) + "\n");
  const unicodes = names.map((n) => `U+${full[n].toString(16).toUpperCase()}`).join(",");
  execFileSync("pyftsubset", [`${VI}/Fonts/MaterialCommunityIcons.ttf`, `--unicodes=${unicodes}`,
    "--output-file=assets/icons/djh-icons.ttf", "--no-hinting", "--desubroutinize", "--layout-features="], { stdio: "inherit" });
  const kb = (p) => Math.round(statSync(p).size / 1024);
  console.log(`${names.length} icons → assets/icons/djh-icons.ttf (${kb("assets/icons/djh-icons.ttf")} KB, full font ${kb(`${VI}/Fonts/MaterialCommunityIcons.ttf`)} KB)`);
}
