#!/usr/bin/env node
// One table per question the eval answers. Reads results.jsonl for every
// variant under the chat flow (and the SommBench flow when present) and prints:
//   1. quality: win rate vs the current model (both judges, each judge alone,
//      agreement), programmatic checks, answer length
//   2. cost: measured $/message from the run's own usage, by price table in
//      models.json; latency; searches per message
//   3. quality by category (tags[0]) so a model that wins on pairings but
//      fails guardrails is visible
//   4. wine-theory quiz score
//   5. cost x quality, so the Pareto frontier can be read off
//   node scripts/sommelier-eval/summary.mjs [--md]
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { rowCost } from "./run.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../..");
const CHAT = path.join(repoRoot, ".claude/hillclimb/sommelier-chat");
const QUIZ = path.join(repoRoot, ".claude/hillclimb/sommbench-wtqa");
const MD = process.argv.includes("--md");
const spec = JSON.parse(fs.readFileSync(path.join(here, "models.json"), "utf8"));

const readJsonl = (f) => (fs.existsSync(f) ? fs.readFileSync(f, "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l)) : []);
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const pctStr = (x) => (Number.isNaN(x) ? "-" : `${(x * 100).toFixed(0)}%`);
// Wald 95% CI half-width for a mean of values in [0,1] (win is 0/0.5/1).
const ci = (xs) => {
  if (xs.length < 2) return NaN;
  const m = mean(xs);
  const sd = Math.sqrt(mean(xs.map((x) => (x - m) ** 2)) * (xs.length / (xs.length - 1)));
  return (1.96 * sd) / Math.sqrt(xs.length);
};

const variants = Object.keys(spec.variants).filter((v) => fs.existsSync(path.join(CHAT, v, "results.jsonl")));
const rows = Object.fromEntries(variants.map((v) => [v, readJsonl(path.join(CHAT, v, "results.jsonl"))]));
const quiz = Object.fromEntries(variants.map((v) => [v, readJsonl(path.join(QUIZ, v, "results.jsonl"))]));

const stats = variants.map((v) => {
  const rs = rows[v];
  const ok = rs.filter((r) => r.status === "ok");
  const wins = ok.map((r) => r.grade?.win).filter((x) => x !== undefined);
  const wf = ok.map((r) => r.grade?.win_fable).filter((x) => x !== undefined);
  const wa = ok.map((r) => r.grade?.win_astra).filter((x) => x !== undefined);
  const agree = ok.map((r) => r.grade?.agree).filter((x) => x !== undefined);
  const blocks = ok.map((r) => r.grade?.block_ok).filter((x) => x !== undefined);
  const q = quiz[v].filter((r) => r.status === "ok");
  return {
    v,
    label: spec.variants[v].label,
    n: ok.length,
    truncated: rs.length - ok.length,
    win: mean(wins), winCi: ci(wins), nJudged: wins.length,
    winFable: mean(wf), winAstra: mean(wa), agree: mean(agree), nAgree: agree.length,
    blockOk: mean(blocks), emDash: mean(ok.map((r) => r.grade.no_em_dash)),
    words: mean(ok.map((r) => r.meta.words)),
    cost: mean(ok.map((r) => rowCost(r))),
    latency: mean(ok.map((r) => r.latency_s)),
    searches: mean(ok.map((r) => r.web_searches)),
    outTokens: mean(ok.map((r) => r.usage.output_tokens)),
    quiz: q.length ? mean(q.map((r) => r.grade.correct)) : NaN,
    quizN: q.length,
    wins,
  };
});

const pad = (s, n) => String(s).padEnd(n);
const rpad = (s, n) => String(s).padStart(n);
const table = (headers, lines) => {
  if (MD) {
    console.log(`| ${headers.join(" | ")} |\n|${headers.map(() => "---").join("|")}|`);
    for (const l of lines) console.log(`| ${l.join(" | ")} |`);
  } else {
    console.log(headers.map((h, i) => (i ? rpad(h, 12) : pad(h, 24))).join(""));
    for (const l of lines) console.log(l.map((c, i) => (i ? rpad(c, 12) : pad(c, 24))).join(""));
  }
  console.log();
};

console.log(`SOMMELIER CHAT MODEL EVAL: ${stats[0]?.n ?? 0} cases, ${variants.length} configs, judges ${Object.values(spec.judges).map((j) => j.model).join(" + ")}\n`);

console.log("1. Quality vs current model (win = 1 candidate better, 0.5 tie, 0 current better; mean over judges; ±95% CI)");
table(
  ["config", "win", "±", "Fable says", "Astra says", "agree", "block rule", "words"],
  stats
    .sort((a, b) => (b.win || 0) - (a.win || 0))
    .map((s) => [s.label, s.v === "baseline" ? "ref" : pctStr(s.win), s.v === "baseline" ? "" : `±${(s.winCi * 100).toFixed(0)}`, pctStr(s.winFable), pctStr(s.winAstra), s.nAgree ? `${pctStr(s.agree)} (${s.nAgree})` : "n/a", pctStr(s.blockOk), s.words.toFixed(0)])
);

console.log("2. Measured cost and speed per message (this eval's own usage x list prices; Pro config, search on)");
table(
  ["config", "$/msg", "x current", "out tokens", "searches", "latency s", "truncated"],
  [...stats]
    .sort((a, b) => a.cost - b.cost)
    .map((s) => [s.label, `$${s.cost.toFixed(4)}`, `${(s.cost / stats.find((x) => x.v === "baseline").cost).toFixed(2)}x`, s.outTokens.toFixed(0), s.searches.toFixed(2), s.latency.toFixed(1), s.truncated])
);

console.log("3. Win rate by category (tags[0])");
const cats = [...new Set(rows.baseline.map((r) => r.tags[0]))];
table(
  ["config", ...cats.map((c) => c.slice(0, 11))],
  stats
    .filter((s) => s.v !== "baseline")
    .sort((a, b) => b.win - a.win)
    .map((s) => [s.label, ...cats.map((c) => pctStr(mean(rows[s.v].filter((r) => r.status === "ok" && r.tags[0] === c && r.grade?.win !== undefined).map((r) => r.grade.win))))])
);
console.log(`   cases per category: ${cats.map((c) => `${c} ${rows.baseline.filter((r) => r.tags[0] === c).length}`).join(", ")}\n`);

console.log("4. SommBench wine-theory quiz (128 English multiple-choice, no search)");
table(
  ["config", "accuracy", "n"],
  [...stats].sort((a, b) => (b.quiz || 0) - (a.quiz || 0)).map((s) => [s.label, pctStr(s.quiz), s.quizN])
);

console.log("5. Cost x quality (sorted by cost; a config is dominated when a cheaper one has an equal or higher win rate)");
let best = -1;
table(
  ["config", "$/msg", "win", "quiz", "frontier"],
  [...stats]
    .sort((a, b) => a.cost - b.cost)
    .map((s) => {
      const w = s.v === "baseline" ? 0.5 : s.win;
      const onFrontier = w > best;
      if (onFrontier) best = w;
      return [s.label, `$${s.cost.toFixed(4)}`, pctStr(w), pctStr(s.quiz), onFrontier ? "yes" : ""];
    })
);

// Where each judge disagreed with the other, for the spot-check.
const disagreements = [];
for (const v of variants) for (const r of rows[v]) if (r.grade?.agree === 0) disagreements.push(`${spec.variants[v].label} / ${r.prompt_id}: Fable ${r.grade.win_fable} vs Astra ${r.grade.win_astra}`);
console.log(`Judge disagreements: ${disagreements.length}`);
