// Batch model evaluation runner.
//
// Drives the /ai page in a real browser (Playwright) for each (chartId,
// questionIndex) pair, so the AI Runner executes exactly like it would for a
// human clicking "Run AI" — real DOM events, D3 transitions, html2canvas
// screenshots, real /chat calls to Ollama. Each finished run is auto-saved by
// the app itself (AiPage.tsx's save effect), including the grade against
// data/questions/**/questions.json, so this script only needs to trigger runs
// and then read the results back out of Postgres.
//
// Usage:
//   node scripts/evaluate.mjs                       # run every (chart, question) pair, baseline pipeline
//   node scripts/evaluate.mjs --slug owid:co2-long-term-concentration
//   node scripts/evaluate.mjs --limit 5
//   node scripts/evaluate.mjs --variant ranked       # use the sentence-transformers action ranker
//
// You're responsible for having the frontend (5173), backend (8000), and
// whatever serves /chat on :3000 already running — this script only checks
// they're up, it doesn't start or stop them. (scripts/chat-relay.mjs is a
// small optional helper that bridges /chat to a local Ollama server if you
// want to use it — run it yourself, same as the others.)

import { chromium } from "playwright";

const FRONTEND_URL = process.env.EVAL_FRONTEND_URL ?? "http://localhost:5173";
const BACKEND_URL = process.env.EVAL_BACKEND_URL ?? "http://127.0.0.1:8000";
const RUN_TIMEOUT_MS = Number(process.env.EVAL_RUN_TIMEOUT_MS ?? 5 * 60 * 1000);

function parseArgs(argv) {
  const args = { slug: null, limit: null, variant: "baseline" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--slug") args.slug = argv[++i];
    if (argv[i] === "--limit") args.limit = Number(argv[++i]);
    if (argv[i] === "--variant") args.variant = argv[++i];
  }
  if (args.variant !== "baseline" && args.variant !== "ranked") {
    throw new Error(`--variant must be "baseline" or "ranked", got "${args.variant}"`);
  }
  return args;
}

// You start/manage the backend, frontend, and the :3000 /chat relay yourself
// (however you normally do it) — this script never launches or kills those.
// It just checks they're reachable before driving the browser, so a missing
// service fails fast with a clear message instead of a confusing timeout
// 5 questions into the run.
async function preflightCheck() {
  const checks = [
    ["backend", `${BACKEND_URL}/charts`],
    ["frontend", FRONTEND_URL],
  ];
  const problems = [];
  for (const [name, url] of checks) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (!res.ok && res.status >= 500) problems.push(`${name} (${url}) responded ${res.status}`);
    } catch {
      problems.push(`${name} (${url}) is not reachable`);
    }
  }
  if (problems.length > 0) {
    throw new Error(`Not all services are up:\n  - ${problems.join("\n  - ")}\nStart them yourself, then re-run.`);
  }
}

async function fetchTargets({ slug, limit }) {
  const res = await fetch(`${BACKEND_URL}/charts`);
  if (!res.ok) throw new Error(`GET /charts failed: ${res.status}`);
  const charts = await res.json();

  const targets = [];
  for (const chart of charts) {
    if (slug && chart.slug !== slug) continue;
    chart.questions.forEach((question, questionIndex) => {
      if (!question.trim()) return;
      targets.push({ chartId: chart.id, slug: chart.slug, title: chart.title, questionIndex, question });
    });
  }
  return limit ? targets.slice(0, limit) : targets;
}

async function runOne(page, target, variant) {
  const url = `${FRONTEND_URL}/ai?chartId=${encodeURIComponent(target.chartId)}&questionIndex=${target.questionIndex}&variant=${variant}`;
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const runButton = page.getByRole("button", { name: /^Run AI$/ });
  await runButton.waitFor({ state: "visible", timeout: 60_000 });
  // wait for the chart's auto-render to finish (button re-enables once renderedChartId is set)
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.trim() === "Run AI");
      return !!btn && !btn.disabled;
    },
    { timeout: 60_000 },
  );

  await runButton.click();

  // "Run AI" -> "Running..." -> back to "Run AI" once the loop stops
  await page.waitForFunction(
    () => {
      const btn = [...document.querySelectorAll("button")].find((b) => b.textContent?.includes("Run AI") || b.textContent?.includes("Running"));
      return !!btn && btn.textContent?.trim() === "Run AI";
    },
    { timeout: RUN_TIMEOUT_MS },
  );

  // give the save effect a moment to finish its POST to /ai-logs
  await page.waitForTimeout(1500);

  const stopReasonText = await page.locator("text=Stop reason:").first().textContent().catch(() => null);
  const savedRunText = await page.locator("text=Saved run:").first().textContent().catch(() => null);
  return {
    // stopReasonText looks like "Stop reason: ANSWERED · Pipeline: ranked"
    stopReason: stopReasonText?.match(/Stop reason:\s*(\S+)/)?.[1] ?? null,
    savedRunId: savedRunText?.replace("Saved run:", "").trim() ?? null,
  };
}

async function main() {
  await preflightCheck();
  const args = parseArgs(process.argv.slice(2));
  const targets = await fetchTargets(args);
  if (targets.length === 0) {
    console.log("No matching (chart, question) targets found.");
    return;
  }
  console.log(`Evaluating ${targets.length} question(s) with pipeline variant "${args.variant}"...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.log("  [browser error]", msg.text().slice(0, 200));
  });

  const results = [];
  for (const [i, target] of targets.entries()) {
    process.stdout.write(`[${i + 1}/${targets.length}] ${target.slug} — "${target.question.slice(0, 60)}"... `);
    try {
      const result = await runOne(page, target, args.variant);
      console.log(result.stopReason ?? "no stop reason captured");
      results.push({ ...target, variant: args.variant, ...result, error: null });
    } catch (err) {
      console.log("ERROR:", String(err).slice(0, 200));
      const shotPath = `/tmp/eval-logs/fail-${i}.png`;
      await page.screenshot({ path: shotPath }).catch(() => {});
      results.push({ ...target, variant: args.variant, stopReason: null, savedRunId: null, error: String(err), screenshot: shotPath });
    }
  }

  await browser.close();

  console.log("\n=== Evaluation run complete ===");
  console.log(JSON.stringify(results, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
