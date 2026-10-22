import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const dist = resolve(root, "dist");
const mime = {
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
};
const dataUrl = async (path) =>
  `data:${mime[extname(path)] || "application/octet-stream"};base64,${(await readFile(path)).toString("base64")}`;
const cards = JSON.parse(
  await readFile(resolve(root, "src/cards.json"), "utf8"),
);
const embedded = { "icon.svg": await dataUrl(resolve(dist, "icon.svg")) };
for (const card of cards)
  embedded[card.image.replace(/^\/+/, "")] = await dataUrl(
    resolve(dist, card.image.replace(/^\/+/, "")),
  );

let html = await readFile(resolve(dist, "index.html"), "utf8");
const script = html.match(/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/);
const stylesheet = html.match(
  /<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/,
);
if (!script || !stylesheet)
  throw new Error(
    "Production JavaScript or CSS was not found in dist/index.html",
  );
const js = await readFile(resolve(dist, script[1]), "utf8");
const cssPath = resolve(dist, stylesheet[1]);
let css = await readFile(cssPath, "utf8");
const fontUrls = [
  ...new Set(
    [...css.matchAll(/url\(([^)]+)\)/g)].map((match) =>
      match[1].replace(/^["']|["']$/g, ""),
    ),
  ),
];
for (const url of fontUrls) {
  if (!url.startsWith("data:"))
    css = css.replaceAll(url, await dataUrl(resolve(dirname(cssPath), url)));
}
// A replacement function preserves JavaScript strings such as "$&" literally.
html = html.replace(
  script[0],
  () =>
    `<script>window.__NAVY_ASSETS__=${JSON.stringify(embedded)};</script><script type="module">${js.replaceAll("</script", "<\\/script")}</script>`,
);
html = html.replace(stylesheet[0], () => `<style>${css}</style>`);
html = html.replace(/<link\b[^>]*\brel="manifest"[^>]*>\s*/, "");
html = html.replace('href="./icon.svg"', `href="${embedded["icon.svg"]}"`);
await writeFile(resolve(dist, "ogni.html"), html);
await mkdir(resolve(dist, "offline"), { recursive: true });
await writeFile(resolve(dist, "offline/index.html"), html);
console.log(
  `Standalone app: dist/ogni.html and dist/offline/index.html (${(Buffer.byteLength(html) / 1024 / 1024).toFixed(1)} MiB, all 144 cards embedded)`,
);
