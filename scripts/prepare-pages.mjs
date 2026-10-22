import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
await mkdir(resolve(root, "docs"), { recursive: true });
await copyFile(resolve(root, "dist/ogni.html"), resolve(root, "docs/index.html"));
await writeFile(resolve(root, "docs/.nojekyll"), "");
console.log("GitHub Pages files prepared in docs/ (source: main /docs).");
