#!/usr/bin/env node
// SommBench Wine Theory QA (English, 128 multiple-choice questions, four
// difficulty levels) on each candidate: a cheap, programmatically graded
// wine-knowledge number to sit next to the product eval. Same prompt the paper
// uses (sommbench/prompts.py WTQA_PROMPT_EN), no system prompt, no web search,
// so the score measures recall, not research.
//
// Dataset: sommify/sommbench on Hugging Face (CC BY 4.0), config `wtqa`,
// fetched through the public datasets-server and cached locally.
// Paper: https://arxiv.org/abs/2603.12117 (no Claude models in its tables).
//
//   node scripts/sommelier-eval/sommbench.mjs --variant v1 --env-file ~/testProject/.env
//   node scripts/sommelier-eval/sommbench.mjs --all
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { complete, loadKeys, withBackoff } from "./providers.mjs";
import { rowCost } from "./run.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const args = process.argv.slice(2);
const flag = (name, dflt) => {
  const i = args.indexOf(name);
  return i === -1 ? dflt : args[i + 1];
};
const has = (name) => args.includes(name);
const envFiles = args.flatMap((a, i) => (a === "--env-file" ? [args[i + 1]] : []));

const FLOW = path.resolve(repoRoot, flag("--flow", ".claude/hillclimb/sommbench-wtqa"));
const CONCURRENCY = Number(flag("--concurrency", 4));
const TIMEOUT_MS = Number(flag("--timeout-s", 120)) * 1000;
const MOCK = has("--mock");
const LIMIT = Number(flag("--limit", 0));

const spec = JSON.parse(fs.readFileSync(path.join(here, "models.json"), "utf8"));
const variantIds = has("--all") ? Object.keys(spec.variants) : [flag("--variant", "baseline")];
const keys = MOCK ? {} : loadKeys(envFiles);

const PROMPT = (q) => `Act as an expert sommelier.
Your task is to answer the following multiple-choice question.
Your response MUST be a single letter (A, B, C, or D) and nothing else.

Question: ${q.question}

Options:
(A) ${q.a}
(B) ${q.b}
(C) ${q.c}
(D) ${q.d}

Correct Answer (A, B, C, or D):`;

async function loadQuestions() {
  const cache = path.join(here, "sommbench-wtqa-en.json");
  if (fs.existsSync(cache)) return JSON.parse(fs.readFileSync(cache, "utf8"));
  const rows = [];
  for (let offset = 0; offset < 1024; offset += 100) {
    const url = `https://datasets-server.huggingface.co/rows?dataset=sommify/sommbench&config=wtqa&split=test&offset=${offset}&length=100`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HF datasets-server ${res.status}`);
    const data = await res.json();
    for (const r of data.rows) if (r.row.language === "en") rows.push({ idx: r.row_idx, ...r.row });
  }
  fs.writeFileSync(cache, JSON.stringify(rows, null, 1));
  return rows;
}

// Same normalisation as sommbench.core.clean_wtqa_answer for English.
function cleanAnswer(text) {
  let a = text.replace(/<\|.*?\|>/g, "").trim().toLowerCase();
  for (const L of ["a", "b", "c", "d"]) if (a.includes(`(${L})`)) return L;
  a = a.replace(/[^a-d]/g, "");
  return a.length === 1 ? a : a[0] ?? "";
}

async function runVariant(variantId, questions) {
  const cfg = spec.variants[variantId];
  const vdir = path.join(FLOW, variantId);
  fs.mkdirSync(path.join(vdir, "traces"), { recursive: true });
  fs.writeFileSync(path.join(vdir, "change.md"), `${cfg.label}\n\nprovider=${cfg.provider} model=${cfg.model} effort=${cfg.effort}\n`);
  const file = path.join(vdir, "results.jsonl");
  const done = new Set(fs.existsSync(file) ? fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l).prompt_id) : []);
  const todo = questions.filter((q) => !done.has(`wtqa-${q.idx}`));
  let next = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (next < todo.length) {
        const q = todo[next++];
        const id = `wtqa-${q.idx}`;
        try {
          const { value: r, attempts } = await withBackoff(() =>
            complete({ ...cfg, provider: MOCK ? "mock" : cfg.provider }, { floor: "", system: "", messages: [{ role: "user", content: PROMPT(q) }], search: false, keys, timeoutMs: TIMEOUT_MS })
          );
          const answer = MOCK ? ["a", "b", "c", "d"][Math.floor(Math.random() * 4)] : cleanAnswer(r.text);
          const row = {
            prompt_id: id, prompt: q.question, tags: [q.level, "wtqa-en"], rep: 0,
            model: r.served_model, status: r.truncated ? "truncated" : "ok", stop_reason: r.stop_reason,
            usage: r.usage, web_searches: 0, latency_s: Number(r.latency_s.toFixed(2)), attempts,
            grade: { correct: answer === q.true_label ? 1 : 0 },
            meta: { variant: variantId, effort: cfg.effort, answer, expected: q.true_label },
          };
          fs.writeFileSync(path.join(vdir, "traces", `${id}_rep0.json`), JSON.stringify([{ role: "user", content: PROMPT(q) }, ...r.transcript], null, 2));
          fs.appendFileSync(file, JSON.stringify(row) + "\n");
        } catch (err) {
          fs.appendFileSync(path.join(vdir, "errors.jsonl"), JSON.stringify({ prompt_id: id, rep: 0, klass: err.status ? "api_error" : "harness_error", attempts: err.attempts, message: String(err.message).slice(0, 300), model: cfg.model, at: new Date().toISOString() }) + "\n");
        }
      }
    })
  );
  const rows = fs.readFileSync(file, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
  const ok = rows.filter((r) => r.status === "ok");
  const acc = ok.reduce((s, r) => s + r.grade.correct, 0) / ok.length;
  const byLevel = {};
  for (const r of ok) {
    const L = r.tags[0];
    byLevel[L] ??= [0, 0];
    byLevel[L][0] += r.grade.correct;
    byLevel[L][1]++;
  }
  const cost = rows.reduce((s, r) => s + rowCost(r), 0);
  console.log(`${variantId} (${cfg.label}): ${(acc * 100).toFixed(1)}% on ${ok.length} (${Object.entries(byLevel).sort().map(([l, [c, n]]) => `${l.replace("Level ", "L")} ${c}/${n}`).join(", ")}); $${cost.toFixed(3)}`);
}

const questions = (await loadQuestions()).slice(0, LIMIT || undefined);
console.log(`${questions.length} English WTQA questions; keys: ${Object.entries(keys).map(([k, v]) => `${k}=${v ? "ok" : "MISSING"}`).join(" ")}${MOCK ? " (MOCK)" : ""}`);
for (const v of variantIds) await runVariant(v, questions);
