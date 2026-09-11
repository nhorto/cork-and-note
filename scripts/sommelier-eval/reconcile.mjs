#!/usr/bin/env node
// Rebuild <variant>/results.jsonl from <variant>/outputs/*.json (the per-call
// source of truth, written before the row is appended). Run before judging so
// a process killed between the two writes cannot leave a case unscored.
//   node scripts/sommelier-eval/reconcile.mjs [--flow .claude/hillclimb/sommelier-chat]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const i = args.indexOf("--flow");
const FLOW = path.resolve(here, "../..", i === -1 ? ".claude/hillclimb/sommelier-chat" : args[i + 1]);

for (const v of fs.readdirSync(FLOW)) {
  const outDir = path.join(FLOW, v, "outputs");
  if (!fs.existsSync(outDir)) continue;
  const file = path.join(FLOW, v, "results.jsonl");
  const rows = fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : [];
  const have = new Set(rows.map((r) => `${r.prompt_id}_rep${r.rep}`));
  let added = 0;
  for (const f of fs.readdirSync(outDir)) {
    const key = f.replace(/\.json$/, "");
    if (have.has(key)) continue;
    const { text, ...row } = JSON.parse(fs.readFileSync(path.join(outDir, f), "utf8"));
    void text;
    rows.push(row);
    added++;
  }
  if (added) fs.writeFileSync(file, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");
  console.log(`${v}: ${rows.length} rows (${added} rebuilt from outputs)`);
}
