#!/usr/bin/env node
// Split each judge's itemised faults into prompt-tunable STYLE faults (length,
// formatting, em dashes, tone) and model-intrinsic SUBSTANCE faults (wrong or
// invented facts, ignoring the user's context, fabricated actions, misused
// wine_suggestions block, poor search judgment). Counts are per variant over
// every verdict the two judges returned. Substance faults are the ones a
// prompt change cannot fix, so they matter more for the model decision.
//   node scripts/sommelier-eval/faults.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const FLOW = path.resolve(here, "../../.claude/hillclimb/sommelier-chat");
const spec = JSON.parse(fs.readFileSync(path.join(here, "models.json"), "utf8"));

const KINDS = {
  style: /\b(long|length|lengthy|verbose|padd|essay|header|headline|bullet|emoji|format|em[ -]dash|dash|preachy|patroni|bold|markdown|wordy|brief|concise|shorter|ceremony|throat|tone|pretentious|promotional|flowery)/i,
  fabrication: /\b(fabricat|invent|incorrect|inaccurate|wrong|misattribut|unsupported|unverif|hallucin|guess|not confirm|no source|unsourced|dubious|risk)/i,
  context: /\b(context|cellar|tasting|rating|history|owned|does not own|ignores|notice|already)/i,
  action: /\b(logged|log it|logging|saved|added it|fabricated action|cannot perform|claims to)/i,
  block: /\b(wine_suggestions|block|prefill|json)/i,
  search: /\bsearch/i,
  safety: /\b(safety|medical|underage|clearance|drinking)/i,
};
const classify = (fault) => {
  const hits = Object.entries(KINDS).filter(([, re]) => re.test(fault)).map(([k]) => k);
  // Style words appear inside substantive complaints ("long list of invented
  // wines"); count the fault as substance if any substance kind matched.
  const substance = hits.filter((k) => k !== "style");
  return substance.length ? substance : hits.length ? ["style"] : ["other"];
};

const rows = [];
for (const v of Object.keys(spec.variants)) {
  const jdir = path.join(FLOW, v, "judgments");
  if (!fs.existsSync(jdir)) continue;
  const counts = { cand: {}, base: {} };
  let verdicts = 0;
  for (const f of fs.readdirSync(jdir)) {
    const j = JSON.parse(fs.readFileSync(path.join(jdir, f), "utf8"));
    for (const ver of Object.values(j.verdicts)) {
      if (!ver.winner) continue;
      verdicts++;
      const candFaults = j.candIsA ? ver.a_faults : ver.b_faults;
      const baseFaults = j.candIsA ? ver.b_faults : ver.a_faults;
      for (const [who, faults] of [["cand", candFaults], ["base", baseFaults]]) {
        for (const fault of faults ?? []) for (const k of classify(fault)) counts[who][k] = (counts[who][k] ?? 0) + 1;
      }
    }
  }
  rows.push({ v, label: spec.variants[v].label, verdicts, counts });
}

const kinds = ["style", "fabrication", "context", "action", "block", "search", "safety", "other"];
const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
console.log("Faults the judges listed against the CANDIDATE, per verdict (lower is better). 'substance' = everything except style.\n");
console.log(pad("config", 22) + rpad("verdicts", 9) + kinds.map((k) => rpad(k, 12)).join("") + rpad("SUBSTANCE", 11) + rpad("(current)", 10));
for (const r of rows.sort((a, b) => a.label.localeCompare(b.label))) {
  const per = (who, k) => ((r.counts[who][k] ?? 0) / r.verdicts).toFixed(2);
  const sub = (who) => (kinds.filter((k) => k !== "style" && k !== "other").reduce((s, k) => s + (r.counts[who][k] ?? 0), 0) / r.verdicts).toFixed(2);
  console.log(pad(r.label, 22) + rpad(r.verdicts, 9) + kinds.map((k) => rpad(per("cand", k), 12)).join("") + rpad(sub("cand"), 11) + rpad(sub("base"), 10));
}
console.log("\n(current) = substance faults per verdict listed against the Sonnet 4.6 answer in the same pairs, i.e. the like-for-like reference for that row.");
