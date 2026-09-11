#!/usr/bin/env node
// Generate sommelier answers for one variant (model config) over the frozen
// case set. Writes, per case:
//   .claude/hillclimb/sommelier-chat/<variant>/outputs/<id>_rep<k>.json   (answer + usage)
//   .claude/hillclimb/sommelier-chat/<variant>/traces/<id>_rep<k>.json    (Turn[] transcript)
// and appends an ungraded row to <variant>/results.jsonl. judge.mjs fills in
// the grades afterwards. Failed attempts go to <variant>/errors.jsonl and never
// occupy a (case, rep) slot, so a rerun retries exactly those.
//
//   node scripts/sommelier-eval/run.mjs --variant baseline --env-file ~/testProject/.env
//   node scripts/sommelier-eval/run.mjs --variant v1 --cases id-quilt-cab,hello   # pilot subset
//   node scripts/sommelier-eval/run.mjs --all                                      # every variant
//   node scripts/sommelier-eval/run.mjs --variant v1 --mock                        # no spend
//
// Every candidate runs as a PRO user (web search on): Pro is who pays for the
// sommelier, and search behaviour is one of the things being compared.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildSommelierPrompt } from "../../lib/sommelierPrompt.js";
import { EM_DASH, complete, loadKeys, loadSystemPromptFloor, withBackoff } from "./providers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(name);
const envFiles = args.flatMap((a, i) => (a === "--env-file" ? [args[i + 1]] : []));

const FLOW = path.resolve(repoRoot, flag("--flow", ".claude/hillclimb/sommelier-chat"));
const REPS = Number(flag("--reps", 1));
const CONCURRENCY = Number(flag("--concurrency", 3));
const TIMEOUT_MS = Number(flag("--timeout-s", 180)) * 1000;
const MOCK = has("--mock");
const ONLY = flag("--cases", null)?.split(",").map((s) => s.trim());

const spec = JSON.parse(fs.readFileSync(path.join(here, "models.json"), "utf8"));
const { fixture, cases } = JSON.parse(fs.readFileSync(path.join(here, "cases.json"), "utf8"));
const variantIds = has("--all") ? Object.keys(spec.variants) : [flag("--variant", "baseline")];

const keys = MOCK ? {} : loadKeys(envFiles);
const floor = loadSystemPromptFloor(repoRoot);
const system = buildSommelierPrompt(fixture);

const safe = (id) => id.replace(/[^A-Za-z0-9._-]/g, "_");
const readJsonl = (file) => (fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);

// Programmatic checks that need no judge. Recorded on every row so the report
// can show them next to the pairwise verdict.
function checks(c, text) {
  const hasBlock = /```wine_suggestions[\s\S]*?```/.test(text);
  const wantsBlock = c.tags.includes("identify-wine") && !c.tags.includes("search-needed") && c.id !== "notes-this-wine";
  const forbidsBlock = ["smalltalk", "guardrail", "format", "pairing"].some((t) => c.tags.includes(t)) || /^(rate-and-taste|detailed-ratings|notes-this-wine)$/.test(c.id);
  let blockValid = null;
  if (hasBlock) {
    try {
      JSON.parse(text.match(/```wine_suggestions\s*([\s\S]*?)```/)[1]);
      blockValid = 1;
    } catch {
      blockValid = 0;
    }
  }
  return {
    no_em_dash: text.includes(EM_DASH) ? 0 : 1,
    // 1 = block present when it should be and absent when it must not be;
    // cases with no opinion (null) are left out of the mean by the report.
    block_ok: wantsBlock ? (hasBlock && blockValid ? 1 : 0) : forbidsBlock ? (hasBlock ? 0 : 1) : null,
    words: text.split(/\s+/).filter(Boolean).length,
  };
}

async function runOne(variantId, cfg, c, rep) {
  const vdir = path.join(FLOW, variantId);
  const id = safe(c.id);
  const outFile = path.join(vdir, "outputs", `${id}_rep${rep}.json`);
  if (fs.existsSync(outFile)) return "skip";

  const provider = MOCK ? "mock" : cfg.provider;
  let attempts = 0;
  try {
    const { value: r, attempts: n } = await withBackoff(() =>
      complete({ ...cfg, provider }, { floor, system, messages: c.messages, search: true, keys, timeoutMs: TIMEOUT_MS })
    );
    attempts = n;
    if (!MOCK && !r.served_model?.startsWith(cfg.model.replace(/-preview$/, ""))) {
      throw Object.assign(new Error(`served model ${r.served_model} != requested ${cfg.model}`), { klass: "model_mismatch", usage: r.usage, served_model: r.served_model });
    }
    const ck = checks(c, r.text);
    const row = {
      prompt_id: id,
      prompt: c.messages.at(-1).content,
      tags: c.tags,
      rep,
      model: r.served_model,
      status: r.truncated ? "truncated" : "ok",
      stop_reason: r.stop_reason,
      usage: r.usage,
      web_searches: r.web_searches,
      latency_s: Number(r.latency_s.toFixed(2)),
      attempts,
      grade: { no_em_dash: ck.no_em_dash, ...(ck.block_ok === null ? {} : { block_ok: ck.block_ok }) },
      meta: { variant: variantId, effort: cfg.effort, provider: cfg.provider, words: ck.words, rubric: c.rubric, turns: c.messages.length },
    };
    fs.mkdirSync(path.dirname(outFile), { recursive: true });
    fs.mkdirSync(path.join(vdir, "traces"), { recursive: true });
    fs.writeFileSync(outFile, JSON.stringify({ text: r.text, ...row }, null, 2));
    const trace = [{ role: "system", content: `${floor}\n\n${system}` }, ...c.messages, ...r.transcript];
    fs.writeFileSync(path.join(vdir, "traces", `${id}_rep${rep}.json`), JSON.stringify(trace, null, 2));
    fs.appendFileSync(path.join(vdir, "results.jsonl"), JSON.stringify(row) + "\n");
    return row.status;
  } catch (err) {
    fs.mkdirSync(vdir, { recursive: true });
    const klass = err.klass ?? (err.name === "AbortError" ? "timeout" : err.status ? "api_error" : "harness_error");
    fs.appendFileSync(
      path.join(vdir, "errors.jsonl"),
      JSON.stringify({ prompt_id: id, rep, klass, attempts: err.attempts ?? attempts, message: String(err.message).slice(0, 500), model: err.served_model ?? cfg.model, usage: err.usage ?? null, at: new Date().toISOString() }) + "\n"
    );
    return `error:${klass}`;
  }
}

async function runVariant(variantId) {
  const cfg = spec.variants[variantId];
  if (!cfg) throw new Error(`Unknown variant ${variantId}`);
  const vdir = path.join(FLOW, variantId);
  fs.mkdirSync(vdir, { recursive: true });
  fs.writeFileSync(path.join(vdir, "change.md"), `${cfg.label}\n\nprovider=${cfg.provider} model=${cfg.model} effort=${cfg.effort}\n`);
  fs.writeFileSync(path.join(vdir, "summary.json"), JSON.stringify({ description: cfg.label, label: cfg.label, target: "code" }));

  const selected = ONLY ? cases.filter((c) => ONLY.includes(c.id)) : cases;
  const jobs = [];
  for (const c of selected) for (let rep = 0; rep < REPS; rep++) jobs.push({ c, rep });

  const counts = {};
  let next = 0;
  const t0 = Date.now();
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < jobs.length) {
        const { c, rep } = jobs[next++];
        const status = await runOne(variantId, cfg, c, rep);
        counts[status] = (counts[status] ?? 0) + 1;
        process.stdout.write(`  ${variantId} ${c.id} rep${rep}: ${status}\n`);
      }
    })
  );
  const rows = readJsonl(path.join(vdir, "results.jsonl"));
  const cost = rows.reduce((s, r) => s + rowCost(r), 0);
  console.log(`${variantId} (${cfg.label}): ${JSON.stringify(counts)} in ${((Date.now() - t0) / 1000).toFixed(0)}s; ${rows.length} rows on disk, generation cost so far $${cost.toFixed(3)}`);
}

export function rowCost(row, prices = spec.prices) {
  const p = prices[Object.keys(prices).find((k) => row.model?.startsWith(k)) ?? ""];
  if (!p || !row.usage) return 0;
  const u = row.usage;
  return (
    ((u.input_tokens ?? 0) * p.in + (u.output_tokens ?? 0) * p.out + (u.cache_read_input_tokens ?? 0) * p.cache_read + (u.cache_creation_input_tokens ?? 0) * p.in * 1.25) / 1e6 +
    (row.web_searches ?? 0) * p.search
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(`flow: ${path.relative(repoRoot, FLOW)}; cases: ${ONLY ? ONLY.length : cases.length}; reps: ${REPS}; system prompt: ${system.length} chars; keys: ${Object.entries(keys).map(([k, v]) => `${k}=${v ? "ok" : "MISSING"}`).join(" ")}${MOCK ? " (MOCK)" : ""}`);
  for (const v of variantIds) await runVariant(v);
}
