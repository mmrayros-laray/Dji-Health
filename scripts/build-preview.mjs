// Builds the offline "demo mode" preview as ONE self-contained HTML page (no backend, no network):
//   EXPO_PUBLIC_DEMO_MODE=1 npx expo export --platform web --output-dir <dist>
//   node scripts/build-preview.mjs <dist> <out.html>
// The page is meant for a sandboxed host (e.g. a claude.ai artifact): all JS, the icon font and images are inlined.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const [dist, out] = process.argv.slice(2);
if (!dist || !out) throw new Error("usage: node scripts/build-preview.mjs <dist> <out.html>");

const jsDir = join(dist, "_expo/static/js/web");
const jsFile = readdirSync(jsDir).find((f) => f.endsWith(".js"));
let js = readFileSync(join(jsDir, jsFile), "utf8");

const MIME = { ".ttf": "font/ttf", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml" };
let inlined = 0;
js = js.replace(/"(\/assets\/[^"]+\.(ttf|png|jpg|svg))"/g, (m, p) => {
  const mime = MIME[extname(p)];
  try {
    const data = readFileSync(join(dist, p)).toString("base64");
    inlined++;
    return `"data:${mime};base64,${data}"`;
  } catch {
    return m; // asset not exported (unused variant): leave as is
  }
});
// a literal "</script" inside the bundle would close the inline <script> early
js = js.replace(/<\/script/gi, "<\\/script");

const html = `<title>DjiHealth</title>
<meta name="theme-color" content="#0B1F3A">
<style>
  /* DjiHealth brand (CLAUDE.md §8). Deliberately single-theme: the app is designed light, on off-white. */
  :root { --navy: #0B1F3A; --bg: #F7F5EF; color-scheme: light; }
  html, body { height: 100%; background: var(--bg); color: var(--navy); }
  body { overflow: hidden; }
  #root { display: flex; height: 100%; flex: 1; }
  #boot { margin: auto; font: 600 16px system-ui, sans-serif; color: var(--navy); }
</style>
<div id="root"><p id="boot">DjiHealth — chargement de l'aperçu…</p></div>
<script>
  // The preview host serves the page from its own path; the app's routes start at "/".
  try { if (location.pathname !== "/") history.replaceState(history.state, "", "/" + location.hash); } catch (e) {}
</script>
<script>${js}</script>
`;
writeFileSync(out, html);
console.log(`preview: ${out} (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(2)} MB, ${inlined} assets inlined)`);
