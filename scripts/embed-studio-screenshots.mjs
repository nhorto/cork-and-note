#!/usr/bin/env node
// Build the distributable Screenshot Studio: embed the brand logo and the
// ready-made set's screenshots (JPEG data URLs) into the studio HTML.
//
//   node scripts/embed-studio-screenshots.mjs <shots-dir> <logo.png> <out.html>
//
// <shots-dir> holds <key>.jpg files matching PREBUILT_SET keys in the studio.
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const [shotsDir, logoPath, outPath] = process.argv.slice(2);
if (!outPath) {
  console.error(
    "usage: embed-studio-screenshots.mjs <shots-dir> <logo.png> <out.html>",
  );
  process.exit(1);
}
const src = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "mockups",
  "appstore-screenshot-studio.html",
);
let html = readFileSync(src, "utf8");

const logo = readFileSync(logoPath).toString("base64");
html = html.replace("__LOGO_BASE64__", logo);

const images = {};
for (const f of readdirSync(shotsDir).filter((f) => f.endsWith(".jpg"))) {
  images[f.replace(/\.jpg$/, "")] =
    "data:image/jpeg;base64," + readFileSync(join(shotsDir, f)).toString("base64");
}
const block = `/*PREBUILT:START*/\n      const PREBUILT_IMAGES = ${JSON.stringify(images)};\n      /*PREBUILT:END*/`;
html = html.replace(
  /\/\*PREBUILT:START\*\/[\s\S]*?\/\*PREBUILT:END\*\//,
  () => block,
);
writeFileSync(outPath, html);
console.log(
  `wrote ${outPath} with ${Object.keys(images).length} embedded screenshots (${Math.round(html.length / 1024)} KB)`,
);
